namespace pxt {
    // keep all of these in sync with pxtbase.h
    export const REFCNT_FLASH = "0xfffe"
    export const VTABLE_MAGIC = 0xF9
    export const ValTypeObject = 4
    export enum BuiltInType {
        BoxedString = 1,
        BoxedNumber = 2,
        BoxedBuffer = 3,
        RefAction = 4,
        RefImage = 5,
        RefCollection = 6,
        RefRefLocal = 7,
        RefMap = 8,
        RefMImage = 9, // microbit-specific
        MMap = 10, // linux, mostly ev3
        BoxedString_SkipList = 11, // used by VM bytecode representation only
        BoxedString_ASCII = 12, // ditto
        ZPin = 13,
        User0 = 16,
    }
}

namespace pxt.HF2 {
    export interface MutableArrayLike<T> {
        readonly length: number;
        [n: number]: T;
    }

    // http://www.linux-usb.org/usb.ids
    export const enum VID {
        ATMEL = 0x03EB,
        ARDUINO = 0x2341,
        ADAFRUIT = 0x239A,
        NXP = 0x0D28, // aka Freescale, KL26 etc
    }

    // see https://github.com/microsoft/uf2/blob/master/hf2.md for full spec
    export const HF2_CMD_BININFO = 0x0001 // no arguments
    export const HF2_MODE_BOOTLOADER = 0x01
    export const HF2_MODE_USERSPACE = 0x02
    /*
    struct HF2_BININFO_Result {
        uint32_t mode;
        uint32_t flash_page_size;
        uint32_t flash_num_pages;
        uint32_t max_message_size;
    };
    */

    export const HF2_CMD_INFO = 0x0002
    // no arguments
    // results is utf8 character array

    export const HF2_CMD_RESET_INTO_APP = 0x0003// no arguments, no result

    export const HF2_CMD_RESET_INTO_BOOTLOADER = 0x0004  // no arguments, no result

    export const HF2_CMD_START_FLASH = 0x0005   // no arguments, no result

    export const HF2_CMD_WRITE_FLASH_PAGE = 0x0006
    /*
    struct HF2_WRITE_FLASH_PAGE_Command {
        uint32_t target_addr;
        uint32_t data[flash_page_size];
    };
    */
    // no result

    export const HF2_CMD_CHKSUM_PAGES = 0x0007
    /*
    struct HF2_CHKSUM_PAGES_Command {
        uint32_t target_addr;
        uint32_t num_pages;
    };
    struct HF2_CHKSUM_PAGES_Result {
        uint16_t chksums[num_pages];
    };
    */

    export const HF2_CMD_READ_WORDS = 0x0008
    /*
    struct HF2_READ_WORDS_Command {
        uint32_t target_addr;
        uint32_t num_words;
    };
    struct HF2_READ_WORDS_Result {
        uint32_t words[num_words];
    };
    */

    export const HF2_CMD_WRITE_WORDS = 0x0009
    /*
    struct HF2_WRITE_WORDS_Command {
        uint32_t target_addr;
        uint32_t num_words;
        uint32_t words[num_words];
    };
    */
    // no result

    export const HF2_CMD_DMESG = 0x0010
    // no arguments
    // results is utf8 character array

    export const HF2_FLAG_SERIAL_OUT = 0x80
    export const HF2_FLAG_SERIAL_ERR = 0xC0
    export const HF2_FLAG_CMDPKT_LAST = 0x40
    export const HF2_FLAG_CMDPKT_BODY = 0x00
    export const HF2_FLAG_MASK = 0xC0
    export const HF2_SIZE_MASK = 63

    export const HF2_STATUS_OK = 0x00
    export const HF2_STATUS_INVALID_CMD = 0x01
    export const HF2_STATUS_EXEC_ERR = 0x02
    export const HF2_STATUS_EVENT = 0x80


    export const HF2_CMD_JDS_CONFIG = 0x0020
    export const HF2_CMD_JDS_SEND = 0x0021
    export const HF2_EV_JDS_PACKET = 0x800020

    export const CUSTOM_EV_JACDAC = "jacdac"

