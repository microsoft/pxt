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


    // Nordic UART BLE service
    const UART_SERVICE_UUID: BluetoothServiceUUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // must be lower case!
    //const UART_CHARACTERISTIC_RX_UUID: BluetoothCharacteristicUUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
    const UART_CHARACTERISTIC_TX_UUID: BluetoothCharacteristicUUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

    // partial flashing
    const PF_SERVICE_UUID = 'e97dd91d-251d-470a-a062-fa1922dfa9a8';
    const PF_CHARACTERISTIC_UUID = 'e97d3b10-251d-470a-a062-fa1922dfa9a8';
    const PF_REGION_INFO = 0x00;
    const PF_FLASH_DATA = 0x01;
    const PF_PACKET_OUT_OF_ORDER = 0xAA;
    const PF_PACKET_WRITTEN = 0xFF;
    const PF_END_OF_TRANSMISSION = 0x02;
    const PF_MICROBIT_STATUS = 0xEE;
    const PF_MICROBIT_RESET = 0xFF;
    const PF_MICROBIT_MODE_PAIRING = 0x01;
    const PF_REGION_SOFTDEVICE = 0x00;
    const PF_REGION_DAL = 0x01;
    const PF_REGION_MAKECODE = 0x02;

    class MicrobitDevice {
        device: BluetoothDevice = undefined;
        gattServer: BluetoothRemoteGATTServer = undefined;
        uartService: BluetoothRemoteGATTService = undefined;
        txCharacteristic: BluetoothRemoteGATTCharacteristic = undefined;

        constructor(device: BluetoothDevice) {
            this.device = device;
            this.handleDisconnected = this.handleDisconnected.bind(this);
            this.handleUARTNotifications = this.handleUARTNotifications.bind(this);

            device.addEventListener('gattserverdisconnected', this.handleDisconnected);
        }

        connectUARTAsync(): Promise<void> {
            pxt.debug(`ble: connecting ${this.device.name}`)
            return new Promise((resolve, reject) => {
                this.device.gatt.connect()
                    .then(server => {
                        pxt.debug(`ble: gatt server connected`)
                        this.gattServer = server;
                        return this.gattServer.getPrimaryService(UART_SERVICE_UUID);
                    })
                    .then(service => {
                        pxt.debug(`ble: uart service connected`)
                        this.uartService = service;
                        return this.uartService.getCharacteristic(UART_CHARACTERISTIC_TX_UUID);
                    }).then(txCharacteristic => {
                        pxt.debug(`ble: uart tx characteristic connected`)
                        this.txCharacteristic = txCharacteristic;
                        return this.txCharacteristic.startNotifications()
                    }).then(() => {
                        this.txCharacteristic.addEventListener('characteristicvaluechanged', this.handleUARTNotifications);
                        resolve();
                        this.partialFlashAsync();
                    }, (e: Error) => {
                        pxt.log(`ble: error ${e.message}`)
                        this.disconnect();
                        resolve();
                    });
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
                chunk[0] = PF_FLASH_DATA;

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

            return new Promise((resolve, reject) => {
                pxt.debug(`ble: connecting to partial flash service of ${this.device.name || "?"}`);
                this.gattServer.getPrimaryService(PF_SERVICE_UUID)
                    .then(service => {
                        pxt.debug(`ble: connecting to partial flash characteristic`)
                        return service.getCharacteristic(PF_CHARACTERISTIC_UUID);
                    }).then(characteristic => {
                        pxt.debug(`ble: starting notifications of partial flash`)
                        pfCharacteristic = characteristic;
                        pfCharacteristic.startNotifications();
                        pfCharacteristic.addEventListener('characteristicvaluechanged', (ev) => {
                            const dataView: DataView = (<any>event.target).value;
                            const packet = new Uint8Array(dataView.buffer);
                            const cmd = packet[0];
                            switch (cmd) {
                                case PF_MICROBIT_STATUS:
                                    state.version = packet[1];
                                    state.mode = packet[2];
                                    pxt.debug(`ble: flash service version ${state.version} mode ${state.mode}`)
                                    if (state.mode != PF_MICROBIT_MODE_PAIRING) {
                                        pxt.debug(`ble: reset into pairing mode`)
                                        characteristic.writeValue(new Uint8Array([PF_MICROBIT_RESET, PF_MICROBIT_MODE_PAIRING]));
                                        // user needs to try again TODO
                                        return;
                                    }

                                    pxt.debug(`ble: reading DAL region`)
                                    pfCharacteristic.writeValue(new Uint8Array([PF_REGION_INFO, PF_REGION_DAL]));
                                    break;
                                case PF_REGION_INFO:
                                    const region = state.regions[packet[1]] = {
                                        start: (packet[2] << 24) | (packet[3] << 16) | (packet[4] << 8) | packet[5],
                                        end: (packet[6] << 24) | (packet[7] << 16) | (packet[8] << 8) | packet[9],
                                        hash: pxt.Util.toHex(packet.slice(10))
                                    };
                                    pxt.debug(`read region ${packet[1]} start ${region.start.toString(16)} end ${region.end.toString(16)} hash ${region.hash}`)
                                    if (packet[1] == PF_REGION_DAL) {
                                        pxt.debug(`ble: reading makecode region`)
                                        pfCharacteristic.writeValue(new Uint8Array([PF_REGION_INFO, PF_REGION_MAKECODE]));
                                    } else if (packet[1] == PF_REGION_MAKECODE) {
                                        // test hashes 
                                        // ready to flash the data in 4 chunks
                                        flashData(flashOffset, new Uint8Array(64));
                                    }
                                    break;
                                case PF_FLASH_DATA:
                                    switch (packet[1]) {
                                        case PF_PACKET_OUT_OF_ORDER:
                                            pxt.debug(`ble: packet out of order`);
                                            break;
                                        case PF_PACKET_WRITTEN:
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
                        characteristic.writeValue(new Uint8Array([PF_MICROBIT_STATUS]));
                    })
            });
        }

        handleDisconnected(event: Event) {
            pxt.debug(`uart: gatt disconnected`)
            this.disconnect();
        }

        disconnect() {
            try {
                if (this.device && this.device.gatt && this.device.gatt.connected) {
                    if (this.txCharacteristic) {
                        try {
                            this.txCharacteristic.stopNotifications();
                            this.txCharacteristic.removeEventListener('characteristicvaluechanged', this.handleUARTNotifications);
                        } catch (e) { }
                    }
                    try {
                        this.device.gatt.disconnect();
                    } catch (e) { }
                }
                this.gattServer = undefined;
                this.uartService = undefined;
                this.txCharacteristic = undefined;
            } catch (e) {
                pxt.log(`uart: error ${e.message}`)
            }
        }
    }

    let reader: MicrobitDevice = undefined;
    export function pairAsync(): Promise<void> {
        if (reader)
            reader.disconnect();
        reader = undefined;

        pxt.log(`uart: requesting device`)
        return navigator.bluetooth.requestDevice({
            filters: pxt.appTarget.appTheme.bluetoothUartFilters,
            optionalServices: [UART_SERVICE_UUID, PF_SERVICE_UUID]
        }).then(device => {
            pxt.log(`uart: received device ${device.name}`)
            reader = new MicrobitDevice(device);
            return reader.connectUARTAsync();
        }, e => {
            pxt.log(`uart: error ${e.message}`)
            return Promise.resolve();
        })
    }
}