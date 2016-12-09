/// <reference path="../typings/winrt/winrt.d.ts"/>

namespace pxt.winrt {
    let watcher: any;
    let ports: pxt.Map<DevicePort> = {}
    let options: pxt.AppSerial;

    interface DevicePort {
        info: any;
        device?: any;
    }

    export function initSerial() {
        if (!pxt.appTarget.serial
            || !pxt.appTarget.serial.log
            || !pxt.appTarget.serial.nameFilter) return;

        const filter = new RegExp(pxt.appTarget.serial.nameFilter);
        const serialDeviceSelector = (Windows.Devices as any).SerialCommunication.SerialDevice.getDeviceSelector();
        // Create a device watcher to look for instances of the Serial device
        // The createWatcher() takes a string only when you provide it two arguments, so be sure to include an array as a second 
        // parameter (JavaScript can only recognize overloaded functions with different numbers of parameters).
        watcher = Windows.Devices.Enumeration.DeviceInformation.createWatcher(serialDeviceSelector, [] as any);
        watcher.addEventListener("added", (dis: any) => {
            toArray(dis.detail).forEach((di: any) => {
                if (!filter.test(di.name)) return;
                pxt.debug(`serial port added ${di.name} - ${di.id}`);
                ports[di.id] = {
                    info: di
                };
                (Windows.Devices as any).SerialCommunication.SerialDevice.fromIdAsync(di.id)
                    .done((dev: any) => {
                        ports[di.id].device = dev;
                        startDevice(di.id);
                    })
            });
        });
        watcher.addEventListener("removed", (dis: any) => {
            toArray(dis.detail).forEach((di: any) => delete ports[di.id]);
        })
        watcher.addEventListener("updated", (dis: any) => {
            toArray(dis.detail).forEach((di: any) => ports[di.id] ? ports[di.id].info.update(di.info) : null);
        })
        watcher.start();
    }

    function startDevice(id: string) {
        let port = ports[id];
        if (!port) return;
        if (!port.device) {
            let status = (Windows.Devices as any).Enumeration.DeviceAccessInformation.createFromId(id).currentStatus;
            pxt.debug(`device issue: ${status}`);
            return;
        }

        port.device.baudRate = 115200;
        let stream = port.device.inputStream;
        let reader = new Windows.Storage.Streams.DataReader(stream);
        let readMore = () => reader.loadAsync(32).done((bytesRead) => {
            let msg = reader.readString(Math.floor(bytesRead / 4) * 4);
            window.postMessage({
                type: 'serial',
                data: msg,
                id: id
            }, "*");
            readMore();
        }, (e) => {
            setTimeout(() => startDevice(id), 1000);
        });
        readMore();
    }
}