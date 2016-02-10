importScripts(
    "./typescript.js",
    "./yelmlib.js"
)

onmessage = ev => {
    let res = ts.mbit.service.performOperation(ev.data.op, ev.data.arg)
    postMessage({
        op: ev.data.op,
        id: ev.data.id,
        result: res
    }, null)
}

postMessage({
    id: "ready"
}, null)
