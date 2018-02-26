/// <reference path="./winrtrefs.d.ts"/>

type DeviceWatcher = Windows.Devices.Enumeration.DeviceWatcher;
type DeviceInfo = Windows.Devices.Enumeration.DeviceInformation;
type DeviceInfoCollection = Windows.Devices.Enumeration.DeviceInformationCollection;
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

    /**
     * Most Arduino devices support switching into bootloader by opening the COM port at 1200 baudrate.
     */
    export function bootloaderViaBaud() {
        if (!appTarget || !appTarget.compile || !appTarget.compile.useUF2 ||
            !appTarget.simulator || !appTarget.simulator.boardDefinition || !appTarget.simulator.boardDefinition.uf2BootloaderBaudSwitch) {
            return Promise.reject(new Error("device does not support switching to bootloader via baudrate"));
        }
        let allSerialDevices: Windows.Devices.SerialCommunication.SerialDevice[];
        const vidPidInfo = appTarget.simulator.boardDefinition.uf2BootloaderBaudSwitch;
        const selector: pxtc.HidSelector = {
            vid: vidPidInfo.vid,
            pid: vidPidInfo.pid,
            usageId: undefined,
            usagePage: undefined
        };
        return connectSerialDevicesAsync([selector])
            .then((serialDevices) => {
                if (!serialDevices || serialDevices.length === 0) {
                    // No device found, it really looks like no device is plugged in. Bail out.
                    return Promise.reject(new Error("no serial devices to switch into bootloader"));
                }

                allSerialDevices = serialDevices;

                if (allSerialDevices.length) {
                    isSwitchingToBootloader();
                }

                allSerialDevices.forEach((dev) => {
                    dev.baudRate = 1200;
                    dev.close();
                });

                // A long delay is needed before attempting to connect to the bootloader device, enough for the OS to
                // recognize the device has been plugged in. Without drivers, connection to the device might still fail
                // the first time, but drivers should be installed by the time the user clicks Download again, at which
                // point flashing will work without the user ever needing to manually set the device to bootloader
                return Promise.delay(1500);
            });
    }

    /**
     * Connects to all matching serial devices without initializing the full PXT serial stack. Returns the list of
     * devices that were successfully connected to, but doesn't do anything with these devices.
     */
    export function connectSerialDevicesAsync(hidSelectors: pxtc.HidSelector[]): Promise<SerialDevice[]> {
        if (!hidSelectors) {
            return Promise.resolve([]);
        }

        const wd = Windows.Devices;
        const sd = wd.SerialCommunication.SerialDevice;
        const di = wd.Enumeration.DeviceInformation;
        const serialDeviceSelectors: string[] = [];

        hidSelectors.forEach((s) => {
            const sel = sd.getDeviceSelectorFromUsbVidPid(
                parseInt(s.vid),
                parseInt(s.pid)
            );
            serialDeviceSelectors.push(sel);
        });
        const allDevicesPromise = serialDeviceSelectors.reduce((promiseSoFar, sel) => {
            let deviceInfoSoFar: DeviceInfoCollection;
            return promiseSoFar
                .then((diSoFar) => {
                    deviceInfoSoFar = diSoFar;
                    return di.findAllAsync(sel, null);
                })
                .then((foundDevices: DeviceInfoCollection) => {
                    if (deviceInfoSoFar) {
                        for (let i = 0; i < foundDevices.length; ++i) {
                            deviceInfoSoFar.push(foundDevices[i]);
                        }
                    } else {
                        deviceInfoSoFar = foundDevices;
                    }
                    return Promise.resolve(deviceInfoSoFar);
                });
        }, Promise.resolve<DeviceInfoCollection>(null));

        return allDevicesPromise
            .then((allDeviceInfo) => {
                if (!allDeviceInfo) {
                    return Promise.resolve([]);
                }

                return Promise.map(allDeviceInfo, (devInfo: DeviceInfo) => {
                    return sd.fromIdAsync(devInfo.id);
                });
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

    function startDevice(id: string) {
        let port = activePorts[id];
        if (!port) return;
        if (!port.device) {
            let status = (Windows.Devices as any).Enumeration.DeviceAccessInformation.createFromId(id).currentStatus;
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