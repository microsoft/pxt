namespace pxt {
    function hex2(n: number) {
        return ("0" + n.toString(16)).slice(-2)
    }

    export class GDBServer {
        private q = new U.PromiseQueue();
        private dataBuf = "";

        private onResponse: (s: string) => void;
        private onEvent = (s: string) => { }

        constructor(public io: pxt.TCPIO) {
            this.io.onData = b => this.onData(b)
        }

        private onData(buf: Uint8Array) {
            this.dataBuf += U.uint8ArrayToString(buf)
            while (this.dataBuf) {
                let ch = this.dataBuf[0]
                if (ch == '+')
                    this.dataBuf = this.dataBuf.slice(1)
                else if (ch == '$' || ch == '%') {
                    let resp = this.decodeResp(this.dataBuf.slice(1))
                    if (resp != null) {
                        if (ch == '$') {
                            this.sendCmdAsync("+", false).done()
                            if (this.onResponse)
                                this.onResponse(resp)
                            else
                                U.userError("unexpected response: " + resp)
                        } else {
                            this.onEvent(resp)
                        }
                    } else {
                        break
                    }
                } else {
                    U.userError("invalid character: " + ch)
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

        private sendCmdAsync(cmd: string, resp = true) {
            const cmd2 = this.buildCmd(cmd)
            return this.q.enqueue("one", () =>
                !resp ? this.io.sendPacketAsync(cmd2).then(() => null as string) :
                    new Promise<string>((resolve) => {
                        this.onResponse = v => {
                            this.onResponse = null
                            console.log(`GDB: '${cmd}' -> '${v}'`)
                            resolve(v)
                        }
                        this.io.sendPacketAsync(this.buildCmd(cmd)).done()
                    }))
        }

        initAsync() {
            return this.sendCmdAsync("qSupported")
                .then(res => {
                    let caps = res.split(/;/)
                    console.log("GDB-server caps: ", caps)
                    // return this.sendCmdAsync("?") // reason for stop
                })
                // .then(res => this.sendCmdAsync("Hc-1")) // select all threads
                // .then(res => this.sendCmdAsync("Hg-1")) // select all threads
                .then(res => {
                    return this.sendCmdAsync("c", false) // continue; don't expect response
                })
                .then(() => {})
        }
    }
}