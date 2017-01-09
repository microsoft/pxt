namespace pxt.HF2 {
    // http://www.linux-usb.org/usb.ids
    export const enum VID {
        ATMEL = 0x03EB,
        ARDUINO = 0x2341,
        ADAFRUIT = 0x239A,
        NXP = 0x0D28, // aka Freescale, KL26 etc
    }


    export interface TalkArgs {
        cmd: number;
        data?: Uint8Array;
    }

    export interface PacketIO {
        sendPacketAsync(pkt: Uint8Array): Promise<void>;
        onData: (v: Uint8Array) => void;
        onError: (e: Error) => void;
        error(msg: string): any;
        reconnectAsync(): Promise<void>;

        // these are implemneted by HID-bridge
        talksAsync?(cmds: TalkArgs[]): Promise<Uint8Array[]>;
        sendSerialAsync?(buf: Uint8Array, useStdErr: boolean): Promise<void>;
        onSerial?: (v: Uint8Array, isErr: boolean) => void;
    }

    const HF2_CMD_BININFO = 0x0001 // no arguments
    const HF2_MODE_BOOTLOADER = 0x01
    const HF2_MODE_USERSPACE = 0x02
    /*
    struct HF2_BININFO_Result {
        uint32_t mode;
        uint32_t flash_page_size;
        uint32_t flash_num_pages;
        uint32_t max_message_size;
    };
    */

    const HF2_CMD_INFO = 0x0002
    // no arguments
    // results is utf8 character array

    const HF2_CMD_RESET_INTO_APP = 0x0003// no arguments, no result

    const HF2_CMD_RESET_INTO_BOOTLOADER = 0x0004  // no arguments, no result

    const HF2_CMD_START_FLASH = 0x0005   // no arguments, no result

    const HF2_CMD_WRITE_FLASH_PAGE = 0x0006
    /*
    struct HF2_WRITE_FLASH_PAGE_Command {
        uint32_t target_addr;
        uint32_t data[flash_page_size];
    };
    */
    // no result

    const HF2_CMD_CHKSUM_PAGES = 0x0007
    /*
    struct HF2_CHKSUM_PAGES_Command {
        uint32_t target_addr;
        uint32_t num_pages;
    };
    struct HF2_CHKSUM_PAGES_Result {
        uint16_t chksums[num_pages];
    };
    */

    const HF2_CMD_READ_WORDS = 0x0008
    /*
    struct HF2_READ_WORDS_Command {
        uint32_t target_addr;
        uint32_t num_words;
    };
    struct HF2_READ_WORDS_Result {
        uint32_t words[num_words];
    };
    */

    const HF2_CMD_WRITE_WORDS = 0x0009
    /*
    struct HF2_WRITE_WORDS_Command {
        uint32_t target_addr;
        uint32_t num_words;
        uint32_t words[num_words];
    };
    */
    // no result

    const HF2_FLAG_SERIAL_OUT = 0x80
    const HF2_FLAG_SERIAL_ERR = 0xC0
    const HF2_FLAG_CMDPKT_LAST = 0x40
    const HF2_FLAG_CMDPKT_BODY = 0x00
    const HF2_FLAG_MASK = 0xC0
    const HF2_SIZE_MASK = 63

    const HF2_STATUS_OK = 0x00
    const HF2_STATUS_INVALID_CMD = 0x01
    const HF2_STATUS_EXEC_ERR = 0x02


    export function write32(buf: Uint8Array, pos: number, v: number) {
        buf[pos + 0] = (v >> 0) & 0xff;
        buf[pos + 1] = (v >> 8) & 0xff;
        buf[pos + 2] = (v >> 16) & 0xff;
        buf[pos + 3] = (v >> 24) & 0xff;
    }

    export function write16(buf: Uint8Array, pos: number, v: number) {
        buf[pos + 0] = (v >> 0) & 0xff;
        buf[pos + 1] = (v >> 8) & 0xff;
    }

    export function read32(buf: Uint8Array, pos: number) {
        return buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16) | (buf[pos + 3] << 32)
    }

    export function read16(buf: Uint8Array, pos: number) {
        return buf[pos] | (buf[pos + 1] << 8)
    }

    export interface BootloaderInfo {
        Header: string;
        Parsed: {
            Version: string;
            Features: string;
        };
        Model: string;
        BoardID: string;
    }

    function log(msg: string) {
        console.log("HF2: " + msg)
    }

    export class Wrapper {
        private cmdSeq = U.randomUint32();
        constructor(public io: PacketIO) {
            let frames: Uint8Array[] = []
            io.onSerial = (b, e) => this.onSerial(b, e)
            io.onData = buf => {
                let tp = buf[0] & HF2_FLAG_MASK
                let len = buf[0] & 63
                //console.log(`msg tp=${tp} len=${len}`)
                let frame = new Uint8Array(len)
                U.memcpy(frame, 0, buf, 1, len)
                if (tp & HF2_FLAG_SERIAL_OUT) {
                    this.onSerial(frame, tp == HF2_FLAG_SERIAL_ERR)
                    return
                }
                frames.push(frame)
                if (tp == HF2_FLAG_CMDPKT_BODY) {
                    return
                } else {
                    U.assert(tp == HF2_FLAG_CMDPKT_LAST)
                    let total = 0
                    for (let f of frames) total += f.length
                    let r = new Uint8Array(total)
                    let ptr = 0
                    for (let f of frames) {
                        U.memcpy(r, ptr, f)
                        ptr += f.length
                    }
                    frames = []
                    this.msgs.push(r)
                }
            }
            io.onError = err => {
                log("recv error: " + err.message)
                //this.msgs.pushError(err)
            }
        }

        private lock = new U.PromiseQueue();
        infoRaw: string;
        info: BootloaderInfo;
        pageSize: number;
        flashSize: number;
        maxMsgSize: number = 63; // when running in forwarding mode, we do not really know
        bootloaderMode = false;
        reconnectTries = 0;
        msgs = new U.PromiseBuffer<Uint8Array>()

        onSerial = (buf: Uint8Array, isStderr: boolean) => { };

        private resetState() {
            this.lock = new U.PromiseQueue()
            this.info = null
            this.infoRaw = null
            this.pageSize = null
            this.flashSize = null
            this.maxMsgSize = 63
            this.bootloaderMode = false
            this.msgs.drain()
        }

        reconnectAsync(first = false): Promise<void> {
            this.resetState()
            if (first) return this.initAsync()
            return this.io.reconnectAsync()
                .then(() => this.initAsync())
                .catch(e => {
                    if (this.reconnectTries < 5) {
                        this.reconnectTries++
                        log(`error ${e.message}; reconnecting attempt #${this.reconnectTries}`)
                        return Promise.delay(500)
                            .then(() => this.reconnectAsync())
                    } else {
                        throw e
                    }
                })
        }

        error(m: string) {
            return this.io.error(m)
        }

        talkAsync(cmd: number, data?: Uint8Array) {
            if (this.io.talksAsync)
                return this.io.talksAsync([{ cmd, data }])
                    .then(v => v[0])

            let len = 8
            if (data) len += data.length
            let pkt = new Uint8Array(len)
            let seq = ++this.cmdSeq & 0xffff
            write32(pkt, 0, cmd);
            write16(pkt, 4, seq);
            write16(pkt, 6, 0);
            if (data)
                U.memcpy(pkt, 8, data, 0, data.length)
            let numSkipped = 0
            let handleReturnAsync = (): Promise<Uint8Array> =>
                this.msgs.shiftAsync(1000) // we wait up to a second
                    .then(res => {
                        if (read16(res, 0) != seq) {
                            if (numSkipped < 3) {
                                numSkipped++
                                log(`message out of sync, (${seq} vs ${read16(res, 0)}); will re-try`)
                                return handleReturnAsync()
                            }
                            this.error("out of sync")
                        }
                        let info = ""
                        if (res[3])
                            info = "; info=" + res[3]
                        switch (res[2]) {
                            case HF2_STATUS_OK:
                                return res.slice(4)
                            case HF2_STATUS_INVALID_CMD:
                                this.error("invalid command" + info)
                                break
                            case HF2_STATUS_EXEC_ERR:
                                this.error("execution error" + info)
                                break
                            default:
                                this.error("error " + res[2] + info)
                                break
                        }
                        return null
                    })

            return this.sendMsgAsync(pkt)
                .then(handleReturnAsync)
        }

        private sendMsgAsync(buf: Uint8Array) {
            return this.sendMsgCoreAsync(buf)
        }

        sendSerialAsync(buf: Uint8Array, useStdErr = false) {
            if (this.io.sendSerialAsync)
                return this.io.sendSerialAsync(buf, useStdErr)
            return this.sendMsgCoreAsync(buf, useStdErr ? 2 : 1)
        }

        private sendMsgCoreAsync(buf: Uint8Array, serial: number = 0) {
            // Util.assert(buf.length <= this.maxMsgSize)
            let frame = new Uint8Array(64)
            let loop = (pos: number): Promise<void> => {
                let len = buf.length - pos
                if (len <= 0) return Promise.resolve()
                if (len > 63) {
                    len = 63
                    frame[0] = HF2_FLAG_CMDPKT_BODY;
                } else {
                    frame[0] = HF2_FLAG_CMDPKT_LAST;
                }
                if (serial) frame[0] = serial == 1 ? HF2_FLAG_SERIAL_OUT : HF2_FLAG_SERIAL_ERR;
                frame[0] |= len;
                for (let i = 0; i < len; ++i)
                    frame[i + 1] = buf[pos + i]
                return this.io.sendPacketAsync(frame)
                    .then(() => loop(pos + len))
            }
            return this.lock.enqueue("out", () => loop(0))
        }

        switchToBootloaderAsync() {
            if (this.bootloaderMode)
                return Promise.resolve()
            log(`Switching into bootloader mode`)
            return this.talkAsync(HF2_CMD_START_FLASH)
                .then(() => this.initAsync())
                .then(() => {
                    if (!this.bootloaderMode)
                        this.error("cannot switch into bootloader mode")
                })
        }

        reflashAsync(blocks: pxtc.UF2.Block[]) {
            return this.flashAsync(blocks)
                .then(() => Promise.delay(100))
                .then(() => this.reconnectAsync())
        }

        flashAsync(blocks: pxtc.UF2.Block[]) {
            let start = Date.now()
            let fstart = 0
            let loopAsync = (pos: number): Promise<void> => {
                if (pos >= blocks.length)
                    return Promise.resolve()
                let b = blocks[pos]
                U.assert(b.payloadSize == this.pageSize)
                let buf = new Uint8Array(4 + b.payloadSize)
                write32(buf, 0, b.targetAddr)
                U.memcpy(buf, 4, b.data, 0, b.payloadSize)
                return this.talkAsync(HF2_CMD_WRITE_FLASH_PAGE, buf)
                    .then(() => loopAsync(pos + 1))
            }
            return this.switchToBootloaderAsync()
                .then(() => {
                    let size = blocks.length * this.pageSize
                    log(`Starting flash (${Math.round(size / 1024)}kB).`)
                    fstart = Date.now()
                })
                .then(() => loopAsync(0))
                .then(() => {
                    let n = Date.now()
                    let t0 = n - start
                    let t1 = n - fstart
                    log(`Flashing done at ${Math.round(blocks.length * this.pageSize / t1 * 1000 / 1024)} kB/s in ${t0}ms (reset ${t0 - t1}ms). Resetting.`)
                })
                .then(() =>
                    this.talkAsync(HF2_CMD_RESET_INTO_APP)
                        .catch(e => {
                            // error expected here - device is resetting
                        }))
                .then(() => { })
        }

        private initAsync() {
            return Promise.resolve()
                .then(() => this.talkAsync(HF2_CMD_BININFO))
                .then(binfo => {
                    this.bootloaderMode = binfo[0] == HF2_MODE_BOOTLOADER;
                    this.pageSize = read32(binfo, 4)
                    this.flashSize = read32(binfo, 8) * this.pageSize
                    this.maxMsgSize = read32(binfo, 12)
                    log(`Connected; msgSize ${this.maxMsgSize}B; flash ${this.flashSize / 1024}kB; ${this.bootloaderMode ? "bootloader" : "application"} mode`)
                    return this.talkAsync(HF2_CMD_INFO)
                })
                .then(buf => {
                    this.infoRaw = U.fromUTF8(U.uint8ArrayToString(buf));
                    let info = {} as any
                    ("Header: " + this.infoRaw).replace(/^([\w\-]+):\s*([^\n\r]*)/mg,
                        (f, n, v) => {
                            info[n.replace(/-/g, "")] = v
                            return ""
                        })
                    this.info = info
                    let m = /v(\d\S+)\s+(\S+)/.exec(this.info.Header)
                    this.info.Parsed = {
                        Version: m[1],
                        Features: m[2],
                    }
                    log("Board-ID: " + this.info.BoardID)
                })
                .then(() => {
                    this.reconnectTries = 0
                })
        }

    }
}
