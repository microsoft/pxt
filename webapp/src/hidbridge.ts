import Cloud = pxt.Cloud;
import U = pxt.Util;

let iface: pxt.worker.Iface

interface HidDevice {
    vendorId: number; // 9025,
    productId: number; // 589,
    path: string;
    serialNumber: string; // '',
    manufacturer: string; // 'Arduino LLC',
    product: string; // 'Arduino Zero',
    release: number; // 0x4201
}

export class HIDError extends Error {
    constructor(msg: string) {
        super(msg)
        this.message = msg
    }
}

let bridgeByPath: pxt.Map<BridgeIO> = {}

interface OOB {
    op: string;
    result: {
        path: string;
        data?: string;
        isError?: boolean;
        errorMessage?: string;
        errorStackTrace?: string;
    }
}

function onOOB(v: OOB) {
    let b = U.lookup(bridgeByPath, v.result.path)
    if (b) {
        b.onOOB(v)
    } else {
        console.error("Dropping data for " + v.result.path)
    }
}

function init() {
    if (!iface) {
        if (!pxt.BrowserUtils.isLocalHost() || !Cloud.localToken)
            return;
        pxt.debug('initializing hid pipe');
        iface = pxt.worker.makeWebSocket(
            `ws://localhost:${pxt.options.wsPort}/${Cloud.localToken}/hid`, onOOB)
    }
}

export function shouldUse() {
    let serial = pxt.appTarget.serial
    return serial && serial.useHF2 && (pxt.BrowserUtils.isLocalHost() && !!Cloud.localToken || pxt.winrt.isWinRT());
}

export function mkBridgeAsync(): Promise<pxt.packetio.PacketIO> {
    init()
    let raw = false
    if (pxt.appTarget.serial && pxt.appTarget.serial.rawHID)
        raw = true
    let b = new BridgeIO(raw)
    return b.initAsync()
        .then(() => b);
}

class BridgeIO implements pxt.packetio.PacketIO {
    onDeviceConnectionChanged = (connect: boolean) => { };
    onConnectionChanged = () => { };
    onData = (v: Uint8Array) => { };
    onEvent = (v: Uint8Array) => { };
    onError = (e: Error) => { };
    onSerial = (v: Uint8Array, isErr: boolean) => { };
    public dev: HidDevice;
    private connected: boolean;
    private connecting = false;

    constructor(public rawMode = false) {
        if (rawMode)
            this.onEvent = v => this.onData(v)
    }

    disposeAsync(): Promise<void> {
        return Promise.resolve();
    }

    isConnecting(): boolean {
        return this.connecting;
    }

    isConnected(): boolean {
        return !!this.dev && this.connected;
    }

    onOOB(v: OOB) {
        if (v.op == "serial") {
            this.onSerial(U.fromHex(v.result.data), v.result.isError)
        } else if (v.op == "event") {
            this.onEvent(U.fromHex(v.result.data))
        }
    }

    talksAsync(cmds: pxt.packetio.TalkArgs[]): Promise<Uint8Array[]> {
        return iface.opAsync("talk", {
            path: this.dev.path,
            cmds: cmds.map(c => ({ cmd: c.cmd, data: c.data ? U.toHex(c.data) : "" }))
        })
            .then(resp => {
                return resp.map((v: any) => U.fromHex(v.data))
            })
    }

    error(msg: string) {
        this.connected = false;
        throw new HIDError(U.lf("USB/HID error on device {0} ({1})", this.dev.product, msg))
    }

    reconnectAsync(): Promise<void> {
        return this.initAsync()
    }

    disconnectAsync(): Promise<void> {
        this.connected = false;
        return iface.opAsync("disconnect", {
            path: this.dev.path
        }).finally(() => {
            if (this.onConnectionChanged)
                this.onConnectionChanged();
        })
    }

    sendPacketAsync(pkt: Uint8Array): Promise<void> {
        if (this.rawMode)
            return iface.opAsync("send", {
                path: this.dev.path,
                data: U.toHex(pkt),
                raw: true
            })
        throw new Error("should use talksAsync()!")
    }

    sendSerialAsync(buf: Uint8Array, useStdErr: boolean): Promise<void> {
        return iface.opAsync("sendserial", {
            path: this.dev.path,
            data: U.toHex(buf),
            isError: useStdErr
        })
    }

    initAsync(): Promise<void> {
        this.connected = false;
        this.connecting = true;
        return iface.opAsync("list", {})
            .then((devs0: any) => {
                let devs = devs0.devices as HidDevice[]
                let d0 = devs.filter(d => (d.release & 0xff00) == 0x4200)[0]
                if (pxt.appTarget.serial && pxt.appTarget.serial.rawHID)
                    d0 = devs[0]
                if (d0) {
                    if (this.dev)
                        delete bridgeByPath[this.dev.path]
                    this.dev = d0
                    bridgeByPath[this.dev.path] = this
                }
                else throw new Error("No device connected")
            })
            .then(() => iface.opAsync("init", {
                path: this.dev.path,
                raw: this.rawMode,
            }))
            .then(() => {
                this.connected = true;
            })
            .finally(() => {
                this.connecting = false;
                if (this.onConnectionChanged)
                    this.onConnectionChanged();
            })
    }
}
