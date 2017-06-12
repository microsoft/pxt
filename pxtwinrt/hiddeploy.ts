/// <reference path="../typings/globals/bluebird/index.d.ts"/>
/// <reference path="./winrtrefs.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.winrt {
    class WindowsRuntimeIO implements pxt.HF2.PacketIO {
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
                this.dev.removeEventListener('inputreportreceived', this.onInputReportReceived);
                this.dev.close();
                delete this.dev;
            }
            return Promise.resolve();
        }

        sendPacketAsync(pkt: Uint8Array): Promise<void> {
            if (!this.dev) return Promise.resolve();

            const ar: number[] = [0];
            for (let i = 0; i < 64; ++i)
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
            const selector = Windows.Devices.HumanInterfaceDevice.HidDevice.getDeviceSelector(0xff97, 0x0001);
            return pxt.winrt.promisify(Windows.Devices.Enumeration.DeviceInformation.findAllAsync(selector, null)
                .then(devices => {
                    pxt.debug(`hid enumerate ${devices.length} devices`)
                    const device = devices[0];
                    if (device) {
                        pxt.debug(`hid connect to ${device.name} (${device.id})`);
                        return Windows.Devices.HumanInterfaceDevice.HidDevice.fromIdAsync(device.id, Windows.Storage.FileAccessMode.readWrite)
                            .then((r: Windows.Devices.HumanInterfaceDevice.HidDevice) => {
                                this.dev = r;
                                if (this.dev) {
                                    pxt.debug(`hid device version ${this.dev.version}`);
                                    this.dev.addEventListener("inputreportreceived", this.onInputReportReceived)
                                } else {
                                    pxt.debug(`no hid device found`);
                                }
                            });
                    }
                    else return Promise.resolve();
                }))
        }

        onInputReportReceived(e: Windows.Devices.HumanInterfaceDevice.HidInputReportReceivedEventArgs): void {
            pxt.debug(`input report`)
            const dr = Windows.Storage.Streams.DataReader.fromBuffer(e.report.data);
            const ar: number[] = [];
            dr.readBytes(ar);
            const uar = new Uint8Array(ar.length);
            for (let i = 0; i < ar.length; ++i)
                uar[i] = ar[i];
            this.onData(uar);
        }
    }

    export function mkPacketIOAsync(): Promise<pxt.HF2.PacketIO> {
        const b = new WindowsRuntimeIO()
        return b.initAsync()
            .then(() => b);
    }
}