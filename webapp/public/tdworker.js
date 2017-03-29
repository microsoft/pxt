var window = self;
window.localStorage = {}
function require() { return null }

importScripts(
    "/blb/tdast.js"
)

onmessage = function(ev) {
    var data = ev.data
    if (data.op == "td2ts") {
        var r = TDev.AST.td2ts(data.arg)
        postMessage({
            id: data.id,
            op: data.op,
            result: r
        })
    } else {
        postMessage({
            id: data.id,
            op: data.op,
            error: "Command not understood"
        })
    }
}

postMessage({
    id: "ready"
})
