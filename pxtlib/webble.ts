namespace pxt.webBluetooth {

    export let isEnabled = false

    export function setEnabled(v: boolean) {
        if (!isAvailable()) v = false
        isEnabled = v
    }

    export function isAvailable() {
        return !!navigator.bluetooth
            && ('TextDecoder' in window) // needed for reading data
            && pxt.appTarget.appTheme.bluetoothUartFilters
            && pxt.appTarget.appTheme.bluetoothUartFilters.length > 0;
    }

    function wrapPromise<T>(p: Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            p.then(r => resolve(r), e => reject(e));
        })
    }

    class BLEService {
        constructor(protected device: BLEDevice) { }

        connectAsync(): Promise<void> {
            return Promise.resolve();
        }

        disconnect(): void { }
    }

    class UARTService extends BLEService {
        // Nordic UART BLE service
        static SERVICE_UUID: BluetoothServiceUUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // must be lower case!
        static CHARACTERISTIC_RX_UUID: BluetoothCharacteristicUUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
        static CHARACTERISTIC_TX_UUID: BluetoothCharacteristicUUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

        uartService: BluetoothRemoteGATTService;
        txCharacteristic: BluetoothRemoteGATTCharacteristic;

        constructor(protected device: BLEDevice) {
            super(device);
            this.handleUARTNotifications = this.handleUARTNotifications.bind(this);
        }

        connectAsync(): Promise<void> {
            if (this.txCharacteristic)
                return Promise.resolve();
            pxt.debug(`ble: connecting uart`);
            return this.device.connectAsync()
                .then(gattServer => wrapPromise(gattServer.getPrimaryService(UARTService.SERVICE_UUID)))
                .then(service => {
                    pxt.debug(`ble: uart service connected`)
                    this.uartService = service;
                    return wrapPromise(this.uartService.getCharacteristic(UARTService.CHARACTERISTIC_TX_UUID));
                }).then(txCharacteristic => {
                    pxt.debug(`ble: uart tx characteristic connected`)
                    this.txCharacteristic = txCharacteristic;
                    return wrapPromise(this.txCharacteristic.startNotifications())
                }).then(() => {
                    this.txCharacteristic.addEventListener('characteristicvaluechanged', this.handleUARTNotifications);
                });
        }

        handleUARTNotifications(event: Event) {
            const dataView: DataView = (<any>event.target).value;
            const decoder = new (<any>window).TextDecoder();
            const text = decoder.decode(dataView);
            if (text) {
                window.postMessage({
                    type: "serial",
                    id: this.device.name || "ble",
                    data: text
                }, "*")
            }
        }

        disconnect() {
            try {
                if (this.txCharacteristic && this.device.connected) {
                    try {
                        this.txCharacteristic.stopNotifications();
                        this.txCharacteristic.removeEventListener('characteristicvaluechanged', this.handleUARTNotifications);
                    } catch (e) { }
                }
                this.uartService = undefined;
                this.txCharacteristic = undefined;
            } catch (e) {
                pxt.log(`uart: error ${e.message}`)
            }
        }
    }

    class PartialFlashingService extends BLEService {
        static SERVICE_UUID = 'e97dd91d-251d-470a-a062-fa1922dfa9a8';
        static CHARACTERISTIC_UUID = 'e97d3b10-251d-470a-a062-fa1922dfa9a8';
        static REGION_INFO = 0x00;
        static FLASH_DATA = 0x01;
        static PACKET_OUT_OF_ORDER = 0xAA;
        static PACKET_WRITTEN = 0xFF;
        static END_OF_TRANSMISSION = 0x02;
        static MICROBIT_STATUS = 0xEE;
        static MICROBIT_RESET = 0xFF;
        static MICROBIT_MODE_PAIRING = 0x01;
        static REGION_SOFTDEVICE = 0x00;
        static REGION_DAL = 0x01;
        static REGION_MAKECODE = 0x02;

        constructor(protected device: BLEDevice) {
            super(device);
        }

        partialFlashAsync(): Promise<void> {
            const state = {
                version: 0,
                mode: 0,
                regions: [{
                    start: 0,
                    end: 0,
                    hash: ""
                }]
            }

            let pfCharacteristic: BluetoothRemoteGATTCharacteristic;
            let flashOffset = 0;

            function flashData(offset: number, data: Uint8Array) {
                const chunk = new Uint8Array(16);
                chunk[0] = PartialFlashingService.FLASH_DATA;

                chunk[3] = 0; // packet number
                chunk[1] = offset >> 8;
                chunk[2] = offset;
                for (let i = 0; i < 16; i++)
                    chunk[4 + i] = data[i];
                pfCharacteristic.writeValue(chunk);

                chunk[3] = 1; // packet number
                chunk[1] = offset >> 24;
                chunk[2] = offset >> 16;
                for (let i = 0; i < 16; i++)
                    chunk[4 + i] = data[16 + i];
                pfCharacteristic.writeValue(chunk);

                chunk[3] = 2; // packet number
                chunk[1] = 0;
                chunk[2] = 0;
                for (let i = 0; i < 16; i++)
                    chunk[4 + i] = data[32 + i];
                pfCharacteristic.writeValue(chunk);

                chunk[3] = 3; // packet number
                for (let i = 0; i < 16; i++)
                    chunk[4 + i] = data[48 + i];
                pfCharacteristic.writeValue(chunk);
            }

            pxt.debug(`ble: connecting to partial flash service of ${this.device.name || "?"}`);
            return this.device.connectAsync()
                .then(gattServer => gattServer.getPrimaryService(PartialFlashingService.SERVICE_UUID))
                .then(service => {
                    pxt.debug(`ble: connecting to partial flash characteristic`)
                    return wrapPromise(service.getCharacteristic(PartialFlashingService.CHARACTERISTIC_UUID));
                }).then(characteristic => {
                    pxt.debug(`ble: starting notifications of partial flash`)
                    pfCharacteristic = characteristic;
                    pfCharacteristic.startNotifications();
                    pfCharacteristic.addEventListener('characteristicvaluechanged', (ev) => {
                        const dataView: DataView = (<any>event.target).value;
                        const packet = new Uint8Array(dataView.buffer);
                        const cmd = packet[0];
                        switch (cmd) {
                            case PartialFlashingService.MICROBIT_STATUS:
                                state.version = packet[1];
                                state.mode = packet[2];
                                pxt.debug(`ble: flash service version ${state.version} mode ${state.mode}`)
                                if (state.mode != PartialFlashingService.MICROBIT_MODE_PAIRING) {
                                    pxt.debug(`ble: reset into pairing mode`)
                                    characteristic.writeValue(new Uint8Array([PartialFlashingService.MICROBIT_RESET, PartialFlashingService.MICROBIT_MODE_PAIRING]));
                                    // user needs to try again TODO
                                    return;
                                }

                                pxt.debug(`ble: reading DAL region`)
                                pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.REGION_INFO, PartialFlashingService.REGION_DAL]));
                                break;
                            case PartialFlashingService.REGION_INFO:
                                const region = state.regions[packet[1]] = {
                                    start: (packet[2] << 24) | (packet[3] << 16) | (packet[4] << 8) | packet[5],
                                    end: (packet[6] << 24) | (packet[7] << 16) | (packet[8] << 8) | packet[9],
                                    hash: pxt.Util.toHex(packet.slice(10))
                                };
                                pxt.debug(`read region ${packet[1]} start ${region.start.toString(16)} end ${region.end.toString(16)} hash ${region.hash}`)
                                if (packet[1] == PartialFlashingService.REGION_DAL) {
                                    pxt.debug(`ble: reading makecode region`)
                                    pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.REGION_INFO, PartialFlashingService.REGION_MAKECODE]));
                                } else if (packet[1] == PartialFlashingService.REGION_MAKECODE) {
                                    // test hashes 
                                    // ready to flash the data in 4 chunks
                                    flashData(flashOffset, new Uint8Array(64));
                                }
                                break;
                            case PartialFlashingService.FLASH_DATA:
                                switch (packet[1]) {
                                    case PartialFlashingService.PACKET_OUT_OF_ORDER:
                                        pxt.debug(`ble: packet out of order`);
                                        break;
                                    case PartialFlashingService.PACKET_WRITTEN:
                                        pxt.debug(`ble: packet written`);
                                        flashOffset += 64;
                                        flashData(flashOffset, new Uint8Array(64));
                                        break;
                                }
                            default:
                                pxt.debug(`ble: unknown message ${pxt.Util.toHex(packet)}`);
                                break;
                        }
                    })
                    // check PF version
                    pxt.debug(`ble: check partial flash service version`)
                    characteristic.writeValue(new Uint8Array([PartialFlashingService.MICROBIT_STATUS]));
                })
        }
    }

    class BLEDevice {
        private device: BluetoothDevice = undefined;
        private services: BLEService[] = [];
        uartService: UARTService;
        partialFlashingService: PartialFlashingService;

        constructor(device: BluetoothDevice) {
            this.device = device;
            this.handleDisconnected = this.handleDisconnected.bind(this);
            device.addEventListener('gattserverdisconnected', this.handleDisconnected);

            this.services.push(this.uartService = new UARTService(this));
            this.services.push(this.partialFlashingService = new PartialFlashingService(this));
        }

        get name(): string {
            return this.device.name || "?";
        }

        get connected(): boolean {
            return this.device && this.device.gatt && this.device.gatt.connected;
        }

        connectAsync(): Promise<BluetoothRemoteGATTServer> {
            if (this.connected) return Promise.resolve(this.device.gatt);
            return wrapPromise<BluetoothRemoteGATTServer>(this.device.gatt.connect());
        }

        handleDisconnected(event: Event) {
            pxt.debug(`ble: gatt disconnected`)
            this.disconnect();
        }

        disconnect() {
            pxt.debug(`ble: disconnect`)
            try {
                this.services.forEach(service => service.disconnect());
                if (this.device && this.device.gatt && this.device.gatt.connected) {
                    try {
                        this.device.gatt.disconnect();
                    } catch (e) {
                        pxt.debug(`ble: gatt disconnect error ${e.message}`);
                    }
                }
            } catch (e) {
                pxt.log(`ble: error ${e.message}`)
            }
        }
    }

    let bleDevice: BLEDevice = undefined;
    export function pairAsync(): Promise<void> {
        if (bleDevice)
            bleDevice.disconnect();
        bleDevice = undefined;
        pxt.log(`ble: requesting device`)
        return navigator.bluetooth.requestDevice({
            filters: pxt.appTarget.appTheme.bluetoothUartFilters,
            optionalServices: [UARTService.SERVICE_UUID, PartialFlashingService.SERVICE_UUID]
        }).then(device => {
            pxt.log(`ble: received device ${device.name}`)
            bleDevice = new BLEDevice(device);
            return bleDevice.uartService.connectAsync();
        }, e => {
            pxt.log(`ble: error ${e.message}`)
        })
    }
}