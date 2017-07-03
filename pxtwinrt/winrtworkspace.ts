/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxteditor.d.ts"/>
/// <reference path="./winrtrefs.d.ts"/>

namespace pxt.winrt.workspace {

    type Header = pxt.workspace.Header;
    type ScriptText = pxt.workspace.ScriptText;
    type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
    type InstallHeader = pxt.workspace.InstallHeader;
    import U = pxt.Util;
    import Cloud = pxt.Cloud;
    const lf = U.lf

    let folder: Windows.Storage.StorageFolder;
    let allScripts: HeaderWithScript[] = [];
    let currentTarget: string;

    interface HeaderWithScript {
        id: string;
        header: Header;
        text: ScriptText;
        fsText: ScriptText;
        mtime?: number;
        textNeedsSave?: boolean;
    }

    function lookup(id: string) {
        return allScripts.filter(x => x.id == id)[0]
    }

    function getHeaders() {
        return allScripts.map(e => e.header)
    }

    function getHeader(id: string) {
        let e = lookup(id)
        if (e && !e.header.isDeleted)
            return e.header
        return null
    }

    function mergeFsPkg(pkg: pxt.FsPkg) {
        let e = lookup(pkg.path)
        if (!e) {
            e = {
                id: pkg.path,
                header: null,
                text: null,
                fsText: null
            }
            allScripts.push(e)
        }

        let time = pkg.files.map(f => f.mtime)
        time.sort((a, b) => b - a)
        let modTime = Math.round(time[0] / 1000) || U.nowSeconds()
        let hd: Header = {
            target: currentTarget,
            name: pkg.config.name,
            meta: {},
            editor: pxt.JAVASCRIPT_PROJECT_NAME,
            pubId: pkg.config.installedVersion,
            pubCurrent: false,
            _rev: null,
            id: pkg.path,
            recentUse: modTime,
            modificationTime: modTime,
            blobId: null,
            blobCurrent: false,
            isDeleted: false,
            icon: pkg.icon
        }

        if (!e.header) {
            e.header = hd
        } else {
            let eh = e.header
            eh.name = hd.name
            eh.pubId = hd.pubId
            eh.modificationTime = hd.modificationTime
            eh.isDeleted = hd.isDeleted
            eh.icon = hd.icon
        }
    }

    function initAsync(target: string): Promise<void> {
        allScripts = [];
        currentTarget = target;
        const applicationData = Windows.Storage.ApplicationData.current;
        const localFolder = applicationData.localFolder;
        pxt.debug(`winrt: initializing workspace`)
        return promisify(localFolder.createFolderAsync(currentTarget, Windows.Storage.CreationCollisionOption.openIfExists))
            .then(fd => {
                folder = fd;
                pxt.debug(`winrt: initialized workspace at ${folder.path}`)
                return syncAsync();
            }).then(() => { })
    }

    function fetchTextAsync(e: HeaderWithScript): Promise<ScriptText> {
        pxt.debug(`winrt: fetch ${e.id}`)
        return readPkgAsync(e.id, true)
            .then((resp: pxt.FsPkg) => {
                if (!e.text) {
                    // otherwise we were beaten to it
                    e.text = {};
                    e.mtime = 0
                    for (const f of resp.files) {
                        e.text[f.name] = f.content
                        e.mtime = Math.max(e.mtime, f.mtime)
                    }
                    e.fsText = U.flatClone(e.text)
                }
                return e.text
            })
    }

    const headerQ = new U.PromiseQueue();

    function getTextAsync(id: string): Promise<ScriptText> {
        pxt.debug(`winrt: get text ${id}`)
        let e = lookup(id)
        if (!e)
            return Promise.resolve(null as ScriptText)
        if (e.text)
            return Promise.resolve(e.text)
        return headerQ.enqueue(id, () => fetchTextAsync(e))
    }

    function saveCoreAsync(h: Header, text?: ScriptText) {
        if (h.temporary) return Promise.resolve();

        let e = lookup(h.id)

        U.assert(e.header === h)

        if (!text)
            return Promise.resolve()

        h.saveId = null
        e.textNeedsSave = true
        e.text = text

        return headerQ.enqueue<void>(h.id, () => {
            U.assert(!!e.fsText)
            let pkg: pxt.FsPkg = {
                files: [],
                config: null,
                path: h.id,
            }
            for (let fn of Object.keys(e.text)) {
                if (e.text[fn] !== e.fsText[fn])
                    pkg.files.push({
                        name: fn,
                        mtime: null,
                        content: e.text[fn],
                        prevContent: e.fsText[fn]
                    })
            }
            let savedText = U.flatClone(e.text)
            if (pkg.files.length == 0) return Promise.resolve()
            return writePkgAsync(h.id, pkg)
                .then((pkg: pxt.FsPkg) => {
                    e.fsText = savedText
                    mergeFsPkg(pkg)
                    if (text) {
                        h.saveId = null
                    }
                })
        })
    }

    function saveAsync(h: Header, text: ScriptText): Promise<void> {
        return saveCoreAsync(h, text)
    }

