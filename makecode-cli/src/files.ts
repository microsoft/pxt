import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as mkc from "./mkc"

export function findProjectDir() {
    let s = process.cwd()
    while (true) {
        if (fs.existsSync(path.join(s, "pxt.json")))
            return s

        const s2 = path.resolve(path.join(s, ".."))
        if (s == s2)
            return null
        s = s2;
    }
}

const readAsync = util.promisify(fs.readFile)
const writeAsync = util.promisify(fs.writeFile)

export async function readProjectAsync(dir: string) {
    const pxtJson = await readAsync(path.join(dir, "pxt.json"), "utf8")
    const res: mkc.Project = {
        config: JSON.parse(pxtJson),
        mkcConfig: JSON.parse(await readAsync(path.join(dir, "mkc.json"), "utf8").then(s => s, err => "{}")),
        files: {
            "pxt.json": pxtJson
        }
    }
    for (let f of res.config.files.concat(res.config.testFiles || [])) {
        if (f.indexOf("/") >= 0)
            continue
        res.files[f] = await readAsync(path.join(dir, f), "utf8")
    }
    return res
}

function homePxtDir() {
    return path.join(process.env["HOME"] || process.env["UserProfile"], ".pxt")
}

export function mkHomeCache(): mkc.Cache {
    if (!fs.existsSync(homePxtDir()))
        fs.mkdirSync(homePxtDir())
    const mkcDir = path.join(homePxtDir(), "mkc-cache")
    if (!fs.existsSync(mkcDir))
        fs.mkdirSync(mkcDir)

    function expandKey(key: string) {
        return path.join(mkcDir, key.replace(/[^\.a-z0-9\-]/g, c => "_" + c.charCodeAt(0) + "_"))
    }

    return {
        getAsync: key => readAsync(expandKey(key)).then(buf => buf, err => null),
        setAsync: (key, val) => writeAsync(expandKey(key), val)
    }
}

export async function saveBuiltFilesAsync(dir: string, res: any) {
    const outfiles: pxt.Map<string> = res.outfiles || {}
    const built = path.join(dir, "built")
    if (!fs.existsSync(built))
        fs.mkdirSync(built)
    for (let fn of Object.keys(outfiles)) {
        if (fn.indexOf("/") >= 0)
            continue
        console.log(`write built/${fn}`)
        await writeAsync(path.join(built, fn), outfiles[fn])
    }
}