/// <reference path="./winrtrefs.d.ts"/>
namespace pxt.winrt {
    type ActivationArgs = Windows.ApplicationModel.Activation.IActivatedEventArgs;
    export function promisify<T>(p: Windows.Foundation.IAsyncOperation<T> | Windows.Foundation.Projections.Promise<T>): Promise<T> {
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

    export function initAsync(importHexImpl?: (hex: pxt.cpp.HexFile, createNewIfFailed?: boolean) => void) {
        if (!isWinRT()) return Promise.resolve();

        const uiCore = Windows.UI.Core;
        const navMgr = uiCore.SystemNavigationManager.getForCurrentView();
        navMgr.onbackrequested = (e) => {
            // Ignore the built-in back button; it tries to back-navigate the sidedoc panel, but it crashes the
            // app if the sidedoc has been closed since the navigation happened
            console.log("BACK NAVIGATION");
            navMgr.appViewBackButtonVisibility = uiCore.AppViewBackButtonVisibility.collapsed;
            e.handled = true;
        };

        initSerial();
        return hasActivationProjectAsync()
            .then(() => {
                if (importHexImpl) {
                    importHex = importHexImpl;
                    const app = Windows.UI.WebUI.WebUIApplication as any;
                    app.removeEventListener("activated", initialActivationHandler);
                    app.addEventListener("activated", fileActivationHandler);
                }
            });
    }

    // Needed for when user double clicks a hex file without the app already running
    export function captureInitialActivation() {
        if (!isWinRT()) {
            return;
        }
        initialActivationDeferred = Promise.defer<ActivationArgs>();
        (Windows.UI.WebUI.WebUIApplication as any).addEventListener("activated", initialActivationHandler);
    }

    export function loadActivationProject() {
        return initialActivationDeferred.promise
            .then((args) => fileActivationHandler(args, /* createNewIfFailed */ true));
    }

    export function hasActivationProjectAsync() {
        if (!isWinRT()) {
            return Promise.resolve(false);
        }

        // By the time the webapp calls this, if the activation promise hasn't been settled yet, assume we missed the
        // activation event and pretend there were no activation args
        initialActivationDeferred.resolve(null); // This is no-op if the promise had been previously resolved
        return initialActivationDeferred.promise
            .then((args) => {
                return Promise.resolve(args && args.kind === Windows.ApplicationModel.Activation.ActivationKind.file);
            });
    }

    function initialActivationHandler(args: ActivationArgs) {
        (Windows.UI.WebUI.WebUIApplication as any).removeEventListener("activated", initialActivationHandler);
        initialActivationDeferred.resolve(args);
    }

    let initialActivationDeferred: Promise.Resolver<ActivationArgs>;
    let importHex: (hex: pxt.cpp.HexFile, createNewIfFailed?: boolean) => void;

    function fileActivationHandler(args: ActivationArgs, createNewIfFailed = false) {
        if (args.kind === Windows.ApplicationModel.Activation.ActivationKind.file) {
            let info = args as Windows.UI.WebUI.WebUIFileActivatedEventArgs;
            let file: Windows.Storage.IStorageItem = info.files.getAt(0);
            if (file && file.isOfType(Windows.Storage.StorageItemTypes.file)) {
                let f = file as Windows.Storage.StorageFile;
                Windows.Storage.FileIO.readBufferAsync(f)
                    .then(buffer => {
                        let ar: number[] = [];
                        let dataReader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
                        while (dataReader.unconsumedBufferLength) {
                            ar.push(dataReader.readByte());
                        }
                        dataReader.close();
                        return pxt.cpp.unpackSourceFromHexAsync(new Uint8Array(ar));
                    })
                    .then((hex) => importHex(hex, createNewIfFailed));
            }
        }
    }
}