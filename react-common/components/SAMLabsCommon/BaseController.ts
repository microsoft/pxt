// @ts-nocheck
import { parameterValidator } from './Utils'
import EventEmitter from 'event-emitter';


const standardServiceUUID = '3b989460-975f-11e4-a9fb-0002a5d5c51b'
const batteryServiceUUID = '0000180f-0000-1000-8000-00805f9b34fb'
const readCharacteristicUUID = '4c592e60-980c-11e4-959a-0002a5d5c51b'
const writeCharacteristicUUID = '84fc1520-980c-11e4-8bed-0002a5d5c51b'
const colorCharacteristicUUID = '5baab0a0-980c-11e4-b5e9-0002a5d5c51b'

class BaseController extends EventEmitter {
    _getDefaultDeviceColor;

    constructor(defaultDeviceColor, namePrefix) {
        super()
        this._getDefaultDeviceColor = () => defaultDeviceColor
        this._namePrefix = namePrefix
        this._device
        this._colorCharacteristic
        this._readCharacteristic
        this._writeCharacteristic
        this._writing = false
        this._isConnected = false
        this._connecting = false
        this._color
        this._writeCharacteristicValue

        var originalEmit = this.emit
        var self = this
        this.emit = function() {
            if(this._connecting && arguments[0] !== 'connecting') return
            originalEmit.apply(self, arguments)
        }
    }

    setColor = parameterValidator(['string'], (hexColor) => {
        function hexToRgb(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
            } : null
        }

        var rgb = hexToRgb(hexColor)
        if(!rgb) throw new Error(`"${hexColor}" is not a valid color.`)
        this._color = rgb
        this._writeColor = true
        this._write()
    })

    setConnectedToSimDevice = (state) => {
        this._connectedToSimDevice= !!state
    }

    reset = () => {
        // Previously, when the program stopped I returned it back
        // to the original color.  If we want that behavior back then uncomment this.
        //this.setColor(this._getDefaultDeviceColor())
        this._reset && this._reset()
    }

    _setWriteCharacteristicValue = (value) => {
        this._writeCharacteristicValue = value
        this._writeValue = true
        this._write()
    }

    _write = () => {
        if(this._writing || !(this._device && this._device.gatt.connected) || !this._isConnected) return
        this._writing = true
        if(this._writeValue && this._writeCharacteristicValue) {
            this._writeValue = false
            this._writeCharacteristic.writeValue(new Uint8Array(this._writeCharacteristicValue)).then(() => {
                this._writing = false
                if(this._writeValue || this._writeColor) this._write()
            }).catch((err) => {
                console.warn(err)
                this._writing = false
            })
        }
        else if(this._writeColor) {
            this._writeColor = false
            this._colorCharacteristic.writeValue(new Uint8Array([this._color.r, this._color.g, this._color.b])).then(() => {
                this._writing = false
                this._writeValue = true
                this._write()
            }).catch((err) => {
                console.warn(err)
                this._writing = false
            })
        }
        else {
            this._writing = false
        }
    }
    getAbortController = () => {
        const controller = new AbortController();
        const signal = controller.signal;
        return { controller, signal };
    }

    connect = (callback) => {
        if(this._isConnected || this._connecting) return callback('already connected')

        var batteryLevel
        const {signal}=this.getAbortController()||null;

        navigator.bluetooth.requestDevice(
            {
                filters: [
                    {
                        namePrefix: this._namePrefix,
                    },
                ],
                optionalServices: [standardServiceUUID, 0x180f],
                signal:signal
            })
            .then((device) => this._device = device)
            .then(() => { if(this._device.name !== this._namePrefix) throw new Error('Incorrect Device') })
            .then(() => {
                if(this._device.gatt.connected) {
                    // This device is already connected,
                    // set this._device to null so we don't accidentally disconnect it.
                    this._device = null
                    throw new Error('Device already connected')
                }
            })
            .then(() => this._connecting = true)
            .then(() => this.emit('connecting'))
            .then(() => this._device.gatt.connect())
            .then(() => this._device.gatt.getPrimaryServices())
            .then((services) => {
                var batteryService = services.find((service) => service.uuid === batteryServiceUUID || service.uuid === '180f')
                var standardService = services.find((service) => service.uuid === standardServiceUUID)

                return batteryService.getCharacteristics().then((batteryCharacteristics) => {
                    this._batteryCharacteristic = batteryCharacteristics[0]
                    this._batteryCharacteristic.oncharacteristicvaluechanged = (event) => {
                        this.emit('batteryLevelChange', new Uint8Array(event.target.value.buffer)[0])
                    }

                    return this._batteryCharacteristic.readValue()
                        .then((event) => {
                            batteryLevel = new Uint8Array(event.buffer)[0]
                        })
                        .then(() => this._batteryCharacteristic.stopNotifications())
                        .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
                        .then(() => this._batteryCharacteristic.startNotifications())
                        .then(() => standardService.getCharacteristics())
                })
            })
            .then((characteristics) => {
                var promise

                characteristics.forEach((characteristic) => {
                    if(characteristic.uuid === readCharacteristicUUID) {

                        this._readCharacteristic = characteristic

                        promise = characteristic.readValue()
                            .then((event) => {
                                if(!this._onReadCharacteristicValueChanged) return
                                this._onReadCharacteristicValueChanged(new Uint8Array(event.buffer))
                            })
                            .catch((err) => {
                                // Old SAM Labs pieces don't support the readValue command.
                                // That means they won't get the initial value, they'll just be
                                // stuck with the default value until an event occurs.
                            })
                            .then(() => characteristic.stopNotifications())
                            .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
                            .then(() => characteristic.startNotifications())
                            .then(() => {
                                characteristic.oncharacteristicvaluechanged = (event) => {
                                    if(!this._onReadCharacteristicValueChanged) return
                                    setTimeout(() => this._onReadCharacteristicValueChanged(new Uint8Array(event.target.value.buffer)))
                                }
                            })
                            .catch((err) => {
                                console.warn(err)
                                this.disconnect()
                            })
                    }

                    if(characteristic.uuid === writeCharacteristicUUID) {
                        this._writeCharacteristic = characteristic
                    }

                    if(characteristic.uuid === colorCharacteristicUUID) {
                        this._colorCharacteristic = characteristic
                    }
                })

                return promise
            })
            .then(() => {
                this._isConnected = true
                this._connecting = false
                // TODO this might be a potential memory leak? Since we aren't removing it?
                this._device.addEventListener('gattserverdisconnected', () => {
                    this.disconnect()
                })
                console.log('connected and heres the color',this._getDefaultDeviceColor())
                this.emit('connected')
                this.emit('batteryLevelChange', batteryLevel)
                this.setColor(this._getDefaultDeviceColor())
                this.reset && this.reset()
                callback()
            })
            .catch((err) => {
                // this.emit("bluetoothError");
                console.log(err)
                if (err.name === 'AbortError') {
                    console.log('User aborted the Bluetooth pairing process');
                    callback(err);
                    return;
                }
                if(err.code === 8) {
                    callback()
                }
                else {
                    this.disconnect()
                    callback(err)
                }
            })
    }

    disconnect = function() {
        if(this._device) {
            if(this._readCharacteristic) this._readCharacteristic.oncharacteristicvaluechanged = null
            if(this._batteryCharacteristic) this._batteryCharacteristic.oncharacteristicvaluechanged = null
            this._device.gatt.disconnect()
            this._device = null
        }
        this._isConnected = false
        this._connecting = false
        this.emit('disconnected')
    }
}

export default BaseController