import * as core from "./core";

import Cloud = pxt.Cloud;
import U = pxt.Util;

let iface: pxt.worker.Iface
let devPath: Promise<string>


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
        if (!Cloud.isLocalHost() || !Cloud.localToken)
            return;
        pxt.debug('initializing hid pipe');
        iface = pxt.worker.makeWebSocket(
            `ws://localhost:${pxt.options.wsPort}/${Cloud.localToken}/hid`, onOOB)
    }
}

export function shouldUse() {
    let serial = pxt.appTarget.serial
    return serial && serial.useHF2 && (Cloud.isLocalHost() && !!Cloud.localToken || pxt.winrt.isWinRT());
}

function mkBridgeAsync(): Promise<pxt.HF2.PacketIO> {
    init()
    let raw = false
    if (pxt.appTarget.serial && pxt.appTarget.serial.rawHID)
        raw = true
    let b = new BridgeIO(raw)
    return b.initAsync()
        .then(() => b);
}

pxt.HF2.mkPacketIOAsync = mkBridgeAsync;

class BridgeIO implements pxt.HF2.PacketIO {
    onData = (v: Uint8Array) => { };
    onEvent = (v: Uint8Array) => { };
    onError = (e: Error) => { };
    onSerial = (v: Uint8Array, isErr: boolean) => { };
    public dev: HidDevice;

    constructor(public rawMode = false) {
        if (rawMode)
            this.onEvent = v => this.onData(v)
    }

    onOOB(v: OOB) {
        if (v.op == "serial") {
            this.onSerial(U.fromHex(v.result.data), v.result.isError)
        } else if (v.op = "event") {
            this.onEvent(U.fromHex(v.result.data))
        }
    }

    talksAsync(cmds: pxt.HF2.TalkArgs[]): Promise<Uint8Array[]> {
        return iface.opAsync("talk", {
            path: this.dev.path,
            cmds: cmds.map(c => ({ cmd: c.cmd, data: c.data ? U.toHex(c.data) : "" }))
        })
            .then(resp => {
                return resp.map((v: any) => U.fromHex(v.data))
            })
    }

    error(msg: string) {
        throw new HIDError(U.lf("USB/HID error on device {0} ({1})", this.dev.product, msg))
    }

    reconnectAsync(): Promise<void> {
        return this.initAsync()
    }

    disconnectAsync(): Promise<void> {
        return iface.opAsync("disconnect", {
            path: this.dev.path
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
    }
}

function hf2Async() {
    return pxt.HF2.mkPacketIOAsync()
        .then(h => {
            let w = new pxt.HF2.Wrapper(h)
            return w.reconnectAsync(true)
                .then(() => w)
        })
}

let initPromise: Promise<pxt.HF2.Wrapper>
export function initAsync(force = false) {
    let isFirstInit = false;
    if (!initPromise) {
        isFirstInit = true;
        initPromise = hf2Async()
            .catch(err => {
                initPromise = null
                return Promise.reject(err)
            })
    }
    let wrapper: pxt.HF2.Wrapper;
    return initPromise
        .then((w) => {
            wrapper = w;
            if (force || pxt.winrt.isWinRT() && !isFirstInit) {
                // For WinRT, disconnecting the device after flashing once puts the wrapper in a bad state.
                // To workaround this, reconnect every time.
                return wrapper.reconnectAsync();
            }
            return Promise.resolve();
        })
        .then(() => wrapper);
}
