import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"

import Cloud = pxt.Cloud;
import U = pxt.Util;

export interface Iface {
    opAsync: (op: string, arg: any) => Promise<any>;
}

export function make(workerFile: string) {
    let tsWorker: Worker;
    let pendingMsgs: U.StringMap<(v: any) => void> = {}
    let msgId = 0;
    let q = new U.PromiseQueue();

    let initPromise = new Promise<void>((resolve, reject) => {
        pendingMsgs["ready"] = resolve;
    })
    q.enqueue("main", () => initPromise)

    tsWorker = new Worker(workerFile)
    tsWorker.onmessage = ev => {
        if (pendingMsgs.hasOwnProperty(ev.data.id)) {
            let cb = pendingMsgs[ev.data.id]
            delete pendingMsgs[ev.data.id]
            cb(ev.data.result)
        }
    }

    function opAsync(op: string, arg: any) {
        return q.enqueue("main", () => new Promise<any>((resolve, reject) => {
            let id = "" + msgId++
            pendingMsgs[id] = v => {
                if (!v) {
                    pxt.reportError("no worker response", null)
                    reject(new Error("no response"))
                } else if (v.errorMessage) {
                    pxt.reportError("worker response: " + v.errorMessage, null)
                    reject(new Error(v.errorMessage))
                } else {
                    resolve(v)
                }
            }
            tsWorker.postMessage({ id, op, arg })
        }))
    }

    return { opAsync }
}

