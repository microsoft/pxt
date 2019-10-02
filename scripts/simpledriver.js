/*
Test script for pxtworker.js as run from the cloud.

Run in pxt-target/projects/myProject. Make sure pxt.json has targetVersions.target set.
*/


const vm = require("vm")
const fs = require("fs")

const sandbox = {
    eval: undefined,
    Function: undefined,
    setTimeout: setTimeout,
    clearInterval: clearInterval,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearImmediate: clearImmediate,
    setImmediate: setImmediate,
    Buffer: Buffer,
    pxtTargetBundle: {},
    scriptText: {},
    global: null,
    postMessage: msg => {
        if (!msg)
            return
        if (msg.outfiles) {
            for (let k of Object.keys(msg.outfiles)) {
                console.log("write built/" + k)
                fs.writeFileSync("built/" + k, msg.outfiles[k])
            }
            delete msg.outfiles
        }
        console.log("MSG", msg)
    },
    postError: msg => {
        console.log("ERROR", msg)
    },
    console: {
        log: (s) => console.log(s)
    }
};
sandbox.global = sandbox;
vm.createContext(sandbox, {
    codeGeneration: {
        strings: false,
        wasm: false
    }
});

const pxtJson = JSON.parse(fs.readFileSync("pxt.json", "utf8"))
const scriptText = {
    "pxt.json": JSON.stringify(pxtJson, null, 4)
}
for (let fn of pxtJson.files) {
    scriptText[fn] = fs.readFileSync(fn, "utf8")
}

let parentPath = "../"
for (let i = 0; i < 20; ++i) {
    if (fs.existsSync(parentPath + "pxtarget.json"))
        break
    parentPath += "../"
}

const pxtWorkerFn = parentPath + "node_modules/pxt-core/built/web/pxtworker.js"
const pxtWorker = fs.readFileSync(pxtWorkerFn, "utf8")
sandbox.pxtTargetBundle = JSON.parse(fs.readFileSync(parentPath + "built/target.json", "utf8"))

const scr = new vm.Script(pxtWorker, {
    filename: pxtWorkerFn
})
scr.runInContext(sandbox)

function runAsync(code) {
    const src = `Promise.resolve().then(() => ${code})` +
        `.then(v => postMessage(v), err => postError(err.stack || "" + err))`
    const scr = new vm.Script(src)
    scr.runInContext(sandbox)
}

function runSync(code) {
    const src = `try { postMessage(${code}) } ` +
        `catch (err) { postError(err.stack || "" + err) }`
    const scr = new vm.Script(src)
    scr.runInContext(sandbox)
}

runSync("pxt.setupSimpleCompile()")
sandbox.scriptText = scriptText
runAsync("pxt.simpleCompileAsync(scriptText)")
