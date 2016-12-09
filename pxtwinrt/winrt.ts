/// <reference path="../typings/bluebird/bluebird.d.ts"/>
namespace pxt.winrt {
    export function promisify<T>(p: Windows.Foundation.IPromise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            p.done(v => resolve(v), e => reject(e));
        })
    }

    export function toArray<T>(v: any): T[] {
        let r: T[] = [];
        let length = v.length;
        for (let i = 0; i < length; ++i) r.push(v[i])
        return r;
    }

    /**
     * Detects if the script is running in a browser on windows
     */
    export function isWindows(): boolean {
        return !!navigator && /Win32/i.test(navigator.platform);
    }

    export function isWinRT(): boolean {
        return typeof Windows !== "undefined";
    }

    export function initAsync(onHexFileImported?: (hex: pxt.cpp.HexFile) => void) {
        if (!isWinRT()) return Promise.resolve();

        initSerial();
        if (onHexFileImported)
            initActivation(onHexFileImported);

        return Promise.resolve();
    }

    function initActivation(onHexFileImported: (hex: pxt.cpp.HexFile) => void) {
        // Subscribe to the Windows Activation Event
        (Windows.UI.WebUI.WebUIApplication as any).addEventListener("activated", function (args: Windows.ApplicationModel.Activation.IActivatedEventArgs) {
            let activation = Windows.ApplicationModel.Activation;
            if (args.kind === activation.ActivationKind.file) {
                let info = args as Windows.UI.WebUI.WebUIFileActivatedEventArgs;
                let file: Windows.Storage.IStorageItem = info.files.getAt(0);
                if (file && file.isOfType(Windows.Storage.StorageItemTypes.file)) {
                    let f = file as Windows.Storage.StorageFile;
                    Windows.Storage.FileIO.readBufferAsync(f)
                        .done(buffer => {
                            let ar = new Uint8Array(buffer.length);
                            let dataReader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
                            dataReader.readBytes(ar);
                            dataReader.close();

                            pxt.cpp.unpackSourceFromHexAsync(ar)
                                .done(hex => onHexFileImported(hex));
                        });
                }
            };
        });
    }
}