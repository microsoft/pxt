/// <reference path="../typings/globals/bluebird/index.d.ts"/>
/// <reference path="./winrtrefs.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.winrt {
    class WindowsRuntimeIO implements pxt.HF2.PacketIO {
        onData = (v: Uint8Array) => { };
        onEvent = (v: Uint8Array) => { };
        onError = (e: Error) => { };
        onSerial = (v: Uint8Array, isErr: boolean) => { };
        public devs: Windows.Devices.HumanInterfaceDevice.HidDevice[];

        constructor() {
        }

        onOOB(v: any) {
            if (v.op == "serial") {
                this.onSerial(U.fromHex(v.result.data), v.result.isError)
            } else if (v.op = "event") {
                this.onEvent(U.fromHex(v.result.data))
            }
        }

        talksAsync(cmds: pxt.HF2.TalkArgs[]): Promise<Uint8Array[]> {
            // TODO
            /*
            return iface.opAsync("talk", {
                path: this.dev.path,
                cmds: cmds.map(c => ({ cmd: c.cmd, data: c.data ? U.toHex(c.data) : "" }))
            })
                .then(resp => {
                    return resp.map((v: any) => U.fromHex(v.data))
                }) */
            return Promise.resolve([]);
        }

        error(msg: string) {
            throw new Error(U.lf("USB/HID error on device {0} ({1})", this.dev.productId, msg))
        }

        reconnectAsync(): Promise<void> {
            return this.initAsync()
        }

        disconnectAsync(): Promise<void> {
            // TODO
            return Promise.resolve();
        }

        sendPacketAsync(pkt: Uint8Array): Promise<void> {
            throw new Error("should use talksAsync()!")
        }

        sendSerialAsync(buf: Uint8Array, useStdErr: boolean): Promise<void> {
            // TODO
            return Promise.resolve();
            /*
            return iface.opAsync("sendserial", {
                path: this.dev.path,
                data: U.toHex(buf),
                isError: useStdErr
            }) */
        }

        initAsync(): Promise<void> {
            const selector = Windows.Devices.HumanInterfaceDevice.HidDevice.getDeviceSelector(0xff42, 0x0042);
            const opts: Windows.Foundation.Collections.IIterable<string> = {
                first: () => null
            };
            return pxt.winrt.promisify(Windows.Devices.Enumeration.DeviceInformation.findAllAsync(selector, opts)
                .then(devices => Promise.all(devices.map(device => Windows.Devices.HumanInterfaceDevice.HidDevice.fromIdAsync(device.id
                    , Windows.Storage.FileAccessMode.readWrite))))
                .then(devices => {
                    this.devs = devices;
                }));
            /*
            return iface.opAsync("list", {})
                .then((devs: any) => {
                    let d0 = (devs.devices as HidDevice[]).filter(d => (d.release & 0xff00) == 0x4200)[0]
                    if (d0) {
                        if (this.dev)
                            delete bridgeByPath[this.dev.path]
                        this.dev = d0
                        bridgeByPath[this.dev.path] = this
                    }
                    else throw new Error("No device connected")
                })
                .then(() => iface.opAsync("init", {
                    path: this.dev.path
                })) */
        }
    }

    export function hidDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
        pxt.debug('HID deployment...');
        let f = resp.outfiles[pxtc.BINARY_UF2]
        let blocks = pxtc.UF2.parseFile(Util.stringToUint8Array(atob(f)))

        const b = new WindowsRuntimeIO()
        return b.initAsync()
            .then(dev => dev.reflashAsync(blocks))
    }
}