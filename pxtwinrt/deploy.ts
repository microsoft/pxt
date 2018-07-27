/// <reference path="./winrtrefs.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
namespace pxt.winrt {
    export function driveDeployCoreAsync(res: pxtc.CompileResult): Promise<void> {
        const drives = pxt.appTarget.compile.deployDrives;
        pxt.Util.assert(!!drives);
        pxt.debug(`deploying to drives ${drives}`)

        const drx = new RegExp(drives);
        const firmware = pxt.outputName()
        const r = res.outfiles[firmware];

        function writeAsync(folder: Windows.Storage.StorageFolder): Promise<void> {
            pxt.debug(`writing ${firmware} to ${folder.displayName}`)
            return pxt.winrt.promisify(
                folder.createFileAsync(firmware, Windows.Storage.CreationCollisionOption.replaceExisting)
                    .then(file => Windows.Storage.FileIO.writeTextAsync(file, r))
            ).then(r => { }).catch(e => {
                pxt.debug(`failed to write ${firmware} to ${folder.displayName} - ${e}`)
            })
        }

        return pxt.winrt.promisify(Windows.Storage.KnownFolders.removableDevices.getFoldersAsync())
            .then(ds => {
                let df = ds.filter(d => drx.test(d.displayName));
                let pdf = df.map(writeAsync);
                let all = Promise.join(...pdf)
                return all;
            }).then(r => { });
    }

    export function browserDownloadAsync(text: string, name: string, contentType: string): Promise<void> {
        let file: Windows.Storage.StorageFile;
        return pxt.winrt.promisify<void>(
            Windows.Storage.ApplicationData.current.temporaryFolder.createFileAsync(name, Windows.Storage.CreationCollisionOption.replaceExisting)
                .then(f => Windows.Storage.FileIO.writeTextAsync(file = f, text))
                .then(() => Windows.System.Launcher.launchFileAsync(file))
                .then(b => { })
        );
    }

    export function saveOnlyAsync(res: pxtc.CompileResult): Promise<boolean> {
        const useUf2 = pxt.appTarget.compile.useUF2;
        const fileTypes = useUf2 ? [".uf2"] : [".hex"];
        const savePicker = new Windows.Storage.Pickers.FileSavePicker();
        savePicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.documentsLibrary;
        savePicker.fileTypeChoices.insert("MakeCode binary file", <any>fileTypes);
        savePicker.suggestedFileName = res.downloadFileBaseName;
        return pxt.winrt.promisify(savePicker.pickSaveFileAsync()
            .then((file) => {
                if (file) {
                    let fileContent = useUf2 ? res.outfiles[pxtc.BINARY_UF2] : res.outfiles[pxtc.BINARY_HEX];
                    if (!pxt.isOutputText()) {
                        fileContent = atob(fileContent);
                    }
                    const ar: number[] = [];
                    const bytes = Util.stringToUint8Array(fileContent);
                    bytes.forEach((b) => ar.push(b));
                    return Windows.Storage.FileIO.writeBytesAsync(file, ar)
                        .then(() => true);
                }
                // Save cancelled
                return Promise.resolve(false);
            }));
    }
}