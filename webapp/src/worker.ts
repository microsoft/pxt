importScripts(
    "./typescript.js",
    "./kindlib.js"
)

let pm : any = postMessage;

onmessage = ev => {
    let res = ts.ks.service.performOperation(ev.data.op, ev.data.arg)
    pm({
        op: ev.data.op,
        id: ev.data.id,
        result: res
    })
}

pm({
    id: "ready"
})
