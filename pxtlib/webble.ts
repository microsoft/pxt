namespace pxt.webBluetooth {

    export let isEnabled = false

    export function setEnabled(v: boolean) {
        if (!isAvailable()) v = false
        isEnabled = v
    }

    export function isAvailable() {
        return !!navigator.bluetooth
    }


    // https://lancaster-university.github.io/microbit-docs/resources/bluetooth/bluetooth_profile.html
    const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
    const UART_CHARACTERISTIC_RX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
    const UART_CHARACTERISTIC_TX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

    class UartReader {
        device: BluetoothDevice = undefined;
        server: BluetoothRemoteGATTServer = undefined;
        service: BluetoothRemoteGATTService = undefined;
        readCharacteristic: BluetoothRemoteGATTCharacteristic = undefined;
        decoder: TextDecoder = new TextDecoder('utf8');

        constructor(device: BluetoothDevice) {
            this.device = device;
            this.handleNotifications = this.handleNotifications.bind(this);
        }

        connectAsync() {
            return this.device.gatt.connect()
                .then(server => {
                    this.server = server;
                    return this.server.getPrimaryService(UART_SERVICE_UUID);
                })
                .then(service => {
                    this.service = service;
                    return this.service.getCharacteristic(UART_CHARACTERISTIC_RX_UUID);
                }).then(readCharacteristic => {
                    this.readCharacteristic = readCharacteristic;
                    return this.readCharacteristic.startNotifications()
                }).then(() => {
                    this.readCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotifications)
                }, e => {
                    this.disconnect();
                })
        }

        handleNotifications(event: Event) {
            const text = this.decoder.decode((<any>event.target).value);
            pxt.log(`uart rx: ${text}`)
            window.postMessage({
                type: "serial",
                id: this.device.name || "ble",
                data: text
            }, "*")
        }

        disconnect() {
            try {
                if (this.readCharacteristic) {
                    this.readCharacteristic.stopNotifications();
                    this.readCharacteristic.removeEventListener('characteristicvaluechanged', this.handleNotifications);
                }
                this.device.gatt.disconnect();
                this.server = undefined;
                this.service = undefined;
                this.readCharacteristic = undefined;
            } catch (e) {
                pxt.log(`uart: error while disconnecting`)
                pxt.log(e);
            }
        }
    }

    let reader: UartReader = undefined;
    export function pairAsync(): Promise<void> {
        if (reader)
            reader.disconnect();
        reader = undefined;
        return navigator.bluetooth.requestDevice({
            filters: [{
                services: [UART_SERVICE_UUID]
            }]
        }).then(device => {
            reader = new UartReader(device);
            return reader.connectAsync();
        })
    }
}