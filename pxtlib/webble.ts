namespace pxt.webBluetooth {

    export let isEnabled = false

    export function setEnabled(v: boolean) {
        if (!isAvailable()) v = false
        isEnabled = v
    }

    export function isAvailable() {
        return !!navigator.bluetooth;
    }


    // https://lancaster-university.github.io/microbit-docs/resources/bluetooth/bluetooth_profile.html
    const UART_SERVICE_UUID: BluetoothServiceUUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // must be lower case!
    const UART_CHARACTERISTIC_RX_UUID: BluetoothCharacteristicUUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
    //const UART_CHARACTERISTIC_TX_UUID: BluetoothCharacteristicUUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

    class UartReader {
        device: BluetoothDevice = undefined;
        server: BluetoothRemoteGATTServer = undefined;
        service: BluetoothRemoteGATTService = undefined;
        readCharacteristic: BluetoothRemoteGATTCharacteristic = undefined;

        constructor(device: BluetoothDevice) {
            this.device = device;
            this.handleDisconnected = this.handleDisconnected.bind(this);
            this.handleNotifications = this.handleNotifications.bind(this);

            device.addEventListener('gattserverdisconnected', this.handleDisconnected);
        }

        connectAsync(): Promise<void> {
            pxt.debug(`connecting ${this.device.name}`)
            return new Promise((resolve, reject) => {
                this.device.gatt.connect()
                    .then(server => {
                        pxt.debug(`gatt server connected`)
                        this.server = server;
                        return this.server.getPrimaryService(UART_SERVICE_UUID);
                    })
                    .then(service => {
                        pxt.debug(`uart service connected`)
                        this.service = service;
                        return this.service.getCharacteristic(UART_CHARACTERISTIC_RX_UUID);
                    }).then(readCharacteristic => {
                        pxt.debug(`read characteristic connected`)
                        this.readCharacteristic = readCharacteristic;
                        return this.readCharacteristic.startNotifications()
                    }).then(() => {
                        this.readCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotifications);
                        resolve();
                    }, (e: Error) => {
                        pxt.log(`uart: error ${e.message}`)
                        this.disconnect();
                        resolve();
                    });
            });
        }

        handleDisconnected(event: Event) {
            this.disconnect();
        }

        handleNotifications(event: Event) {
            //TODO TextEncoder support
            const buffer = new Uint8Array((<any>event.target).value);
            let text = ''; buffer.forEach(x => text += String.fromCharCode(x));
            pxt.debug(`uart rx: ${text}`)
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
            filters: [{
                namePrefix: pxt.appTarget.appTheme.bluetoothUartNamePrefix
            }],
            optionalServices: [UART_SERVICE_UUID]
        }).then(device => {
            pxt.log(`uart: received device ${device.name}`)
            reader = new UartReader(device);
            return reader.connectAsync();
        })
    }
}