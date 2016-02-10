importScripts(
    "./typescript.js",
    "./yelmlib.js"
)

onmessage = ev => {
    switch (ev.data.op) {
        case "compile":
            let res = ts.mbit.compile(ev.data.arg)
            postMessage({
                op: "compile",
                id: ev.data.id,
                result: res
            }, null)
    }
}

postMessage({
    id: "ready"
}, null)