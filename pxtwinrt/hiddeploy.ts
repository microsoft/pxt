/// <reference path="../typings/globals/bluebird/index.d.ts"/>
/// <reference path="./winrtrefs.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>

type WHID = Windows.Devices.HumanInterfaceDevice.HidDevice;

namespace pxt.winrt {
    class WindowsRuntimeIO implements pxt.HF2.PacketIO {
        static uf2Selectors: string[];

        onData = (v: Uint8Array) => { };
        onEvent = (v: Uint8Array) => { };
        onError = (e: Error) => { };
        public dev: Windows.Devices.HumanInterfaceDevice.HidDevice;

        constructor() {
        }

        error(msg: string) {
            throw new Error(U.lf("USB/HID error ({0})", msg))
        }

        reconnectAsync(): Promise<void> {
            return this.disconnectAsync()
                .then(() => this.initAsync());
        }

        disconnectAsync(): Promise<void> {
            if (this.dev) {
                this.dev.close();
                delete this.dev;
            }
            return Promise.resolve();
        }

        sendPacketAsync(pkt: Uint8Array): Promise<void> {
            if (!this.dev) return Promise.resolve();

            const ar: number[] = [0];
            for (let i = 0; i < Math.max(pkt.length, 64); ++i)
                ar.push(pkt[i] || 0);
            const dataWriter = new Windows.Storage.Streams.DataWriter();
            dataWriter.writeBytes(ar);
            const buffer = dataWriter.detachBuffer();
            const report = this.dev.createOutputReport(0);
            report.data = buffer;
            return pxt.winrt.promisify(
                this.dev.sendOutputReportAsync(report)
                    .then(value => {
                        pxt.debug(`hf2: ${value} bytes written`)
                    }));
        }

        initAsync(): Promise<void> {
            Util.assert(!this.dev, "HID interface not properly reseted");
            const wd = Windows.Devices;
            const whid = wd.HumanInterfaceDevice.HidDevice;
            if (!WindowsRuntimeIO.uf2Selectors) {
                this.initUf2Selectors();
            }
            const getDevicesPromise = WindowsRuntimeIO.uf2Selectors.reduce((soFar, currentSelector) => {
                // Try all selectors, in order, until some devices are found
                return soFar.then((devices) => {
                    if (devices && devices.length) {
                        return Promise.resolve(devices);
                    }
                    return wd.Enumeration.DeviceInformation.findAllAsync(currentSelector, null);
                });
            }, Promise.resolve<Windows.Devices.Enumeration.DeviceInformationCollection>(null));

            return getDevicesPromise
                .then((devices) => {
                    if (!devices || !devices[0]) {
                        pxt.debug("no hid device found");
                        return Promise.reject(new Error("no hid device found"));
                    }
                    pxt.debug(`hid enumerate ${devices.length} devices`);
                    const device = devices[0];
                    pxt.debug(`hid connect to ${device.name} (${device.id})`);
                    return whid.fromIdAsync(device.id, Windows.Storage.FileAccessMode.readWrite);
                })
                .then((r: WHID) => {
                    this.dev = r;
                    if (!this.dev) {
                        pxt.debug("can't connect to hid device");
                        return Promise.reject(new Error("can't connect to hid device"));
                    }
                    pxt.debug(`hid device version ${this.dev.version}`);
                    this.dev.addEventListener("inputreportreceived", (e) => {
                        pxt.debug(`input report`)
                        const dr = Windows.Storage.Streams.DataReader.fromBuffer(e.report.data);
                        const values: number[] = [];
                        while (dr.unconsumedBufferLength) {
                            values.push(dr.readByte());
                        }
                        if (values.length == 65 && values[0] === 0) {
                            values.shift()
                        }
                        this.onData(new Uint8Array(values));
                    });
                    return Promise.resolve();
                })
                .catch((e) => {
                    const err = new Error(U.lf("Device not found"));
                    (<any>err).notifyUser = true;
                    return Promise.reject(err);
                });
        }

        private initUf2Selectors() {
            const whid = Windows.Devices.HumanInterfaceDevice.HidDevice;
            WindowsRuntimeIO.uf2Selectors = [];
            if (pxt.appTarget && pxt.appTarget.compile && pxt.appTarget.compile.hidSelectors) {
                pxt.appTarget.compile.hidSelectors.forEach((s) => {
                    const sel = whid.getDeviceSelector(parseInt(s.usagePage), parseInt(s.usageId), parseInt(s.vid), parseInt(s.pid));
                    WindowsRuntimeIO.uf2Selectors.push(sel);
                });
            }
        }
    }

    export function mkPacketIOAsync(): Promise<pxt.HF2.PacketIO> {
        const b = new WindowsRuntimeIO()
        return b.initAsync()
            .then(() => b);
    }
}