    // the eventId is overlayed on the tag+status; the mask corresponds
    // to the HF2_STATUS_EVENT above
    export const HF2_EV_MASK = 0x800000

    export function write32(buf: MutableArrayLike<number>, pos: number, v: number) {
        buf[pos + 0] = (v >> 0) & 0xff;
        buf[pos + 1] = (v >> 8) & 0xff;
        buf[pos + 2] = (v >> 16) & 0xff;
        buf[pos + 3] = (v >> 24) & 0xff;
    }

    export function write16(buf: MutableArrayLike<number>, pos: number, v: number) {
        buf[pos + 0] = (v >> 0) & 0xff;
        buf[pos + 1] = (v >> 8) & 0xff;
    }

    export function read32(buf: ArrayLike<number>, pos: number) {
        return (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16) | (buf[pos + 3] << 24)) >>> 0
    }

    export function read16(buf: ArrayLike<number>, pos: number) {
        return buf[pos] | (buf[pos + 1] << 8)
    }

    export function encodeU32LE(words: number[]) {
        let r = new Uint8Array(words.length * 4)
        for (let i = 0; i < words.length; ++i)
            write32(r, i * 4, words[i])
        return r
    }

    export function decodeU32LE(buf: Uint8Array) {
        let res: number[] = []
        for (let i = 0; i < buf.length; i += 4)
            res.push(read32(buf, i))
        return res
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

    let logEnabled = false
    export function enableLog() {
        logEnabled = true
    }

    function log(msg: string) {
        if (logEnabled)
            pxt.log("HF2: " + msg)
        else
            pxt.debug("HF2: " + msg)
    }

    export class ProtocolError extends Error {
        constructor(public readonly status: number, message: string) {
            super(message);
        }
    }

    export class Wrapper implements pxt.packetio.PacketIOWrapper {
        private initialized = false;
        private cmdSeq = U.randomUint32();
        private frames: Uint8Array[] = [];
        private connectionId = 0;
        private operationId = 0;
        private reconnectPromise: Promise<void>;
        private switchingPromise: Promise<void>;
        private expectAppMode = false;

        constructor(public readonly io: pxt.packetio.PacketIO) {
            io.onDeviceConnectionChanged = connect => {
                if (!connect) {
                    this.resetState();
                } else if (!this.flashing && !this.switchingPromise && !this.reconnectPromise) {
                    this.reconnectAsync().catch(err => log("reconnect error: " + err.message));
                }
                // A flash owns the app/bootloader transition. USB events must not
                // close or reconnect its newly enumerated bootloader underneath it.
            };
            io.onSerial = (b, e) => this.onSerial(b, e)
            io.onData = buf => {
                let tp = buf[0] & HF2_FLAG_MASK
                let len = buf[0] & 63
                if (!buf.length || len > buf.length - 1) {
                    io.onError(new Error("Invalid HF2 packet length"));
                    return;
                }
                //pxt.log(`msg tp=${tp} len=${len}`)
                let frame = new Uint8Array(len)
                U.memcpy(frame, 0, buf, 1, len)
                if (tp & HF2_FLAG_SERIAL_OUT) {
                    this.onSerial(frame, tp == HF2_FLAG_SERIAL_ERR)
                    return
                }
                this.frames.push(frame)
                if (tp == HF2_FLAG_CMDPKT_BODY) {
                    return
                } else {
                    U.assert(tp == HF2_FLAG_CMDPKT_LAST)
                    let total = 0
                    for (let f of this.frames) total += f.length
                    let r = new Uint8Array(total)
                    let ptr = 0
                    for (let f of this.frames) {
                        U.memcpy(r, ptr, f)
                        ptr += f.length
                    }
                    this.frames = []
                    if (r.length < 4) {
                        io.onError(new Error("Invalid HF2 response length"));
                        return;
                    }
                    if (r[2] & HF2_STATUS_EVENT) {
                        // asynchronous event
                        io.onEvent(r)
                    } else {
                        this.msgs.push(r)
                    }
                }
            }
            io.onEvent = buf => {
                let evid = read32(buf, 0)
                let f = U.lookup(this.eventHandlers, evid + "")
                if (f) {
                    f(buf.slice(4))
                } else {
                    log("unhandled event: " + evid.toString(16))
                }
            }
            io.onError = err => {
                log("recv error: " + err.message)
                this.resetState();
                if (this.autoReconnect && !this.flashing && !this.switchingPromise && !this.reconnectPromise) {
                    this.reconnectAsync().catch(err => log("reconnect error: " + err.message));
                }
            }
            this.onEvent(HF2_EV_JDS_PACKET, buf => {
                this.onCustomEvent(CUSTOM_EV_JACDAC, buf)
            })
        }

        private lock = new U.PromiseQueue();
        flashing = false;
        rawMode = false;
        infoRaw: string;
        info: BootloaderInfo;
        pageSize: number;
        flashSize: number;
        maxMsgSize: number = 63; // when running in forwarding mode, we do not really know
        familyID: number;
        bootloaderMode = false;
        reconnectTries = 0;
        autoReconnect = false;
        icon = pxt.appTarget.appTheme.downloadDialogTheme?.deviceIcon || "usb";
        msgs = new U.PromiseBuffer<Uint8Array>()
        eventHandlers: pxt.Map<(buf: Uint8Array) => void> = {}
        jacdacAvailable = false

        onSerial = (buf: Uint8Array, isStderr: boolean) => { };
        onCustomEvent = (type: string, payload: Uint8Array) => { };
        onConnectionChanged = () => { };

        private resetState() {
            ++this.connectionId;
            this.initialized = false
            this.frames = [];
            this.info = null
            this.infoRaw = null
            this.pageSize = null
            this.flashSize = null
            this.maxMsgSize = 63
            this.familyID = 0;
            this.jacdacAvailable = false;
            this.bootloaderMode = false
            this.msgs.drain()
            this.io.onConnectionChanged();
        }

        private checkOperation(operationId: number): void {
            if (operationId !== this.operationId) throw new Error("Download cancelled");
        }

        private checkConnection(connectionId: number): void {
            if (connectionId !== this.connectionId) throw new Error("Disconnected");
        }

        onEvent(id: number, f: (buf: Uint8Array) => void) {
            U.assert(!!(id & HF2_EV_MASK))
            this.eventHandlers[id + ""] = f
        }

        sendCustomEventAsync(type: string, payload: Uint8Array): Promise<void> {
            if (type == CUSTOM_EV_JACDAC)
                if (this.jacdacAvailable)
                    return this.talkAsync(HF2_CMD_JDS_SEND, payload)
                        .then(() => { })
                else
                    return Promise.resolve() // ignore
            return Promise.reject(new Error("invalid custom event type"))
        }

        isConnected(): boolean {
            return this.io.isConnected() && this.initialized
        }

        isConnecting(): boolean {
            return !!this.reconnectPromise || !!this.switchingPromise || this.io.isConnecting() || (this.io.isConnected() && !this.initialized)
        }

        reconnectAsync(): Promise<void> {
            if (this.flashing) return Promise.reject(new Error("A download is already in progress"));
            return this.reconnectCoreAsync(this.expectAppMode ? false : undefined);
        }

        private isUnsupportedCommandError(error: Error): boolean {
            return error instanceof ProtocolError ? error.status === HF2_STATUS_INVALID_CMD :
                // The legacy HID bridge transports error messages, not Error subclasses.
                !!this.io.talksAsync && /\binvalid command\b/.test(error.message);
        }

        private reconnectCoreAsync(bootloaderMode?: boolean): Promise<void> {
            if (this.reconnectPromise) return this.reconnectPromise;
            const operationId = this.operationId;
            this.reconnectPromise = Promise.resolve().then(() => this.reconnectLoopAsync(operationId, bootloaderMode))
                .finally(() => {
                    this.reconnectPromise = undefined;
                    this.io.onConnectionChanged();
                });
            return this.reconnectPromise;
        }

        private async reconnectLoopAsync(operationId: number, bootloaderMode?: boolean): Promise<void> {
            log(`reconnect raw=${this.rawMode}`);
            // Re-enumeration (particularly through Windows/hubs) can take several
            // seconds. Each attempt must enumerate afresh, not reuse an old device list.
            const deadline = Date.now() + 10000;
            this.reconnectTries = 0;
            while (true) {
                this.checkOperation(operationId);
                this.resetState();
                try {
                    await this.io.reconnectAsync();
                    this.checkOperation(operationId);
                    await this.initAsync();
                    this.checkOperation(operationId);
                    if (bootloaderMode !== undefined && this.bootloaderMode !== bootloaderMode)
                        throw new Error(bootloaderMode ? "Device is not in bootloader mode" : "Device is still in bootloader mode");
                    this.reconnectTries = 0;
                    if (bootloaderMode === false) this.expectAppMode = false;
                    return;
                } catch (e) {
                    this.checkOperation(operationId);
                    this.resetState();
                    await this.io.disconnectAsync();
                    this.checkOperation(operationId);
                    if (Date.now() >= deadline) throw e;
                    log(`error ${e.message}; reconnecting attempt #${++this.reconnectTries}`);
                    await U.delay(500);
                }
            }
        }

        async disconnectAsync(): Promise<void> {
            log(`disconnect`);
            ++this.operationId;
            this.autoReconnect = false;
            this.resetState();
            await this.io.disconnectAsync();
            // A cancelled reconnect must settle before a new owner can reuse the IO.
            if (this.reconnectPromise) await this.reconnectPromise.catch(() => { });
        }

        error(m: string) {
            return this.io.error(m)
        }

        talkAsync(cmd: number, data?: Uint8Array, responseTimeout = cmd === HF2_CMD_WRITE_FLASH_PAGE ? 5000 : 1000): Promise<Uint8Array> {
            const connectionId = this.connectionId;
            // HF2 permits only one outstanding command, not just one packet sender.
            // Keep this queue across resets so old queued work cannot interleave with init.
            return this.lock.enqueue("talk", async () => {
                this.checkConnection(connectionId);
                const result = await this.talkCoreAsync(cmd, data, responseTimeout);
                this.checkConnection(connectionId);
                return result;
            });
        }

        private talkCoreAsync(cmd: number, data: Uint8Array, responseTimeout: number): Promise<Uint8Array> {
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
            let deadline: number;
            let handleReturnAsync = (): Promise<Uint8Array> =>
                this.msgs.shiftAsync(Math.max(1, deadline - Date.now()))
                    .then(res => {
                        if (read16(res, 0) != seq) {
                            if (Date.now() < deadline) {
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
                                throw new ProtocolError(res[2], "invalid command" + info);
                            case HF2_STATUS_EXEC_ERR:
                                throw new ProtocolError(res[2], "execution error" + info);
                            default:
                                throw new ProtocolError(res[2], "error " + res[2] + info);
                        }
                    })

            return this.sendMsgAsync(pkt)
                .then(() => {
                    deadline = Date.now() + responseTimeout;
                    return handleReturnAsync();
                });
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
            const connectionId = this.connectionId;
            let frame = new Uint8Array(64)
            let loop = (pos: number): Promise<void> => {
                this.checkConnection(connectionId);
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
                return U.promiseTimeout(5000, this.io.sendPacketAsync(frame), "HF2 send timed out")
                    .catch(async e => {
                        if (e === "HF2 send timed out") {
                            if (connectionId === this.connectionId) {
                                // Invalidate queued serial/command traffic before the
                                // output queue is released; native OUT may still be pending.
                                this.resetState();
                                await this.io.disconnectAsync();
                            }
                            throw new Error("Timeout");
                        }
                        throw e;
                    })
                    .then(() => loop(pos + len))
            }
            return this.lock.enqueue("out", async () => loop(0))
        }

        switchToBootloaderAsync(): Promise<void> {
            if (!this.switchingPromise) {
                const operationId = this.operationId;
                this.switchingPromise = Promise.resolve().then(() => this.switchToBootloaderCoreAsync(operationId))
                    .finally(() => this.switchingPromise = undefined);
            }
            return this.switchingPromise;
        }

        private async switchToBootloaderCoreAsync(operationId: number): Promise<void> {
            this.checkOperation(operationId);
            await this.maybeReconnectAsync();
            this.checkOperation(operationId);
            if (this.bootloaderMode) return;

            log("Switching into bootloader mode");
            this.io.isSwitchingToBootloader?.();
            try {
                await this.talkAsync(HF2_CMD_START_FLASH);
                this.checkOperation(operationId);
                // Some boards hand USB directly to the bootloader; others acknowledge
                // START_FLASH and then re-enumerate. The acknowledgement alone is not
                // proof that the current connection is ready for flash writes.
                await this.initAsync();
                this.checkOperation(operationId);
                if (this.bootloaderMode) return;
            } catch (e) {
                this.checkOperation(operationId);
                log("handover requires reconnect: " + e.message);
            }

            if (this.io.isConnected()) {
                try {
                    await this.talkAsync(HF2_CMD_RESET_INTO_BOOTLOADER);
                } catch (e) {
                    this.checkOperation(operationId);
                    // Reset normally disconnects without responding. An explicit
                    // protocol rejection, however, must not be reported as success.
                    if (e instanceof ProtocolError) throw e;
                }
            }
            this.checkOperation(operationId);
            try {
                await this.reconnectCoreAsync(true);
            } catch (e) {
                if (e.type === "devicenotfound") e.type = "repairbootloader";
                throw e;
            }
        }

        isFlashing(): boolean {
            return !!this.flashing;
        }

        async reflashAsync(resp: pxtc.CompileResult, progressCallback?: (percentageComplete: number) => void): Promise<void> {
            log(`reflash`)
            U.assert(pxt.appTarget.compile.useUF2);
            const f = resp.outfiles[pxtc.BINARY_UF2];
            if (!f) throw new Error("Missing UF2 output");
            const bytes = pxt.Util.stringToUint8Array(atob(f));
            const blocks = pxtc.UF2.parseFile(bytes);
            // parseFile deliberately ignores bad blocks for other consumers. A
            // download must not silently flash a truncated/corrupt subset instead.
            if (!bytes.length || bytes.length % 512 || blocks.length * 512 !== bytes.length ||
                blocks.some((block, index) => block.payloadSize !== read32(bytes, index * 512 + 16)))
                throw new Error("Invalid UF2 output");
            await this.flashAsync(blocks, progressCallback);
        }

        writeWordsAsync(addr: number, words: number[]) {
            U.assert(words.length <= 64) // just sanity check
            return this.talkAsync(HF2_CMD_WRITE_WORDS,
                encodeU32LE([addr, words.length].concat(words)))
                .then(() => { })
        }

        readWordsAsync(addr: number, numwords: number) {
            let args = new Uint8Array(8)
            write32(args, 0, addr)
            write32(args, 4, numwords)
            U.assert(numwords <= 64) // just sanity check
            return this.talkAsync(HF2_CMD_READ_WORDS, args)
                .then(buf => {
                    if (buf.length !== numwords * 4) this.error("invalid memory read length");
                    return buf;
                });
        }

        pingAsync() {
            if (this.rawMode)
                return Promise.resolve()
            return this.talkAsync(HF2_CMD_BININFO)
                .then(buf => { })
        }

        maybeReconnectAsync() {
            const operationId = this.operationId;
            if (!this.isConnected()) return this.reconnectCoreAsync();
            return this.pingAsync()
                .catch(e => {
                    this.checkOperation(operationId);
                    return this.reconnectCoreAsync();
                });
        }

        async flashAsync(blocks: pxtc.UF2.Block[], progressCallback?: (percentageComplete: number) => void): Promise<void> {
            if (this.flashing) throw new Error("A download is already in progress");
            blocks = blocks.filter(b => !(b.flags & (pxtc.UF2.UF2_FLAG_NOFLASH | pxtc.UF2.UF2_FLAG_FILE)));
            if (!blocks.length || blocks.some(b => !b.payloadSize || b.payloadSize !== b.data.length ||
                b.payloadSize % 4 || b.targetAddr % 4))
                throw new Error("Invalid UF2 flash blocks");

            const operationId = this.operationId;
            const start = Date.now();
            this.flashing = true;
            this.expectAppMode = false;
            try {
                progressCallback?.(0);
                await this.switchToBootloaderAsync();
                this.checkOperation(operationId);
                if (blocks.some(b => (b.familyId && this.familyID && b.familyId !== this.familyID) ||
                    b.payloadSize + 12 > this.maxMsgSize))
                    this.error("UF2 does not match the connected device");

                let toWrite = blocks;
                if (this.pageSize <= 16 * 1024) {
                    try {
                        toWrite = await onlyChangedBlocksAsync(blocks, (a, l) => this.readWordsAsync(a, l));
                    } catch (e) {
                        // READ_WORDS is optional. Unsupported checksum reads should
                        // disable the optimization, not prevent a full download.
                        if (!this.isUnsupportedCommandError(e)) throw e;
                        log("checksum reads unsupported; performing full flash");
                    }
                }
                this.checkOperation(operationId);
                log(`Starting flash (${toWrite.length} blocks, ${blocks.length - toWrite.length} unchanged).`);
                let lastProgress = 0;
                for (let i = 0; i < toWrite.length; ++i) {
                    this.checkOperation(operationId);
                    const b = toWrite[i];
                    const buf = new Uint8Array(4 + b.payloadSize);
                    write32(buf, 0, b.targetAddr);
                    U.memcpy(buf, 4, b.data, 0, b.payloadSize);
                    await this.talkAsync(HF2_CMD_WRITE_FLASH_PAGE, buf);
                    this.checkOperation(operationId);
                    const progress = Math.floor(99 * (i + 1) / toWrite.length);
                    if (progress !== lastProgress) {
                        lastProgress = progress;
                        progressCallback?.(progress / 100);
                    }
                }

                // Some bootloaders ACK before writing. A single subsequent command
                // is a completion barrier without the USB cost of reading back the
                // entire image. This confirms mode/readiness, not byte verification.
                const binfo = await this.talkAsync(HF2_CMD_BININFO, undefined, 5000);
                this.checkOperation(operationId);
                if (binfo.length < 16 || read32(binfo, 0) !== HF2_MODE_BOOTLOADER)
                    this.error("device left bootloader mode during download");
                log(`Flashing done in ${Date.now() - start}ms. Resetting.`);
                try {
                    await this.talkAsync(HF2_CMD_RESET_INTO_APP);
                } catch (e) {
                    this.checkOperation(operationId);
                    if (e instanceof ProtocolError) throw e;
                    // Reset commands normally disconnect without a response.
                }
                this.checkOperation(operationId);
                this.expectAppMode = true;
                progressCallback?.(1);
            } finally {
                // Retire bootloader reads even on failure. The caller owns the single
                // reconnect into the app; keep flashing set until cleanup is finished.
                this.resetState();
                try {
                    await this.io.disconnectAsync();
                } finally {
                    this.flashing = false;
                }
            }
        }

        private initAsync() {
            if (this.rawMode) {
                this.initialized = true
                return Promise.resolve()
            }

            const connectionId = this.connectionId;
            return Promise.resolve()
                .then(() => this.talkAsync(HF2_CMD_BININFO))
                .then(binfo => {
                    const mode = read32(binfo, 0);
                    if (binfo.length < 16 || (binfo.length > 16 && binfo.length < 20) ||
                        (mode !== HF2_MODE_BOOTLOADER && mode !== HF2_MODE_USERSPACE))
                        this.error("invalid bootloader information");
                    this.bootloaderMode = mode === HF2_MODE_BOOTLOADER;
                    this.pageSize = read32(binfo, 4)
                    this.flashSize = read32(binfo, 8) * this.pageSize
                    this.maxMsgSize = read32(binfo, 12)
                    this.familyID = read32(binfo, 16)
                    if (!this.maxMsgSize || (this.bootloaderMode && (!this.pageSize || !this.flashSize)))
                        this.error("invalid flash geometry");
                    log(`Connected; msgSize ${this.maxMsgSize}B; flash ${this.flashSize / 1024}kB; ${this.bootloaderMode ? "bootloader" : "application"} mode; family=0x${this.familyID.toString(16)}`)
                    return this.talkAsync(HF2_CMD_INFO)
                })
                .then(buf => {
                    this.infoRaw = pxt.Util.fromUTF8Array(buf);
                    pxt.debug("Info: " + this.infoRaw)
                    let info = {} as any
                    ("Header: " + this.infoRaw).replace(/^([\w\-]+):\s*([^\n\r]*)/mg,
                        (f, n, v) => {
                            info[n.replace(/-/g, "")] = v
                            return ""
                        })
                    this.info = info
                    let m = /v(\d\S+)(\s+(\S+))?/.exec(this.info.Header)
                    if (m)
                        this.info.Parsed = {
                            Version: m[1],
                            Features: m[3] || "",
                        }
                    else
                        this.info.Parsed = {
                            Version: "?",
                            Features: "",
                        }
                    log(`Board-ID: ${this.info.BoardID} v${this.info.Parsed.Version} f${this.info.Parsed.Features}`)
                })
                .then(() => {
                    this.jacdacAvailable = false;
                    if (this.bootloaderMode) return Promise.resolve();
                    return this.talkAsync(HF2_CMD_JDS_CONFIG, new Uint8Array([1]))
                        .then(() => {
                            this.jacdacAvailable = true;
                        }, err => {
                            // Jacdac support is optional in older application firmware.
                            // Preserve that compatibility, but never mask a lost session.
                            this.checkConnection(connectionId);
                            if (!this.io.isConnected()) throw err;
                        });
                })
                .then(() => {
                    this.checkConnection(connectionId);
                    this.reconnectTries = 0
                    this.initialized = true
                    this.io.onConnectionChanged()
                })
        }

    }

    export function mkHF2PacketIOWrapper(io: pxt.packetio.PacketIO): pxt.packetio.PacketIOWrapper {
        pxt.debug(`packetio: wrapper hf2`)
        return new Wrapper(io);
    }

    export type ReadAsync = (addr: number, len: number) => Promise<ArrayLike<number>>
    function readChecksumBlockAsync(readWordsAsync: ReadAsync): Promise<pxtc.ChecksumBlock> {
        if (!pxt.appTarget.compile.flashChecksumAddr)
            return Promise.resolve(null as pxtc.ChecksumBlock)
        return readWordsAsync(pxt.appTarget.compile.flashChecksumAddr, 12)
            .then(buf => {
                let blk = pxtc.parseChecksumBlock(buf)
                if (!blk)
                    return null
                return readWordsAsync(blk.endMarkerPos, 1)
                    .then(w => {
                        if (read32(w, 0) != blk.endMarker) {
                            pxt.log("end-marker mismatch")
                            return null
                        }
                        return blk
                    })
            })
    }

    export function onlyChangedBlocksAsync(blocks: pxtc.UF2.Block[], readWordsAsync: ReadAsync) {
        if (!pxt.appTarget.compile.flashChecksumAddr)
            return Promise.resolve(blocks)
        let blBuf = pxtc.UF2.readBytes(blocks, pxt.appTarget.compile.flashChecksumAddr, 12 * 4)
        let blChk = pxtc.parseChecksumBlock(blBuf)
        if (!blChk)
            return Promise.resolve(blocks)
        return readChecksumBlockAsync(readWordsAsync)
            .then(devChk => {
                if (!devChk)
                    return blocks
                let regionsOk = devChk.regions.filter(r => {
                    let hasMatching = blChk.regions.some(r2 =>
                        r.checksum == r2.checksum &&
                        r.length == r2.length &&
                        r.start == r2.start)
                    return hasMatching
                })
                if (regionsOk.length == 0)
                    return blocks
                log("skipping flash at: " +
                    regionsOk.map(r =>
                        `${pxtc.assembler.tohex(r.start)} (${r.length / 1024}kB)`)
                        .join(", "))
                let unchangedAddr = (a: number) =>
                    regionsOk.some(r => r.start <= a && a < r.start + r.length)
                return blocks.filter(b =>
                    !(unchangedAddr(b.targetAddr) &&
                        unchangedAddr(b.targetAddr + b.payloadSize - 1)))
            })
    }
}
