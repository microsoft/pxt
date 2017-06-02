/// <reference path="../typings/globals/bluebird/index.d.ts"/>
/// <reference path="./winrtrefs.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.winrt {
    class WindowsRuntimeIO implements pxt.HF2.PacketIO {
        onData = (v: Uint8Array) => { };
        onEvent = (v: Uint8Array) => { };
        onError = (e: Error) => { };
        public devs: Windows.Devices.HumanInterfaceDevice.HidDevice[] = [];

        constructor() {
        }

        error(msg: string) {
            throw new Error(U.lf("USB/HID error ({0})", msg))
        }

        reconnectAsync(): Promise<void> {
            return this.initAsync()
        }

        disconnectAsync(): Promise<void> {
            this.devs.forEach(dev => dev.close());
            this.devs = [];
            return Promise.resolve();
        }

        sendPacketAsync(pkt: Uint8Array): Promise<void> {
            // it's just silly that there's no way to pass a uint8array
            // oh well
            const ar: number[] = [0];
            for (let i = 0; i < 64; ++i)
                ar.push(pkt[i] || 0);
            const dataWriter = new Windows.Storage.Streams.DataWriter();
            dataWriter.writeBytes(ar);
            const buffer = dataWriter.detachBuffer();
            return pxt.winrt.promisify(
                Promise.all(this.devs.map(dev => {
                    const report = dev.createOutputReport(0);
                    report.data = buffer;
                    return dev.sendOutputReportAsync(report)
                        .then(value => {
                            console.log(`hf2: ${value} bytes written`)
                        })
                })).then(() => { }));
        }

        initAsync(): Promise<void> {
            const selector = Windows.Devices.HumanInterfaceDevice.HidDevice.getDeviceSelector(0xff00, 0x0001, 0x239a, 0x0019);
            return pxt.winrt.promisify(Windows.Devices.Enumeration.DeviceInformation.findAllAsync(selector, null)
                .then(devices => {
                    const hdevs = devices.map(device =>
                        Windows.Devices.HumanInterfaceDevice.HidDevice.fromIdAsync(device.id, Windows.Storage.FileAccessMode.readWrite)
                    );
                    return Promise.all(hdevs);
                })
                .then(devices => {
                    this.devs = devices;
                    this.devs.forEach(device => console.log(`hid device version ${device.version}`));
                }));
        }
    }

    export function mkPacketIOAsync(): Promise<pxt.HF2.PacketIO> {
        const b = new WindowsRuntimeIO()
        return b.initAsync()
            .then(() => b);
    }
}