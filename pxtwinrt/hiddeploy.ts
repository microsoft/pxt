/// <reference path="../typings/globals/bluebird/index.d.ts"/>
/// <reference path="./winrtrefs.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
namespace pxt.winrt {
    export function hidDeployCoreAsync(res: pxtc.CompileResult): Promise<void> {
        return pxt.winrt.promisify(Windows.Devices.Enumeration.DeviceInformation.findAllAsync()
            .then(devices => {
                devices.forEach(device => {
                    console.log(`device ${device.name}`)
                })
            }).then(() => {}));
    }
}