importScripts(
    "./typescript.js",
    "./kindlib.js"
)

onmessage = ev => {
    let res = ts.ks.service.performOperation(ev.data.op, ev.data.arg)
    postMessage({
        op: ev.data.op,
        id: ev.data.id,
        result: res
    }, null)
}

postMessage({
    id: "ready"
}, null)
