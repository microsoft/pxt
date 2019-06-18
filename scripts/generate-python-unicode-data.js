// Download https://www.unicode.org/Public/11.0.0/ucd/UnicodeData.txt and http://www.unicode.org/Public/11.0.0/ucd/PropList.txt

let fs = require("fs")

let codesStart = []
let codesContinue = []
let codesAll = []
let codesWS = []

let startCl = ["Lu", "Ll", "Lt", "Lm", "Lo", "Nl"]
let contCl = ["Mn", "Mc", "Nd", "Pc"]
let wsCl = ["Zs"]

for (let line of fs.readFileSync("UnicodeData.txt", "utf8").split(/\n/)) {
    let w = line.split(';')
    let c = parseInt(w[0], 16)
    if (c == 95 || startCl.indexOf(w[2]) >= 0)
        codesStart[c] = 1
    if (contCl.indexOf(w[2]) >= 0)
        codesContinue[c] = 1
    if (wsCl.indexOf(w[2]) >= 0)
        codesWS[c] = 1
}

for (let line of fs.readFileSync("PropList.txt", "utf8").split(/\n/)) {
    let l = null
    if (line.indexOf("Other_ID_Start") >= 0)
        l = codesStart
    if (line.indexOf("Other_ID_Continue") >= 0)
        l = codesContinue
    if (l) {
        let m = /^([a-f0-9]+)\.\.([a-f0-9]+)/i.exec(line)
        if (m) {
            let c = parseInt(m[1], 16)
            let e = parseInt(m[2], 16)
            while (c <= e)
                l[c++] = 1
        } else {
            let m = /^([a-f0-9]+)\s/i.exec(line)
            let c = parseInt(m[1], 16)
            l[c] = 1
        }
    }
}

let num = Math.max(codesStart.length, codesContinue.length)
num = 0x10000

for (let i = 0; i < num; ++i) {
    if (codesStart[i])
        codesContinue[i] = 0
    else
        codesStart[i] = 0
    if (!codesContinue[i]) codesContinue[i] = 0
    codesAll[i] = codesStart[i] || codesContinue[i]
}

console.log(num)

function uni(c) {
    if (c > 0xffff)
        throw new Error("c=" + c)
    return "\\u" + ("000" + c.toString(16)).slice(-4)
}

function ranges(arr, alt) {
    let r = ""
    if(!alt) alt=arr
    for (let i = 0; i < num; ++i) {
        if (!arr[i])
            continue
        if (arr[i + 1] && alt[i + 2]) {
            let e = i + 1
            while (alt[e])
                e++
            e--
            r += uni(i) + "-" + uni(e)
            i = e
        } else {
            r += uni(i)
        }
    }
    return r
}

function show(nm, codes, alt) {
    let r = ranges(codes, alt)
    console.log(nm, r.length, r)

}

show("start", (codesStart))
show("cont", (codesContinue), codesAll)
show("all", (codesAll))
show("WS", (codesWS))
