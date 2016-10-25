import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"

import Cloud = pxt.Cloud;
import U = pxt.Util;

export interface Iface {
    opAsync: (op: string, arg: any) => Promise<any>;
    recvHandler: (v: any) => void;
}

export function wrap(send: (v: any) => void): Iface {
    let pendingMsgs: pxt.Map<(v: any) => void> = {}
    let msgId = 0;
    let q = new U.PromiseQueue();

    let initPromise = new Promise<void>((resolve, reject) => {
        pendingMsgs["ready"] = resolve;
    })
    q.enqueue("main", () => initPromise)

    let recvHandler = (data: any) => {
        if (pendingMsgs.hasOwnProperty(data.id)) {
            let cb = pendingMsgs[data.id]
            delete pendingMsgs[data.id]
            cb(data.result)
        }
    };

    function opAsync(op: string, arg: any) {
        return q.enqueue("main", () => new Promise<any>((resolve, reject) => {
            let id = "" + msgId++
            pendingMsgs[id] = v => {
                if (!v) {
                    pxt.reportError("worker", "no response")
                    reject(new Error("no response"))
                } else if (v.errorMessage) {
                    pxt.reportError("worker", "response: " + v.errorMessage)
                    reject(new Error(v.errorMessage))
                } else {
                    resolve(v)
                }
            }
            send({ id, op, arg })
        }))
    }

    return { opAsync, recvHandler }
}

export function makeWebWorker(workerFile: string) {
    let worker = new Worker(workerFile)
    let iface = wrap(v => worker.postMessage(v))
    worker.onmessage = ev => {
        iface.recvHandler(ev.data)
    }
    return iface
}

export function makeWebSocket(url: string) {
    let ws = new WebSocket(url)
    let sendq: string[] = []
    let iface = wrap(v => {
        let s = JSON.stringify(v)
        if (sendq) sendq.push(s)
        else ws.send(s)
    })
    ws.onmessage = ev => {
        iface.recvHandler(JSON.parse(ev.data))
    }
    ws.onopen = (ev) => {
        pxt.debug('socket opened');
        for (let m of sendq) ws.send(m)
        sendq = null
    }
    ws.onclose = (ev) => {
        pxt.debug('socket closed')
    }
    return iface
}
