namespace pxt {
    function hex2(n: number) {
        return ("0" + n.toString(16)).slice(-2)
    }

    function hex2str(h: string) {
        return U.uint8ArrayToString(U.fromHex(h))
    }

    function str2hex(h: string) {
        return U.toHex(U.stringToUint8Array(h))
    }

    export class GDBServer {
        private q = new U.PromiseQueue();
        private dataBuf = "";
        private numSent = 0;
        private pktSize = 400;

        trace = false
        bmpMode = true
        targetInfo = ""

        private onResponse: (s: string) => void;
        private onEvent = (s: string) => { }

        constructor(public io: pxt.TCPIO) {
            this.io.onData = b => this.onData(b)
        }

        private onData(buf: Uint8Array) {
            this.dataBuf += U.uint8ArrayToString(buf)
            while (this.dataBuf.length > 0) {
                let ch = this.dataBuf[0]
                if (ch == '+')
                    this.dataBuf = this.dataBuf.slice(1)
                else if (ch == '$' || ch == '%') {
                    let resp = this.decodeResp(this.dataBuf.slice(1))
                    if (resp != null) {
                        if (ch == '$') {
                            this.io.sendPacketAsync(this.buildCmd("+")).done()
                            if (this.onResponse)
                                this.onResponse(resp)
                            else {
                                // ignore unexpected responses right after connection
                                // they are likely left-over from a previous session
                                if (this.numSent > 0)
                                    this.io.error("unexpected response: " + resp)
                            }
                        } else {
                            this.onEvent(resp)
                        }
                    } else {
                        break
                    }
                } else {
                    this.io.error("invalid character: " + ch)
                }
            }
        }

        private buildCmd(cmd: string) {
            if (cmd == "+")
                return U.stringToUint8Array(cmd)

            let r = ""
            for (let i = 0; i < cmd.length; ++i) {
                let ch = cmd.charAt(i)
                if (ch == '}' || ch == '#' || ch == '$') {
                    r += '}'
                    r += String.fromCharCode(ch.charCodeAt(0) ^ 0x20)
                } else {
                    r += ch
                }
            }
            let ch = 0
            cmd = r
            for (let i = 0; i < cmd.length; ++i) {
                ch = (ch + cmd.charCodeAt(i)) & 0xff
            }

            r = "$" + cmd + "#" + hex2(ch)
            return U.stringToUint8Array(r)
        }

        private decodeResp(resp: string) {
            let r = ""
            for (let i = 0; i < resp.length; ++i) {
                let ch = resp[i]
                if (ch == '}') {
                    ++i
                    r += String.fromCharCode(resp.charCodeAt(i) ^ 0x20)
                } else if (ch == '*') {
                    ++i
                    let rep = resp.charCodeAt(i) - 29
                    let ch = r.charAt(r.length - 1)
                    while (rep-- > 0)
                        r += ch
                } else if (ch == '#') {
                    let checksum = resp.slice(i + 1, i + 3)
                    if (checksum.length == 2) {
                        // TODO validate checksum?
                        this.dataBuf = resp.slice(i + 3)
                        return r
                    } else {
                        // incomplete
                        return null
                    }
                } else {
                    r += ch
                }
            }
            return null
        }

        sendCmdOKAsync(cmd: string) {
            return this.sendCmdAsync(cmd, r => r == "OK")
        }

        error(msg: string) {
            this.io.error(msg)
            this.io.disconnectAsync().done()
        }

        sendCmdAsync(cmd: string, respTest?: (resp: string) => boolean) {
            this.numSent++
            const cmd2 = this.buildCmd(cmd)
            return this.q.enqueue("one", () =>
                respTest === null ? this.io.sendPacketAsync(cmd2).then(() => null as string) :
                    new Promise<string>((resolve) => {
                        this.onResponse = v => {
                            this.onResponse = null
                            if (this.trace)
                                pxt.log(`GDB: '${cmd}' -> '${v}'`)
                            if (respTest !== undefined && !respTest(v))
                                this.error(`Invalid GDB command response: '${cmd}' -> '${v}'`)
                            resolve(v)
                        }
                        this.io.sendPacketAsync(cmd2).done()
                    }))
        }

        sendRCmdAsync(cmd: string) {
            return this.sendMCmdAsync("qRcmd," + str2hex(cmd))
        }

        sendMCmdAsync(cmd: string) {
            this.numSent++
            const cmd2 = this.buildCmd(cmd)
            let r = ""
            return this.q.enqueue("one", () =>
                new Promise<string>((resolve) => {
                    this.onResponse = v => {
                        if (v != "OK" && v[0] == "O")
                            r += hex2str(v.slice(1))
                        else {
                            if (v != "OK")
                                r += " - " + v
                            this.onResponse = null
                            if (this.trace)
                                pxt.log(`Final GDB: '${cmd}' -> '${r}'`)
                            resolve(r)
                        }
                    }
                    this.io.sendPacketAsync(cmd2).done()
                }))
        }

        write32Async(addr: number, data: number): Promise<void> {
            let b = new Uint8Array(4)
            HF2.write32(b, 0, data)
            return this.writeMemAsync(addr, b)
        }

        writeMemAsync(addr: number, data: Uint8Array): Promise<void> {
            const maxBytes = this.pktSize / 2 - 10
            U.assert(data.length < maxBytes)
            return this.sendCmdOKAsync("M" + addr.toString(16) + "," +
                data.length.toString(16) + ":" + U.toHex(data))
                .then(r => {
                    console.log(r)
                })
        }

        readMemAsync(addr: number, bytes: number): Promise<Uint8Array> {
            const maxBytes = this.pktSize / 2 - 6
            if (bytes > maxBytes) {
                const result = new Uint8Array(bytes)
                const loop = (ptr: number): Promise<Uint8Array> => {
                    const len = Math.min(bytes - ptr, maxBytes)
                    if (len == 0)
                        return Promise.resolve(result)
                    return this.readMemAsync(addr + ptr, len)
                        .then(part => {
                            U.memcpy(result, ptr, part)
                            return loop(ptr + len)
                        })
                }
                return loop(0)
            }

            return this.sendCmdAsync("m" + addr.toString(16) + "," + bytes.toString(16))
                .then(res => U.fromHex(res))
        }

        private initBMPAsync() {
            return Promise.resolve()
                .then(() => this.sendRCmdAsync("swdp_scan"))
                .then(r => {
                    this.targetInfo = r
                    return this.sendCmdAsync("vAttach;1", r => r[0] == "T")
                })
                .then(() => { })
        }

        initAsync() {
            return Promise.delay(1000)
                .then(() => this.sendCmdAsync("!")) // extended mode
                .then(() => this.sendCmdAsync("qSupported"))
                .then(res => {
                    let features: any = {}
                    res = ";" + res + ";"
                    res = res
                        .replace(/;([^;]+)[=:]([^:;]+)/g, (f, k, v) => {
                            features[k] = v
                            return ";"
                        })
                    this.pktSize = parseInt(features["PacketSize"]) || 1024
                    pxt.log("GDB-server caps: " + JSON.stringify(features)
                        + " " + res.replace(/;+/g, ";"))

                    if (this.bmpMode)
                        return this.initBMPAsync()
                    else {
                        // continue
                        return this.sendCmdAsync("c")
                            .then(() => { })
                    }
                    // return this.sendCmdAsync("?") // reason for stop
                })
        }
    }
}