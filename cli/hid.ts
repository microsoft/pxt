import HF2 = pxt.HF2
import U = pxt.U
import * as nodeutil from './nodeutil';

function useWebUSB() {
    return !!pxt.appTarget.compile.webUSB
}

let HID: any = undefined;
function requireHID(install?: boolean): boolean {
    if (useWebUSB()) {
        // in node.js, we need "webusb" package
        if (pxt.Util.isNodeJS)
            return !!nodeutil.lazyRequire("webusb", install);
        // in the browser, check that USB is defined
        return pxt.usb.isAvailable();
    }
    else {
        if (!HID)
            HID = nodeutil.lazyRequire("node-hid", install);
        return !!HID;
    }
}

export function isInstalled(install?: boolean): boolean {
    return requireHID(!!install);
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
    if (!requireHID(true))
        return Promise.resolve();
    return getHF2DevicesAsync()
        .then(devices => {
            pxt.log(`found ${devices.length} HID devices`);
            devices.forEach(device => pxt.log(device));
        })
}

export function serialAsync() {
    if (!requireHID(true))
        return Promise.resolve();
    return initAsync()
        .then(d => {
            d.autoReconnect = true
            connectSerial(d)
        })
}

export function dmesgAsync() {
    HF2.enableLog()
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

function getHF2Devices(): HidDevice[] {
    if (!requireHID(false))
        return [];
    let devices = HID.devices() as HidDevice[]
    for (let d of devices) {
        pxt.debug(JSON.stringify(d))
    }
    let serial = pxt.appTarget.serial
    return devices.filter(d =>
        (serial && parseInt(serial.productId) == d.productId && parseInt(serial.vendorId) == d.vendorId) ||
        (d.release & 0xff00) == 0x4200)
}

export function getHF2DevicesAsync(): Promise<HidDevice[]> {
    return Promise.resolve(getHF2Devices());
}

function handleDevicesFound(devices: any[], selectFn: any) {
    if (devices.length > 1) {
        let d42 = devices.filter(d => d.deviceVersionMajor == 42)
        if (d42.length > 0)
            devices = d42
    }
    devices.forEach((device: any) => {
        console.log(`DEV: ${device.productName || device.serialNumber}`);
    });
    selectFn(devices[0])
}

export function hf2ConnectAsync(path: string, raw = false) {
    if (useWebUSB()) {
        const g = global as any
        if (!g.navigator)
            g.navigator = {}
        if (!g.navigator.usb) {
            const webusb = nodeutil.lazyRequire("webusb", true)
            const load = webusb.USBAdapter.prototype.loadDevice;
            webusb.USBAdapter.prototype.loadDevice = function (device: any) {
                // skip class 9 - USB HUB, as it causes SEGV on Windows
                if (device.deviceDescriptor.bDeviceClass == 9)
                    return Promise.resolve(null)
                return load.apply(this, arguments)
            }
            const USB = webusb.USB
            g.navigator.usb = new USB({
                devicesFound: handleDevicesFound
            })
        }

        return pxt.usb.pairAsync()
            .then(() => pxt.usb.mkPacketIOAsync())
            .then(io => new HF2.Wrapper(io))
            .then(d => d.reconnectAsync().then(() => d))
    }


    if (!requireHID(true)) return Promise.resolve(undefined);
    // in .then() to make sure we catch errors
    let h = new HF2.Wrapper(new HidIO(path))
    h.rawMode = raw
    return h.reconnectAsync(true).then(() => h)
}

export function mkPacketIOAsync() {
    if (useWebUSB())
        return hf2ConnectAsync("")
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
        U.assert(requireHID(false))
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


