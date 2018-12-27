import Cloud = pxt.Cloud;
import U = pxt.Util;
import { isNativeHost } from "./cmds";

let iface: pxt.worker.Iface
let bridgeBySocket: pxt.Map<TCPSocket> = {}

interface OOB {
    op: string;
    result: {
        socket: string;
        data?: string;
        encoding?: string;
    }
}

function onOOB(v: OOB) {
    let b = U.lookup(bridgeBySocket, v.result.socket)
    if (b) {
        b.onOOB(v)
    } else {
        console.error("Dropping data for " + v.result.socket)
    }
}

export function tryInit() {
    if (pxt.BrowserUtils.isLocalHost() && Cloud.localToken) {
        pxt.mkTCPSocket = (h, p) => new TCPSocket(h, p)
    }
}

function init() {
    if (!iface) {
        if (!pxt.BrowserUtils.isLocalHost() || !Cloud.localToken)
            U.userError(lf("TCP sockets not available here"))
        pxt.debug('initializing tcp pipe');
        iface = pxt.worker.makeWebSocket(
            `ws://localhost:${pxt.options.wsPort}/${Cloud.localToken}/tcp`, onOOB)
    }
}

class TCPSocket implements pxt.TCPIO {
    onData = (v: Uint8Array) => { };
    onError = (e: Error) => { };

    sockId: string;

    constructor(public host: string, public port: number) {
    }

    onOOB(v: OOB) {
        if (v.op == "data") {
            const d = U.stringToUint8Array(atob(v.result.data))
            this.onData(d)
        } else if (v.op == "close") {
            this.sockId = null;
            delete bridgeBySocket[v.result.socket]
        }
    }

    error(msg: string) {
        let err = new Error(U.lf("TCP error on socket {0}:{1} ({2})", this.host, this.port, msg))
        this.onError(err)
        throw err
    }

    disconnectAsync(): Promise<void> {
        if (!this.sockId)
            return Promise.resolve()
        return iface.opAsync("close", {
            socket: this.sockId
        }).then(() => {
            this.sockId = null
        })
    }

    sendPacketAsync(pkt: Uint8Array): Promise<void> {
        if (!this.sockId)
            U.userError("Not connected")
        return iface.opAsync("send", {
            socket: this.sockId,
            data: U.toHex(pkt),
            encoding: "hex"
        })
    }

    sendSerialAsync(buf: Uint8Array, useStdErr: boolean): Promise<void> {
        return Promise.reject(new Error("No serial on socket"))
    }

    connectAsync(): Promise<void> {
        init()
        if (this.sockId)
            return Promise.resolve()
        return iface.opAsync("open", { host: this.host, port: this.port })
            .then(res => {
                if (!res.socket)
                    this.error(res.errorMessage)
                this.sockId = res.socket
                bridgeBySocket[this.sockId] = this
            })
    }
}
