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
    // https://lancaster-university.github.io/microbit-docs/resources/bluetooth/bluetooth_profile.html
    const UART_SERVICE_UUID: BluetoothServiceUUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // must be lower case!
    //const UART_CHARACTERISTIC_RX_UUID: BluetoothCharacteristicUUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
    const UART_CHARACTERISTIC_TX_UUID: BluetoothCharacteristicUUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

    class UartReader {
        device: BluetoothDevice = undefined;
        server: BluetoothRemoteGATTServer = undefined;
        service: BluetoothRemoteGATTService = undefined;
        txCharacteristic: BluetoothRemoteGATTCharacteristic = undefined;

        constructor(device: BluetoothDevice) {
            this.device = device;
            this.handleDisconnected = this.handleDisconnected.bind(this);
            this.handleNotifications = this.handleNotifications.bind(this);

            device.addEventListener('gattserverdisconnected', this.handleDisconnected);
        }

        connectAsync(): Promise<void> {
            pxt.debug(`uart: connecting ${this.device.name}`)
            return new Promise((resolve, reject) => {
                this.device.gatt.connect()
                    .then(server => {
                        pxt.debug(`uart: gatt server connected`)
                        this.server = server;
                        return this.server.getPrimaryService(UART_SERVICE_UUID);
                    })
                    .then(service => {
                        pxt.debug(`uart: uart service connected`)
                        this.service = service;
                        return this.service.getCharacteristic(UART_CHARACTERISTIC_TX_UUID);
                    }).then(txCharacteristic => {
                        pxt.debug(`uart: read characteristic connected`)
                        this.txCharacteristic = txCharacteristic;
                        return this.txCharacteristic.startNotifications()
                    }).then(() => {
                        this.txCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotifications);
                        resolve();
                    }, (e: Error) => {
                        pxt.log(`uart: error ${e.message}`)
                        this.disconnect();
                        resolve();
                    });
            });
        }

        handleDisconnected(event: Event) {
            pxt.debug(`uart: gatt disconnected`)
            this.disconnect();
        }

        handleNotifications(event: Event) {
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
                if (this.txCharacteristic) {
                    try {
                        this.txCharacteristic.stopNotifications();
                        this.txCharacteristic.removeEventListener('characteristicvaluechanged', this.handleNotifications);
                    } catch (e) { }
                }
                if (this.device && this.device.gatt && this.device.gatt.connected) {
                    try {
                        this.device.gatt.disconnect();
                    } catch (e) { }
                }
                this.server = undefined;
                this.service = undefined;
                this.txCharacteristic = undefined;
            } catch (e) {
                pxt.log(`uart: error ${e.message}`)
            }
        }
    }

    let reader: UartReader = undefined;
    export function pairAsync(): Promise<void> {
        if (reader)
            reader.disconnect();
        reader = undefined;

        pxt.log(`uart: requesting device`)
        return navigator.bluetooth.requestDevice({
            filters: pxt.appTarget.appTheme.bluetoothUartFilters,
            optionalServices: [UART_SERVICE_UUID]
        }).then(device => {
            pxt.log(`uart: received device ${device.name}`)
            reader = new UartReader(device);
            return reader.connectAsync();
        }, e => {
            pxt.log(`uart: error ${e.message}`)
            return Promise.resolve();
        })
    }
}