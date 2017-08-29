import HF2 = pxt.HF2
import U = pxt.U
import * as commandParser from './commandparser';

let HID: any = undefined;
function getHID(): any {
    if (HID === undefined) {
        try {
            HID = require("node-hid")
        } catch (e) {
            pxt.log('node-hid failed to load, ignoring...')
            HID = null;
        }
    }
    return HID;
}

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
    return initAsync()
        .then(d => {
            connectSerial(d)
        })
}

export function dmesgAsync() {
    return initAsync()
        .then(d => d.talkAsync(pxt.HF2.HF2_CMD_DMESG)
            .then(resp => {
                console.log(U.fromUTF8(U.uint8ArrayToString(resp)))
                return d.disconnectAsync()
            }))
}

function hex(n: number) {
    return ("000" + n.toString(16)).slice(-4)
}

export function deviceInfo(h: HidDevice) {
    return `${h.product} (by ${h.manufacturer} at USB ${hex(h.vendorId)}:${hex(h.productId)})`
}

export function getHF2Devices() {
    const hid = getHID();
    if (!hid) return [];
    let devices = hid.devices() as HidDevice[]
    let serial = pxt.appTarget.serial
    return devices.filter(d =>
        (serial && parseInt(serial.productId) == d.productId && parseInt(serial.vendorId) == d.vendorId) ||
        (d.release & 0xff00) == 0x4200)
}

export function hf2ConnectAsync(path: string, raw = false) {
    return Promise.resolve()
        .then(() => {
            // in .then() to make sure we catch errors
            let h = new HF2.Wrapper(new HidIO(path))
            h.rawMode = raw
            return h.reconnectAsync(true).then(() => h)
        })
}

export function mkPacketIOAsync() {
    return Promise.resolve()
        .then(() => {
            // in .then() to make sure we catch errors
            return new HidIO(null)
        })
}

pxt.HF2.mkPacketIOAsync = mkPacketIOAsync

let hf2Dev: Promise<HF2.Wrapper>
export function initAsync(path: string = null): Promise<HF2.Wrapper> {
    if (!hf2Dev) {
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
    private path: string;

    onData = (v: Uint8Array) => { };
    onEvent = (v: Uint8Array) => { };
    onError = (e: Error) => { };

    constructor(private requestedPath: string) {
        this.connect()
    }

    private connect() {
        const hid = getHID();
        U.assert(hid)

        if (this.requestedPath == null) {
            let devs = getHF2Devices()
            if (devs.length == 0)
                throw new HIDError("no devices found")
            this.path = devs[0].path
        } else {
            this.path = this.requestedPath
        }

        this.dev = new HID.HID(this.path)
        this.dev.on("data", (v: Buffer) => {
            //console.log("got", v.toString("hex"))
            this.onData(new Uint8Array(v))
        })
        this.dev.on("error", (v: Error) => this.onError(v))
    }

    sendPacketAsync(pkt: Uint8Array): Promise<void> {
        //console.log("SEND: " + new Buffer(pkt).toString("hex"))
        return Promise.resolve()
            .then(() => {
                let lst = [0]
                for (let i = 0; i < Math.max(64, pkt.length); ++i)
                    lst.push(pkt[i] || 0)
                this.dev.write(lst)
            })
    }

    error(msg: string): any {
        let fullmsg = "HID error on " + this.path + ": " + msg
        console.error(fullmsg)
        throw new HIDError(fullmsg)
    }

    disconnectAsync(): Promise<void> {
        if (!this.dev) return Promise.resolve()

        // see https://github.com/node-hid/node-hid/issues/61
        this.dev.removeAllListeners("data");
        this.dev.removeAllListeners("error");
        let pkt = new Uint8Array([0x48])
        this.sendPacketAsync(pkt).catch(e => { })
        return Promise.delay(100)
            .then(() => {
                if (this.dev) {
                    this.dev.close()
                    this.dev = null
                }
            })
    }

    reconnectAsync(): Promise<void> {
        return this.disconnectAsync()
            .then(() => {
                this.connect()
            })
    }
}


