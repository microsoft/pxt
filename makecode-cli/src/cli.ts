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
    const ed = await downloader.downloadAsync(cache, prj.mkcConfig.targetWebsite)
    console.log("setup compiler")
    const ctx = new service.Ctx(ed)

    console.log("compile...")
    const res = await ctx.simpleCompileAsync(prj)

    await files.saveBuiltFilesAsync(prjDir, res)
    delete res.outfiles
    console.log(res.success)

    console.log("all done")
}

mainCli()
