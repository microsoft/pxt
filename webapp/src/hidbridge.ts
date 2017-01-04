import * as core from "./core";
import * as workeriface from "./workeriface"

import Cloud = pxt.Cloud;
import U = pxt.Util;

let iface: workeriface.Iface
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

function init() {
    if (!iface) {
        if (!Cloud.isLocalHost() || !Cloud.localToken)
            return;
        pxt.debug('initializing hid pipe');
        iface = workeriface.makeWebSocket(`ws://localhost:${pxt.options.wsPort}/${Cloud.localToken}/hid`, true)
    }
}

export function shouldUse() {
    return pxt.appTarget.serial && pxt.appTarget.serial.useHF2 && Cloud.isLocalHost() && !!Cloud.localToken
}

export function mkBridgeAsync(): Promise<pxt.HF2.PacketIO> {
    init()
    return iface.opAsync("list", {})
        .then((devs: any) => {
            let d0 = (devs.devices as HidDevice[]).filter(d => (d.release & 0xff00) == 0x4200)[0]
            if (d0) return new BridgeIO(d0)
            else throw new Error("No device connected")
        })
}

class BridgeIO implements pxt.HF2.PacketIO {
    constructor(public dev: HidDevice) {
    }

    error(msg: string) {
        throw new HIDError(U.lf("USB/HID error on device {0} ({1})", this.dev.product, msg))
    }

    reconnectAsync() {
        return this.initAsync()
            .then(() => this)
    }

    sendPacketAsync(pkt: Uint8Array) {
        Util.assert(pkt.length <= 64)
        return iface.opAsync("send", {
            path: this.dev.path,
            data: U.toHex(pkt)
        })
    }

    recvPacketAsync(): Promise<Uint8Array> {
        return iface.opAsync("recv", {
            path: this.dev.path
        }).then((resp: any) => {
            return U.fromHex(resp.data)
        })
    }

    initAsync() {
        return iface.opAsync("init", {
            path: this.dev.path
        })
    }
}

function hf2Async() {
    return mkBridgeAsync()
        .then(h => {
            let w = new pxt.HF2.Wrapper(h)
            return w.reconnectAsync(true)
                .then(() => w)
        })
}

let initPromise: Promise<pxt.HF2.Wrapper>
export function initAsync() {
    if (!initPromise)
        initPromise = hf2Async()
    return initPromise
}