    function installAsync(h0: InstallHeader, text: ScriptText): Promise<Header> {
        const h = <Header>h0
        let path = h.name.replace(/[^a-zA-Z0-9]+/g, " ").trim().replace(/ /g, "-")
        if (lookup(path)) {
            let n = 2
            while (lookup(path + "-" + n))
                n++;
            path += "-" + n
            h.name += " " + n
        }
        h.id = path;
        h.recentUse = U.nowSeconds()
        h.modificationTime = h.recentUse;
        h.target = currentTarget;
        const e: HeaderWithScript = {
            id: h.id,
            header: h,
            text: text,
            fsText: {}
        }
        allScripts.push(e)
        return saveCoreAsync(h, text)
            .then(() => h)
    }

    function saveToCloudAsync(h: Header) {
        return Promise.resolve()
    }

    function pathjoin(...parts: string[]): string {
        return parts.join('\\');
    }

    function readFileAsync(path: string): Promise<string> {
        const fp = pathjoin(folder.path, path);
        pxt.debug(`winrt: reading ${fp}`);
        return promisify(Windows.Storage.StorageFile.getFileFromPathAsync(fp)
            .then(file => Windows.Storage.FileIO.readTextAsync(file)));
    }

    function writeFileAsync(dir: string, name: string, content: string): Promise<void> {
        const fd = pathjoin(folder.path, dir);
        pxt.debug(`winrt: writing ${pathjoin(fd, name)}`);
        return promisify(Windows.Storage.StorageFolder.getFolderFromPathAsync(fd))
            .then(dk => dk.createFileAsync(name, Windows.Storage.CreationCollisionOption.replaceExisting))
            .then(f => Windows.Storage.FileIO.writeTextAsync(f, content))
            .then(() => { })
    }

    function statOptAsync(path: string) {
        const fn = pathjoin(folder.path, path);
        pxt.debug(`winrt: ${fn}`)
        return promisify(Windows.Storage.StorageFile.getFileFromPathAsync(fn)
            .then(file => file.getBasicPropertiesAsync()
                .then(props => {
                    return {
                        name: path,
                        mtime: props.dateModified.getTime()
                    }
                })
            ));
    }

    function throwError(code: number, msg: string = null) {
        let err = new Error(msg || "Error " + code);
        (err as any).statusCode = code
        throw err
    }

    function writePkgAsync(logicalDirname: string, data: FsPkg): Promise<FsPkg> {
        pxt.debug(`winrt: writing package at ${logicalDirname}`);
        return promisify(folder.createFolderAsync(logicalDirname, Windows.Storage.CreationCollisionOption.openIfExists))
            .then(() => Promise.map(data.files, f => readFileAsync(pathjoin(logicalDirname, f.name))
                .then(text => {
                    if (f.name == pxt.CONFIG_NAME) {
                        try {
                            let cfg: pxt.PackageConfig = JSON.parse(f.content)
                            if (!cfg.name) {
                                pxt.log("Trying to save invalid JSON config")
                                throwError(410)
                            }
                        } catch (e) {
                            pxt.log("Trying to save invalid format JSON config")
                            throwError(410)
                        }
                    }
                    if (text !== f.prevContent) {
                        pxt.log(`merge error for ${f.name}: previous content changed...`);
                        throwError(409)
                    }
                }, err => { })))
            // no conflict, proceed with writing
            .then(() => Promise.map(data.files, f => writeFileAsync(logicalDirname, f.name, f.content)))
            .then(() => readPkgAsync(logicalDirname, false));
    }

    function readPkgAsync(logicalDirname: string, fileContents: boolean): Promise<FsPkg> {
        pxt.debug(`winrt: reading package under ${logicalDirname}`);
        return readFileAsync(pathjoin(logicalDirname, pxt.CONFIG_NAME))
            .then(text => {
                const cfg: pxt.PackageConfig = JSON.parse(text)
                const files = [pxt.CONFIG_NAME].concat(cfg.files || []).concat(cfg.testFiles || [])
                return Promise.map(files, fn =>
                    statOptAsync(pathjoin(logicalDirname, fn))
                        .then(st => {
                            const rf: FsFile = {
                                name: fn,
                                mtime: st ? st.mtime : null
                            }
                            if (st == null || !fileContents)
                                return rf;
                            else
                                return readFileAsync(pathjoin(logicalDirname, fn))
                                    .then(text => {
                                        rf.content = text
                                        return rf;
                                    })
                        }))
                    .then(files => {
                        const rs = <FsPkg>{
                            path: logicalDirname,
                            config: cfg,
                            files: files
                        };
                        return rs;
                    })
            })
    }

    function syncAsync(): Promise<pxt.editor.EditorSyncState> {
        return promisify(folder.getFoldersAsync())
            .then(fds => Promise.all(fds.map(fd => readPkgAsync(fd.name, false))))
            .then(hs => {
                hs.forEach(mergeFsPkg);
                return undefined;
            });
    }

    function resetAsync(): Promise<void> {
        return promisify(folder.deleteAsync(Windows.Storage.StorageDeleteOption.default)
            .then(() => {
                folder = undefined;
                allScripts = [];
                pxt.storage.clearLocal();
            }));
    }

    export const provider: pxt.workspace.WorkspaceProvider = {
        getHeaders,
        getHeader,
        getTextAsync,
        initAsync,
        saveAsync,
        installAsync,
        saveToCloudAsync,
        syncAsync,
        resetAsync
    }
}