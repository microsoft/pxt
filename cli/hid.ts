import HF2 = pxt.HF2
import U = pxt.U
import * as commandParser from './commandparser';

let HID: any

export interface HidDevice {
    vendorId: number; // 9025,
    productId: number; // 589,
    path: string; //.../UF2-HID@...
    serialNumber: string; // '',
    manufacturer: string; // 'Arduino',
    product: string; // 'Zero',
    release: number; // 0x4201
}

export function listAsync() {
    for (let h of getHF2Devices())
        console.log(deviceInfo(h))
    return Promise.resolve()
}

export function serialAsync() {
    return hf2DeviceAsync()
        .then(d => {
            connectSerial(d)
        })
}

export function deviceInfo(h: HidDevice) {
    return `${h.product}`
}

export function getHF2Devices() {
    if (!HID)
        HID = require("node-hid")
    let devices = HID.devices() as HidDevice[]
    return devices.filter(d => (d.release & 0xff00) == 0x4200)
}

export function startMonitor(sendMsgToListeners: (s: string) => void) {
    let openDevs: pxt.Map<Promise<HF2.Wrapper>> = {};
    const check = () => {
        let devs = getHF2Devices().filter(d => !openDevs[d.path])
        for (let d of devs) {
            openDevs[d.path] = hf2ConnectAsync(d.path)
                .then(w => {
                    w.onSerial = (arr, iserr) => {
                        let buf = new Buffer(arr)
                        let m = {
                            type: 'serial',
                            id: d.path,
                            data: buf.toString('utf8'),
                            isStdError: iserr
                        }
                        sendMsgToListeners(JSON.stringify(m))
                    }
                    return w
                })
        }
    }

    try {
        check()
    } catch (e) {
        console.warn("failed to get HF2 devices: " + e.message)
        return
    }

    setInterval(check, 3000);
}

export function hf2ConnectAsync(path: string) {
    let h = new HF2.Wrapper(new HidIO(path))
    return h.reconnectAsync(true).then(() => h)
}

let hf2Dev: Promise<HF2.Wrapper>
export function hf2DeviceAsync(path: string = null): Promise<HF2.Wrapper> {
    if (!hf2Dev) {
        let devs = getHF2Devices()
        if (devs.length == 0)
            return Promise.reject(new HIDError("no devices found"))
        path = devs[0].path
        hf2Dev = hf2ConnectAsync(path)
    }
    return hf2Dev
}

export function connectSerial(w: HF2.Wrapper) {
    process.stdin.on("data", (buf: Buffer) => {
        w.sendSerialAsync(new Uint8Array(buf)).done()
    })
    w.onSerial = (arr, iserr) => {
        let buf = new Buffer(arr)
        if (iserr) process.stderr.write(buf)
        else process.stdout.write(buf)
    }
}

export class HIDError extends Error {
    constructor(m: string) {
        super(m)
        this.message = m
    }
}

export class HidIO implements HF2.PacketIO {
    dev: any;

    private buf = new U.PromiseBuffer<Uint8Array>();

    constructor(private path: string, public onData: (v: (Buffer | Error)) => void = null) {
        if (!this.onData)
            this.onData = v => {
                if (v instanceof Error)
                    this.buf.pushError(v)
                else
                    this.buf.push(new Uint8Array(v))
            }
        this.connect()
    }

    private connect() {
        this.dev = new HID.HID(this.path)
        this.dev.on("data", (v: any) => this.onData(v))
        this.dev.on("error", (v: any) => this.onData(v))
    }

    sendPacketAsync(pkt: Uint8Array): Promise<void> {
        //console.log("SEND: " + new Buffer(pkt).toString("hex"))
        return Promise.resolve()
            .then(() => {
                let lst = [0]
                for (let i = 0; i < 64; ++i)
                    lst.push(pkt[i] || 0)
                this.dev.write(lst)
            })
    }

    recvPacketAsync(): Promise<Uint8Array> {
        return this.buf.shiftAsync()
    }

    error(msg: string): any {
        let fullmsg = "HID error on " + this.path + ": " + msg
        console.error(fullmsg)
        throw new HIDError(fullmsg)
    }

    reconnectAsync(): Promise<HF2.PacketIO> {
        this.buf.drain()
        // see https://github.com/node-hid/node-hid/issues/61
        this.dev.removeAllListeners("data");
        this.dev.removeAllListeners("error");
        let pkt = new Uint8Array([0x48])
        this.sendPacketAsync(pkt).catch(e => { })
        return Promise.delay(100)
            .then(() => {
                this.dev.close()
                this.connect()
                return this
            })
    }
}


