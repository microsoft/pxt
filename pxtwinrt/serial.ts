/// <reference path="./winrtrefs.d.ts"/>

type DeviceWatcher = Windows.Devices.Enumeration.DeviceWatcher;
type DeviceInfo = Windows.Devices.Enumeration.DeviceInformation;
type SerialDevice = Windows.Devices.SerialCommunication.SerialDevice;
type LoadOperation = Windows.Storage.Streams.DataReaderLoadOperation;
type IBuffer = Windows.Storage.Streams.IBuffer;
type AsyncOp<TResult, TProgress> = Windows.Foundation.IAsyncOperationWithProgress<TResult, TProgress>

namespace pxt.winrt {
    let watcher: DeviceWatcher;
    let deviceNameFilter: RegExp;
    let activePorts: pxt.Map<DevicePort> = {}

    interface DevicePort {
        info: DeviceInfo;
        device?: SerialDevice;
        readingOperation?: LoadOperation;
        cancellingDeferred?: Promise.Resolver<void>;
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

    export function suspendSerialAsync(): Promise<void> {
        if (watcher) {
            watcher.stop();
            watcher.removeEventListener("added", deviceAdded);
            watcher.removeEventListener("removed", deviceRemoved);
            watcher.removeEventListener("updated", deviceUpdated);
            watcher = undefined;
        }

        let stoppedReadingOpsPromise = Promise.resolve();
        Object.keys(activePorts).forEach((deviceId) => {
            const port = activePorts[deviceId];
            const currentRead = port.readingOperation;
            if (currentRead) {
                const deferred = Promise.defer<void>();
                port.cancellingDeferred = deferred;
                stoppedReadingOpsPromise = stoppedReadingOpsPromise.then(() => {
                    return deferred.promise
                        .timeout(500)
                        .catch((e) => {
                            pxt.reportError("winrt_device", `could not cancel reading operation for a device: ${e.message}`);
                        });
                });
                currentRead.cancel();
            }
        });
        return stoppedReadingOpsPromise
            .then(() => {
                Object.keys(activePorts).forEach((deviceId) => {
                    const port = activePorts[deviceId];
                    if (port.device) {
                        const device = port.device;
                        device.close();
                    }
                });
                activePorts = {};
            });
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

    let readingOpsCount = 0;
    function startDevice(id: string) {
        let port = activePorts[id];
        if (!port) return;
        if (!port.device) {
            let status = Windows.Devices.Enumeration.DeviceAccessInformation.createFromId(id).currentStatus;
            pxt.reportError("winrt_device", `could not connect to serial device; device status: ${status}`);
            return;
        }

        const streams = Windows.Storage.Streams;
        port.device.baudRate = 115200;
        let stream = port.device.inputStream;
        let reader = new streams.DataReader(stream);
        reader.inputStreamOptions = streams.InputStreamOptions.partial;
        let serialBuffers: pxt.Map<string> = {};
        let readMore = () => {
            // Make sure the device is still active
            if (!activePorts[id] || !!port.cancellingDeferred) {
                return;
            }
            port.readingOperation = reader.loadAsync(32);
            port.readingOperation.done((bytesRead) => {
                let msg = reader.readString(Math.floor(reader.unconsumedBufferLength / 4) * 4);
                pxt.Util.bufferSerial(serialBuffers, msg, id);
                setTimeout(() => readMore(), 1);
            }, (e) => {
                const status = (<any>port.readingOperation).operation.status;
                if (status === Windows.Foundation.AsyncStatus.canceled) {
                    reader.detachStream();
                    reader.close();
                    if (port.cancellingDeferred) {
                        setTimeout(() => port.cancellingDeferred.resolve(), 25);
                    }
                } else {
                    setTimeout(() => startDevice(id), 1000);
                }
            });
        };
        setTimeout(() => readMore(), 100);
    }
}