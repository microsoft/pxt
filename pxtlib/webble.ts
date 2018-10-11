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
            if (this.txCharacteristic && this.device.connected) {
                try {
                    this.txCharacteristic.stopNotifications();
                    this.txCharacteristic.removeEventListener('characteristicvaluechanged', this.handleUARTNotifications);
                } catch (e) {
                    pxt.log(`uart: error ${e.message}`)
                }
            }
            this.uartService = undefined;
            this.txCharacteristic = undefined;
        }
    }

    enum PartialFlashingState {
        Idle = 1 << 0,
        StatusRequested = 1 << 1,
        PairingModeRequested = 1 << 2,
        RegionDALRequested = 1 << 3,
        RegionMakeCodeRequested = 1 << 4,
        Flash = 1 << 5,
        EndOfTransmision = 1 << 6
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

        private pfCharacteristic: BluetoothRemoteGATTCharacteristic;
        private state = PartialFlashingState.Idle;
        private version: number;
        private mode: number;
        private regions: { start: number; end: number; hash: string; }[];


        private offset: number;
        private hex: Uint8Array;
        private flashResolve: (theResult?: void | PromiseLike<void>) => void;
        private flashReject: (e: any) => void;

        constructor(protected device: BLEDevice) {
            super(device);
            this.handleCharacteristic = this.handleCharacteristic.bind(this);
        }

        connectAsync(): Promise<void> {
            if (this.pfCharacteristic) return Promise.resolve();
            pxt.debug(`ble: connecting to partial flash service`);
            return this.device.connectAsync()
                .then(gattServer => wrapPromise(gattServer.getPrimaryService(PartialFlashingService.SERVICE_UUID)))
                .then(service => {
                    pxt.debug(`ble: connecting to partial flash characteristic`)
                    return wrapPromise(service.getCharacteristic(PartialFlashingService.CHARACTERISTIC_UUID));
                }).then(characteristic => {
                    pxt.debug(`ble: starting notifications of partial flash`)
                    this.pfCharacteristic = characteristic;
                    this.pfCharacteristic.startNotifications();
                    this.pfCharacteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristic);
                });
        }

        disconnect() {
            this.state = PartialFlashingState.Idle;
            if (this.pfCharacteristic && this.device.connected) {
                try {
                    this.pfCharacteristic.stopNotifications();
                    this.pfCharacteristic.removeEventListener('characteristicvaluechanged', this.handleCharacteristic);
                }
                catch (e) {
                    pxt.log(`ble: partial flash disconnect error ${e.message}`);
                }
            }
            this.pfCharacteristic = undefined;
            const rej = this.flashReject;
            this.clearFlashData();
            if (rej)
                rej(new Error("device disconnected"))
        }

        private clearFlashData() {
            this.version = 0;
            this.mode = 0;
            this.regions = [];
            this.offset = 0;
            this.hex = undefined;
            this.flashReject = undefined;
            this.flashResolve = undefined;
        }

        flashAsync(hex: Uint8Array): Promise<void> {
            if (this.hex) {
                pxt.debug(`ble: flashing already in progress`)
                return Promise.resolve();
            }
            this.clearFlashData();
            this.hex = hex;
            return this.connectAsync()
                .then(() => new Promise((resolve, reject) => {
                    this.flashResolve = resolve;
                    this.flashReject = reject;
                    pxt.debug(`ble: check partial flash service version`)
                    this.state = PartialFlashingState.StatusRequested;
                    this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.MICROBIT_STATUS]));
                }));
        }

        private checkStateTransition(cmd: number, acceptedStates: PartialFlashingState) {
            if (!(this.state & acceptedStates)) {
                pxt.debug(`ble: flash cmd ${cmd} in state ${this.state.toString(16)} `);
                this.disconnect();
                return false;
            }
            return true;
        }

        private handleCharacteristic(ev: Event) {
            const dataView: DataView = (<any>event.target).value;
            const packet = new Uint8Array(dataView.buffer);
            const cmd = packet[0];
            pxt.debug(`ble: flash state ${this.state} - cmd ${cmd}`);
            if (this.state == PartialFlashingState.Idle) // rogue response
                return;
            switch (cmd) {
                case PartialFlashingService.MICROBIT_STATUS:
                    if (!this.checkStateTransition(cmd, PartialFlashingState.StatusRequested))
                        return;
                    this.version = packet[1];
                    this.mode = packet[2];
                    pxt.debug(`ble: flash service version ${this.version} mode ${this.mode}`)
                    if (this.mode != PartialFlashingService.MICROBIT_MODE_PAIRING) {
                        pxt.debug(`ble: reset into pairing mode`)
                        this.state = PartialFlashingState.PairingModeRequested;
                        this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.MICROBIT_RESET, PartialFlashingService.MICROBIT_MODE_PAIRING]));
                        // user needs to try again TODO
                        return;
                    }

                    pxt.debug(`ble: reading DAL region`)
                    this.state = PartialFlashingState.RegionDALRequested;
                    this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.REGION_INFO, PartialFlashingService.REGION_DAL]));
                    break;
                case PartialFlashingService.REGION_INFO:
                    if (!this.checkStateTransition(cmd, PartialFlashingState.RegionDALRequested | PartialFlashingState.RegionMakeCodeRequested))
                        return;
                    const region = this.regions[packet[1]] = {
                        start: (packet[2] << 24) | (packet[3] << 16) | (packet[4] << 8) | packet[5],
                        end: (packet[6] << 24) | (packet[7] << 16) | (packet[8] << 8) | packet[9],
                        hash: pxt.Util.toHex(packet.slice(10))
                    };
                    pxt.debug(`read region ${packet[1]} start ${region.start.toString(16)} end ${region.end.toString(16)} hash ${region.hash}`)
                    if (packet[1] == PartialFlashingService.REGION_DAL) {
                        pxt.debug(`ble: reading makecode region`)
                        this.state = PartialFlashingState.RegionMakeCodeRequested;
                        this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.REGION_INFO, PartialFlashingService.REGION_MAKECODE]));
                    } else if (packet[1] == PartialFlashingService.REGION_MAKECODE) {
                        // test hashes 
                        // ready to flash the data in 4 chunks
                        this.flashNextPacket();
                    }
                    break;
                case PartialFlashingService.FLASH_DATA:
                    if (!this.checkStateTransition(cmd, PartialFlashingState.Flash))
                        return;
                    switch (packet[1]) {
                        case PartialFlashingService.PACKET_OUT_OF_ORDER:
                            pxt.debug(`ble: packet out of order`);
                            break;
                        case PartialFlashingService.PACKET_WRITTEN:
                            this.offset += 64;
                            if (this.offset == this.hex.length) {
                                pxt.debug('ble: end transmission')
                                this.state = PartialFlashingState.EndOfTransmision;
                                this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.END_OF_TRANSMISSION]));
                                // we are done!
                                this.flashResolve();
                                this.clearFlashData();
                            } else { // keep flashing
                                this.flashNextPacket();
                            }
                            break;
                    }
                default:
                    pxt.debug(`ble: unknown message ${pxt.Util.toHex(packet)}`);
                    this.disconnect();
                    break;
            }
        }

        // send 64bytes in 4 BLE packets
        private flashNextPacket() {
            this.state = PartialFlashingState.Flash;

            pxt.debug(`ble: flashing offset ${this.offset} of ${this.hex.length}`);

            const o = this.offset;
            const chunk = new Uint8Array(16);
            chunk[0] = PartialFlashingService.FLASH_DATA;

            chunk[3] = 0; // packet number
            chunk[1] = o >> 8; // 2 bytes of offset
            chunk[2] = o;
            for (let i = 0; i < 16; i++)
                chunk[4 + i] = this.hex[i];
            this.pfCharacteristic.writeValue(chunk);

            chunk[3] = 1; // packet number
            chunk[1] = o >> 24; // other 2 bytes of offset
            chunk[2] = o >> 16;
            for (let i = 0; i < 16; i++)
                chunk[4 + i] = this.hex[16 + i];
            this.pfCharacteristic.writeValue(chunk);

            chunk[3] = 2; // packet number
            chunk[1] = 0;
            chunk[2] = 0;
            for (let i = 0; i < 16; i++)
                chunk[4 + i] = this.hex[32 + i];
            this.pfCharacteristic.writeValue(chunk);

            chunk[3] = 3; // packet number
            for (let i = 0; i < 16; i++)
                chunk[4 + i] = this.hex[48 + i];
            this.pfCharacteristic.writeValue(chunk);
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
            this.services.forEach(service => service.disconnect());
            try {
                if (this.connected) {
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