import * as fs from "fs"

import * as mkc from "./mkc"
import * as loader from "./loader"
import * as files from "./files"
import * as downloader from "./downloader"
import * as service from "./service"

async function mainCli() {
    const cache = files.mkHomeCache()
    const prjDir = files.findProjectDir()
    const prj = await files.readProjectAsync(prjDir)
    loader.guessMkcJson(prj)

    // TODO handle require("lzma") in worker
    prj.config.binaryonly = true
    prj.files["pxt.json"] = JSON.stringify(prj.config, null, 4)

    const ed = await downloader.downloadAsync(cache, prj.mkcConfig.targetWebsite)
    ed.hwVariant = "samd51"
    console.log("load gh pkgs")
    await loader.loadDeps(ed, prj)

    console.log("setup compiler")
    const ctx = new service.Ctx(ed)

    console.log("compile...")
    const res = await ctx.simpleCompileAsync(prj)

    await files.saveBuiltFilesAsync(prjDir, res)
    delete res.outfiles
    delete (res as any).procDebugInfo
    console.log(res)

    console.log("all done")
}

async function downloadProjectAsync(id: string) {
    id = id.replace(/.*\//, '')
    const url = mkc.cloudRoot + id + "/text"
    const files = await downloader.httpGetJsonAsync(url)
    for (let fn of Object.keys(files)) {
        if (/\//.test(fn))
            continue
        fs.writeFileSync(fn, files[fn])
    }
    console.log("downloaded.")
}

if(process.argv[2])
    downloadProjectAsync(process.argv[2])
else
    mainCli()