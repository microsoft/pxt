const fs = require("fs")
let prev = null
let edges = {}
for (let line of fs.readFileSync(process.argv[2], "utf8").split(/\n/)) {
    if (line.trim() == "}") prev = null
    let m = /^\s*(\w+):/.exec(line)
    if (!m) continue
    let curr = m[1]
    if (curr == "ctx") continue
    if (prev) {
        if (!edges[prev])
            edges[prev] = []
        if (edges[prev].indexOf(curr) < 0)
            edges[prev].push(curr)
    }
    prev = curr
}

let visited = {}
let curr = {}
let res = []

function r(e) {
    if (visited[e]) {
        if (curr[e])
            console.log("cycle: " + e)
        return
    }
    visited[e] = true
    curr[e] = true
    for (let n of edges[e] || []) {
        r(n)
    }
    curr[e] = false
    res.push(e)
}
r("kind")
res.reverse()
let i = 1
let re = ""
for (let k of res) {
    re += `${k}: ${i}, `
    i++
}
console.log(re)