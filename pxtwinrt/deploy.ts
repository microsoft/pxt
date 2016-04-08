/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../typings/winrt/winrt.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
namespace pxtwinrt {
    export function deployCoreAsync(res: ts.pxt.CompileResult) : Promise<void> {
        let drives = pxt.appTarget.compile.deployDrives;
        pxt.Util.assert(!!drives);

        let drx = new RegExp(drives, 'i');
        let r = res.outfiles["microbit.hex"];        
        
        function writeAsync(folder : Windows.Storage.StorageFolder) : Promise<void> {
            return pxtwinrt.promisify(folder.createFileAsync("firmware.hex")
                    .then(file => {
                        Windows.Storage.FileIO.writeTextAsync(file, r);
                    }))            
        }
        
        return promisify(Windows.Storage.KnownFolders.removableDevices.getFoldersAsync())
            .then(ds => {
                let df = ds.filter(d => drx.test(d.displayName));
                let pdf = df.map(writeAsync);
                let all = Promise.join(...pdf)
                return all;
            }).then(r => {});
    }
}