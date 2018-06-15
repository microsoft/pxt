namespace pxt.worker {
    import Cloud = pxt.Cloud;
    import U = pxt.Util;

    let workers: pxt.Map<Iface> = {};

    // Gets a cached worker for the given file
    export function getWorker(workerFile: string): Iface {
        let w = workers[workerFile];
        if (!w) {
            w = workers[workerFile] = makeWebWorker(workerFile);
        }
        return w;
    }

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
                        //pxt.reportError("worker", "no response")
                        reject(new Error("no response"))
                    } else if (v.errorMessage) {
                        //pxt.reportError("worker", v.errorMessage)
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

    export function makeWebSocket(url: string, onOOB: (v: any) => void = null) {
        let ws = new WebSocket(url)
        let sendq: string[] = []
        let iface = wrap(v => {
            let s = JSON.stringify(v)
            if (sendq) sendq.push(s)
            else ws.send(s)
        })
        ws.onmessage = ev => {
            let js = JSON.parse(ev.data)
            if (onOOB && js.id == null) {
                onOOB(js)
            } else {
                iface.recvHandler(js)
            }
        }
        ws.onopen = (ev) => {
            pxt.debug('socket opened');
            for (let m of sendq) ws.send(m)
            sendq = null
        }
        ws.onclose = (ev) => {
            pxt.debug('socket closed')
        }
        ws.onerror = (ev) => {
            pxt.debug('socket errored')
        }
        return iface
    }
}