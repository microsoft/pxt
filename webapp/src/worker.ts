importScripts(
    "/cdn/typescript.js",
    "/cdn/pxtlib.js"
)

let pm : any = postMessage;

onmessage = ev => {
    let res = ts.pxt.service.performOperation(ev.data.op, ev.data.arg)
    pm({
        op: ev.data.op,
        id: ev.data.id,
        result: res
    })
}

pm({
    id: "ready"
})
