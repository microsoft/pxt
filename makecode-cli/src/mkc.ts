/// <reference path="../../localtypings/pxtpackage.d.ts" />

export import downloader = require("./downloader")
export import files = require("./files")
export import service = require("./service")
export import loader = require("./loader")

export interface MkcJson {
    targetWebsite: string;
}

export interface Cache {
    getAsync(key: string): Promise<Buffer>;
    setAsync(key: string, val: Buffer): Promise<void>;
}

export interface DownloadedEditor {
    cache: Cache;
    cdnUrl: string;
    website: string;
    pxtWorkerJs: string;
    targetJson: any;
    hwVariant?: string;
}

export interface Package {
    config: pxt.PackageConfig;
    mkcConfig: MkcJson;
    files: pxt.Map<string>;
    fromTargetJson?: boolean;
}

export interface Workspace {
    packages: pxt.Map<Package>;
}

export let cloudRoot = "https://makecode.com/api/"

export class Project {
    editor: DownloadedEditor
    service: service.Ctx
    mainPkg: Package

    constructor(public directory: string, public cache: Cache = null) {
        if (!this.cache)
            this.cache = files.mkHomeCache()
    }

    async loadPkgAsync() {
        if (this.mainPkg)
            return

        const prj = await files.readProjectAsync(this.directory)
        loader.guessMkcJson(prj)

        // TODO handle require("lzma") in worker
        prj.config.binaryonly = true
        prj.files["pxt.json"] = JSON.stringify(prj.config, null, 4)

        this.mainPkg = prj
    }

    async loadEditorAsync() {
        if (this.editor)
            return

        await this.loadPkgAsync()

        this.editor = await downloader.downloadAsync(this.cache, this.mainPkg.mkcConfig.targetWebsite)
        // this.editor.hwVariant = "samd51"
        this.service = new service.Ctx(this.editor)
    }

    async writePxtModulesAsync() {
        await this.loadEditorAsync()
        await this.loadPkgAsync()
        const ws = await loader.loadDeps(this.editor, this.mainPkg)
        await files.savePxtModulesAsync(this.directory, ws)
    }

    async buildAsync() {
        const t0 = Date.now()
        this.mainPkg = null // force reload
        await this.writePxtModulesAsync()
        //await this.loadEditorAsync()
        //await loader.loadDeps(this.editor, this.mainPkg)

        const res = await this.service.simpleCompileAsync(this.mainPkg)

        await files.saveBuiltFilesAsync(this.directory, res)

        console.log("build " + (Date.now() - t0) + "ms")
        //delete res.outfiles
        //delete (res as any).procDebugInfo
        //console.log(res)
        return res
    }
}
