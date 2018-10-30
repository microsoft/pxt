/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxteditor.d.ts"/>
/// <reference path="./winrtrefs.d.ts"/>

namespace pxt.winrt.workspace {

    type Header = pxt.workspace.Header;
    type ScriptText = pxt.workspace.ScriptText;
    type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
    import U = pxt.Util;

    let folder: Windows.Storage.StorageFolder;

    export function fileApiAsync(path: string, data?: any) {
        if (U.startsWith(path, "pkg/")) {
            let id = path.slice(4)
            if (data) {
                return writePkgAsync(id, data)
            } else {
                return readPkgAsync(id, true)
            }
        } else if (path == "list") {
            return initAsync()
                .then(listPkgsAsync)
        } else {
            throw throwError(404)
        }
    }

    function initAsync(): Promise<void> {
        if (folder)
            return Promise.resolve()
        const applicationData = Windows.Storage.ApplicationData.current;
        const localFolder = applicationData.localFolder;
        pxt.debug(`winrt: initializing workspace`)
        return promisify(localFolder.createFolderAsync(pxt.appTarget.id, Windows.Storage.CreationCollisionOption.openIfExists))
            .then(fd => {
                folder = fd;
                pxt.debug(`winrt: initialized workspace at ${folder.path}`)
            }).then(() => { })
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

    const HEADER_JSON = ".header.json"

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
            .then(() => writeFileAsync(logicalDirname, HEADER_JSON, JSON.stringify(data.header, null, 4)))
            .then(() => readPkgAsync(logicalDirname, false));
    }

    function readPkgAsync(logicalDirname: string, fileContents: boolean): Promise<FsPkg> {
        pxt.debug(`winrt: reading package under ${logicalDirname}`);
        return readFileAsync(pathjoin(logicalDirname, pxt.CONFIG_NAME))
            .then(text => {
                const cfg: pxt.PackageConfig = JSON.parse(text)
                return Promise.map(pxt.allPkgFiles(cfg), fn =>
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
                        const rs: FsPkg = {
                            path: logicalDirname,
                            header: null,
                            config: cfg,
                            files: files
                        };
                        return readFileAsync(pathjoin(logicalDirname, HEADER_JSON))
                            .then(text => {
                                if (text)
                                    rs.header = JSON.parse(text)
                            }, e => { })
                            .then(() => rs)
                    })
            })
    }

    function listPkgsAsync(): Promise<FsPkgs> {
        return promisify(folder.getFoldersAsync())
            .then((fds) => Promise.map(fds, (fd) => readPkgAsync(fd.name, false)))
            .then((fsPkgs) => {
                return Promise.resolve({ pkgs: fsPkgs });
            });
    }

    function resetAsync(): Promise<void> {
        return promisify(folder.deleteAsync(Windows.Storage.StorageDeleteOption.default)
            .then(() => {
                folder = undefined;
            }));
    }

    export function getProvider(base: pxt.workspace.WorkspaceProvider) {
        let r: WorkspaceProvider = {
            listAsync: base.listAsync,
            getAsync: base.getAsync,
            setAsync: base.setAsync,
            resetAsync,
        }
        return r
    }
}