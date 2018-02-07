/// <reference path="./winrtrefs.d.ts"/>

type DeviceWatcher = Windows.Devices.Enumeration.DeviceWatcher;
type DeviceInfo = Windows.Devices.Enumeration.DeviceInformation;
type SerialDevice = Windows.Devices.SerialCommunication.SerialDevice;

namespace pxt.winrt {
    let watcher: DeviceWatcher;
    let deviceNameFilter: RegExp;
    let activePorts: pxt.Map<DevicePort> = {}

    interface DevicePort {
        info: DeviceInfo;
        device?: SerialDevice;
    }

    export function initSerial() {
        const hasFilter = !!pxt.appTarget.serial.nameFilter ||
            (pxt.appTarget.serial.vendorId && pxt.appTarget.serial.productId);
        if (!pxt.appTarget.serial
            || !pxt.appTarget.serial.log
            || !hasFilter) return;

        const sd = Windows.Devices.SerialCommunication.SerialDevice;
        let serialDeviceSelector: string;

        if (!pxt.appTarget.serial.vendorId || !pxt.appTarget.serial.productId) {
            deviceNameFilter = new RegExp(pxt.appTarget.serial.nameFilter);
            serialDeviceSelector = sd.getDeviceSelector();
        } else {
            serialDeviceSelector = sd.getDeviceSelectorFromUsbVidPid(
                parseInt(pxt.appTarget.serial.vendorId),
                parseInt(pxt.appTarget.serial.productId)
            );
        }

        // Create a device watcher to look for instances of the Serial device
        // As per MSDN doc, to use the correct overload, we pass null as 2nd argument
        watcher = Windows.Devices.Enumeration.DeviceInformation.createWatcher(serialDeviceSelector, null);
        watcher.addEventListener("added", deviceAdded);
        watcher.addEventListener("removed", deviceRemoved);
        watcher.addEventListener("updated", deviceUpdated);
        watcher.start();
    }

    export function suspendSerial() {
        if (watcher) {
            watcher.stop();
            watcher.removeEventListener("added", deviceAdded);
            watcher.removeEventListener("removed", deviceRemoved);
            watcher.removeEventListener("updated", deviceUpdated);
            watcher = undefined;
        }

        Object.keys(activePorts).forEach((deviceId) => {
            const port = activePorts[deviceId];
            const device = port.device;
            device.close();
        });
        activePorts = {};
    }

    function deviceAdded(deviceInfo: DeviceInfo) {
        if (deviceNameFilter && !deviceNameFilter.test(deviceInfo.name)) {
            return;
        }

        pxt.debug(`serial port added ${deviceInfo.name} - ${deviceInfo.id}`);
        activePorts[deviceInfo.id] = {
            info: deviceInfo
        };
        Windows.Devices.SerialCommunication.SerialDevice.fromIdAsync(deviceInfo.id)
            .done((dev: SerialDevice) => {
                activePorts[deviceInfo.id].device = dev;
                startDevice(deviceInfo.id);
            });
        // connectToDevice(deviceInfo.id);
    }

    function deviceRemoved(deviceInfo: DeviceInfo) {
        delete activePorts[deviceInfo.id];
    }

    function deviceUpdated(deviceInfo: DeviceInfo) {
        const port = activePorts[deviceInfo.id];
        if (port) {
            port.info.update(deviceInfo);
        }
    }

    // function connectToDevice(id: string): void {
    //     Windows.Devices.SerialCommunication.SerialDevice.fromIdAsync(id)
    //         .done((dev: SerialDevice) => {
    //             activePorts[id].device = dev;
    //             startDevice(id);
    //         });
    // }

    function startDevice(id: string) {
        let port = activePorts[id];
        if (!port) return;
        if (!port.device) {
            let status = Windows.Devices.Enumeration.DeviceAccessInformation.createFromId(id).currentStatus;
            // if (status === Windows.Devices.Enumeration.DeviceAccessStatus.allowed) {
            //     // Sometimes, attempting to connect to early in the app life cycles results in fromIdAsync returning
            //     // null even if the device can be connected to. Retry in a few.
            //     setTimeout(connectToDevice(id), 1000);
            //     return;
            // }
            pxt.debug(`device issue: ${status}`);
            return;
        }

        port.device.baudRate = 115200;
        let stream = port.device.inputStream;
        let reader = new Windows.Storage.Streams.DataReader(stream);
        let serialBuffers: pxt.Map<string> = {};
        let readMore = () => {
            // Make sure the device is still active
            if (!activePorts[id]) {
                return;
            }
            reader.loadAsync(32).done((bytesRead) => {
                let msg = reader.readString(Math.floor(bytesRead / 4) * 4);
                pxt.Util.bufferSerial(serialBuffers, msg, id);
                readMore();
            }, (e) => {
                setTimeout(() => startDevice(id), 1000);
            });
        };
        setTimeout(() => readMore(), 100);
    }
}