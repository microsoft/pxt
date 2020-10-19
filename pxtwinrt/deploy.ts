/// <reference path="./winrtrefs.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
namespace pxt.winrt {
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
            })) as unknown as Promise<boolean>;
    }
}