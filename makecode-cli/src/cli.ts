import * as fs from "fs"

import * as mkc from "./mkc"
import * as loader from "./loader"
import * as files from "./files"
import * as downloader from "./downloader"
import * as service from "./service"


async function mainCli() {
    const prj = new mkc.Project(files.findProjectDir())

    await prj.buildAsync()

    //mkc.simserver.startSimServer(prj.editor)

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


if (process.argv[2])
    downloadProjectAsync(process.argv[2])
else
    mainCli()
