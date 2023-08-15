// @ts-nocheck
import ledPatterns from "./LEDPatterns";
import eventEmitter from "event-emitter";
import textToPixels from "./TextToPixels";

const FLASH_VERIFICATION_STATE = {
    VERIFIED: "verified",
    NOT_VERIFIED: "not verified",
    OUT_OF_DATE: "out of date",
};

class Pin {
    constructor(id) {
        // pin number
        this.id = id;

        // pin characteristics
        this.isAnalog = true;
        this.isInput = true;

        // pin state
        this.isPressed = false;
        this.baseValue = null;
        this.value = null;
    }
}

class Controller extends eventEmitter {
    _connected;
    _xAccel;
    _yAccel;
    _zAccel;
    _isTemperatureChanged;
    _temperature;
    _ledMatrix;
    _characteristics;
    _namePrefix
    constructor() {
        super();
        this._connected = false;
        this._device = null;
        this._namePrefix = "BBC";
        this._characteristics = {
            ledText: {
                writeValue: (value) =>
                    new Promise((resolve) => {
                        this.textValue = new TextDecoder("utf8").decode(value);
                        this._onLEDChange();
                        this.emit("LEDChanged");
                        resolve();
                    }),
            },
            ledMatrix: {
                writeValue: () =>
                    new Promise((resolve) => {
                        this._textValue = undefined;
                        this._onLEDChange();
                        this.emit("LEDChanged");
                        resolve();
                    }),
            },
        };
        this._services = {};
        this._flashVerifiedState = FLASH_VERIFICATION_STATE.NOT_VERIFIED;
        this._writingLEDMatrix = false;
        this._needToWriteLEDMatrix = false;
        this._ledMatrix = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ];
        this._aPressed = false;
        this._bPressed = false;
        this._temperature = null;
        this._isTemperatureChanged = false;

        // IO Pins
        this._pins = [];
        this._lastIOConfiguration;
        this._lastADConfiguration;
    }

    _onLEDChange = () => {
        clearInterval(this.textInterval);
        if (this.textValue) {
            this.currentText = textToPixels(" " + this.textValue);
            this.currentTextCounter = 0;
            this.textInterval = setInterval(() => {
                this.ledMatrix = this.currentText.getStartingSquare(
                    5,
                    5,
                    this.currentTextCounter++
                );
                if (this.currentTextCounter > this.currentText.width) {
                    clearInterval(this.textInterval);
                    this._displayingText = false;
                }
                this.emit("LEDChanged");
            }, (1000 * this.textValue.length + 1) / this.currentText.width);
            this.textValue = undefined;
        } else {
            this.ledMatrix = this._ledMatrix;
        }
    };

    // Called when RUN/STOP is pressed
    reset = () => {
        // Reset pins when run/stop is being called
        if (this._services.ioPinService) {
            this.resetPins(false);
        }
    };

    connect = (callback = () => {}) => {
        if (this._connected) return callback();

        navigator.bluetooth
            .requestDevice({
                filters: [
                    {
                        namePrefix: "BBC",
                    },
                ],
                optionalServices: [
                    "e95d9882-251d-470a-a062-fa1922dfa9a8",
                    "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
                    "e95dd91d-251d-470a-a062-fa1922dfa9a8",
                    "e95d6100-251d-470a-a062-fa1922dfa9a8",
                    "e95d0753-251d-470a-a062-fa1922dfa9a8",
                    "e95d127b-251d-470a-a062-fa1922dfa9a8",
                ],
            })
            .then((device) => (this._device = device))
            .then(() => {
                if (this._device.gatt.connected) {
                    // This device is already connected,
                    // set this._device to null so we don't accidentally disconnect it.
                    this._device = null;
                    throw new Error("Device already connected");
                }
            })
            .then(() => (this._connecting = true))
            .then(() => this.emit("connecting"))
            .then(() => this._device.gatt.connect())
            .then(() => this._device.gatt.getPrimaryServices())
            .then((services) => {
                this._services.uartService = services.find(
                    (a) => a.uuid === "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
                );
                this._services.ledService = services.find(
                    (a) => a.uuid === "e95dd91d-251d-470a-a062-fa1922dfa9a8"
                );
                this._services.buttonService = services.find(
                    (a) => a.uuid === "e95d9882-251d-470a-a062-fa1922dfa9a8"
                );
                this._services.temperatureService = services.find(
                    (a) => a.uuid === "e95d6100-251d-470a-a062-fa1922dfa9a8"
                );
                this._services.accelerometerService = services.find(
                    (a) => a.uuid === "e95d0753-251d-470a-a062-fa1922dfa9a8"
                );
                this._services.ioPinService = services.find(
                    (a) => a.uuid === "e95d127b-251d-470a-a062-fa1922dfa9a8"
                );
                if (!this._services.uartService)
                    throw new Error("Invalid file flashed to microbit");
            })
            .then(() => this._services.uartService.getCharacteristics())
            .then((uartCharacteristics) => {
                this._characteristics.uartRead = uartCharacteristics.find(
                    (a) => a.uuid === "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
                );
                this._characteristics.uartWrite = uartCharacteristics.find(
                    (a) => a.uuid === "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
                );
                this._characteristics.uartRead.oncharacteristicvaluechanged =
                    this._onUart;

                return this._characteristics.uartRead.startNotifications();
            })
            .then(() => this._verifyFlash())
            .then(() => this._services.ledService.getCharacteristics())
            .then((ledCharacteristics) => {
                this._characteristics.ledText = ledCharacteristics.find(
                    (a) => a.uuid === "e95d93ee-251d-470a-a062-fa1922dfa9a8"
                );
                this._characteristics.ledMatrix = ledCharacteristics.find(
                    (a) => a.uuid === "e95d7b77-251d-470a-a062-fa1922dfa9a8"
                );
            })
            .then(() => this._services.buttonService.getCharacteristics())
            .then((buttonCharacteristics) => {
                this._characteristics.buttonA = buttonCharacteristics.find(
                    (a) => a.uuid === "e95dda90-251d-470a-a062-fa1922dfa9a8"
                );
                this._characteristics.buttonB = buttonCharacteristics.find(
                    (a) => a.uuid === "e95dda91-251d-470a-a062-fa1922dfa9a8"
                );
                this._characteristics.buttonA.oncharacteristicvaluechanged =
                    this._onButtonAChange;
                this._characteristics.buttonB.oncharacteristicvaluechanged =
                    this._onButtonBChange;
            })
            .then(() => this._characteristics.buttonA.startNotifications())
            .then(() => this._characteristics.buttonB.startNotifications())
            .then(() => this._services.temperatureService.getCharacteristics())
            .then((temperatureCharacteristics) => {
                this._characteristics.temperaturePeriod =
                    temperatureCharacteristics.find(
                        (a) => a.uuid === "e95d1b25-251d-470a-a062-fa1922dfa9a8"
                    );
                this._characteristics.temperatureRead = temperatureCharacteristics.find(
                    (a) => a.uuid === "e95d9250-251d-470a-a062-fa1922dfa9a8"
                );
                this._characteristics.temperatureRead.oncharacteristicvaluechanged =
                    this._onTemperatureChange;
            })
            .then(() =>
                this._characteristics.temperaturePeriod.writeValue(
                    new Uint8Array([160, 0])
                )
            )
            .then(() => this._characteristics.temperatureRead.startNotifications())

            .then(() => this._services.accelerometerService.getCharacteristics())
            .then((accelerometerCharacteristics) => {
                this._characteristics.accelerometerPeriod =
                    accelerometerCharacteristics.find(
                        (a) => a.uuid === "e95dfb24-251d-470a-a062-fa1922dfa9a8"
                    );
                this._characteristics.accelerometerRead =
                    accelerometerCharacteristics.find(
                        (a) => a.uuid === "e95dca4b-251d-470a-a062-fa1922dfa9a8"
                    );
                this._characteristics.accelerometerRead.oncharacteristicvaluechanged =
                    this._onAccelerometerChange;
            })
            // https://github.com/lancaster-university/microbit-dal/issues/445
            .then(() =>
                this._characteristics.accelerometerPeriod.writeValue(
                    new Uint8Array([100, 0])
                )
            )
            .then(() => this._characteristics.accelerometerRead.startNotifications())
            .then(() => {
                if (this._services.ioPinService) {
                    return this._services.ioPinService.getCharacteristics();
                }
            })
            .then((ioPinCharacteristics) => {
                if (ioPinCharacteristics) {
                    this._characteristics.ioPinADConfiguration =
                        ioPinCharacteristics.find(
                            (a) => a.uuid === "e95d5899-251d-470a-a062-fa1922dfa9a8"
                        );
                    this._characteristics.ioPinIOConfiguration =
                        ioPinCharacteristics.find(
                            (a) => a.uuid === "e95db9fe-251d-470a-a062-fa1922dfa9a8"
                        );
                    this._characteristics.ioPinData = ioPinCharacteristics.find(
                        (a) => a.uuid === "e95d8d00-251d-470a-a062-fa1922dfa9a8"
                    );
                    this._characteristics.ioPinData.oncharacteristicvaluechanged =
                        this._onioPinChange;
                }
            })
            .then(() => {
                if (this._services.ioPinService) {
                    // Set IO pins to analog (1) or digital (0)
                    // Bit n corresponds to pin n where 0 <= n < 19
                    this._lastADConfiguration = 0b000000000011111111111111111;

                    return this._characteristics.ioPinADConfiguration.writeValue(
                        new Uint8Array([0b000000000011111111111111111])
                    );
                }
            })
            .then(() => {
                if (this._services.ioPinService) {
                    // Set IO pins to read (1) or write (0)
                    this._lastIOConfiguration = 0b000000000011111111111111111;

                    return this._characteristics.ioPinIOConfiguration.writeValue(
                        new Uint8Array([0b000000000011111111111111111])
                    );
                }
            })
            //TODO: this is the problematic code that is causing the button presses to not work
            // .then(() => {
            //   if (this._services.ioPinService) {
            //     this._characteristics.ioPinData.startNotifications();
            //   }
            // })
            .then(() => {
                if (this._services.ioPinService) {
                    this.resetPins(true);
                }
                this._connected = true;
                this._connecting = false;
                this._device.addEventListener(
                    "gattserverdisconnected",
                    this.disconnect
                );
                this.emit("connected");
                callback();
            })
            .catch((err) => {
                this.emit("bluetoothError");
                if (err.code === 8) {
                    callback();
                } else {
                    this.disconnect();
                    callback(err);
                }
            });
    };

    disconnect = () => {
        if (this._device) {
            Object.keys(this._characteristics).forEach(
                (c) => (this._characteristics[c].oncharacteristicvaluechanged = null)
            );
            this._device.removeEventListener(
                "gattserverdisconnected",
                this.disconnect
            );
            this._device.gatt.disconnect();
            this._device = null;
        }
        this.resetPins(false);
        this._connected = false;
        this._connecting = false;
        this._services = {};
        this._characteristics = {};
        this._flashVerifiedState = FLASH_VERIFICATION_STATE.NOT_VERIFIED;
        this._writingLEDMatrix = false;
        this._needToWriteLEDMatrix = false;
        this._ledMatrix = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ];
        this._aPressed = false;
        this._bPressed = false;
        this._isPin0Pressed = false;
        this._isPin1Pressed = false;
        this._isPin2Pressed = false;
        this.emit("disconnected");
    };

    _verifyFlash = () => {
        var failed = false;
        // TODO remove this Workbench check later
        this.writeUart("Check Workbench$").then(() => {
            this.writeUart("Check SAMLabs$");
        });

        return Promise.race([
            new Promise((resolve, reject) => {
                setTimeout(() => {
                    failed = true;
                    var error = new Error("Invalid hex file flashed to micro:bit");
                    error.displayToUser = true;
                    reject(error);
                }, 2000);
            }),
            new Promise((resolve, reject) => {
                var checkVerified = () => {
                    if (
                        this._flashVerifiedState === FLASH_VERIFICATION_STATE.OUT_OF_DATE
                    ) {
                        failed = true;
                        var error = new Error("Out of date hex file flashed to micro:bit");
                        error.displayToUser = true;

                        return reject(error);
                    } else if (
                        this._flashVerifiedState === FLASH_VERIFICATION_STATE.VERIFIED
                    )
                        return resolve();

                    if (!failed) setTimeout(checkVerified, 100);
                };

                checkVerified();
            }),
        ]);
    };

    writeUart = (value) =>
        // TODO make sure connected and stuff.
        this._characteristics.uartWrite.writeValue(
            new Uint8Array(Array.from(new TextEncoder("utf8").encode(value)))
        );

    displayText = (
        text
        // , callback
    ) => {
        // TODO need to handle when displayText is called multiple times and stuff
        this._ledMatrix = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ];
        this._characteristics.ledText.writeValue(
            new Uint8Array(Array.from(new TextEncoder("utf8").encode(text)))
        );
        // setTimeout(() => callback(), text.length * 1000);
    };

    displayPattern = (patternName) => {
        // TODO validate the pattern
        var pattern = ledPatterns.find((pattern) => pattern.name === patternName);
        if (!pattern) return;

        this._ledMatrix = pattern.array();
        this._writeLEDMatrix();
    };

    plot = (x, y) => {
        if (isNaN(x) || isNaN(y)) throw new Error("Invalid coordinates");
        if (x > 5 || x < 0 || y > 5 || y < 0)
            throw new Error("Invalid coordinates");
        this._ledMatrix[4 - y][x] = 1;
        this._writeLEDMatrix();
    };

    unplot = (x, y) => {
        if (isNaN(x) || isNaN(y)) throw new Error("Invalid coordinates");
        if (x > 4 || x < 0 || y > 4 || y < 0)
            throw new Error("Invalid coordinates");
        this._ledMatrix[4 - y][x] = 0;
        this._writeLEDMatrix();
    };

    toggle = (x, y) => {
        if (isNaN(x) || isNaN(y)) throw new Error("Invalid coordinates");
        if (x > 4 || x < 0 || y > 4 || y < 0)
            throw new Error("Invalid coordinates");
        this._ledMatrix[4 - y][x] = this._ledMatrix[4 - y][x] ? 0 : 1;
        this._writeLEDMatrix();
    };

    isLEDOn = (x, y) => {
        if (isNaN(x) || isNaN(y)) throw new Error("Invalid coordinates");
        if (x > 4 || x < 0 || y > 4 || y < 0)
            throw new Error("Invalid coordinates");

        return !!this._ledMatrix[4 - y][x];
    };

    clearLED = () => {
        this._ledMatrix = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ];

        this._writeLEDMatrix();
    };

    isAPressed = () => this._aPressed;

    isBPressed = () => this._bPressed;

    getTemperature = () => this._temperature;

    getXAccel = () => this._xAccel;

    getYAccel = () => this._yAccel;

    getZAccel = () => this._zAccel;

    _writeLEDMatrix = () => {
        if (this._writingLEDMatrix) {
            this._needToWriteLEDMatrix = true;

            return;
        }

        this._writingLEDMatrix = true;
        var matrix = this._ledMatrix;
        var toValue = (array = []) => {
            var value = 0;
            if (array[0]) {
                value += 16;
            }
            if (array[1]) {
                value += 8;
            }
            if (array[2]) {
                value += 4;
            }
            if (array[3]) {
                value += 2;
            }
            if (array[4]) {
                value += 1;
            }

            return value;
        };
        this._characteristics.ledMatrix
            .writeValue(
                new Uint8Array([
                    toValue(matrix[0]),
                    toValue(matrix[1]),
                    toValue(matrix[2]),
                    toValue(matrix[3]),
                    toValue(matrix[4]),
                ])
            )
            .then(() => {
                this._writingLEDMatrix = false;
                if (this._needToWriteLEDMatrix) {
                    this._needToWriteLEDMatrix = false;
                    this._writeLEDMatrix();
                }
            });
    };

    _onUart = (event) => {
        var value = String.fromCharCode.apply(
            null,
            new Uint8Array(event.target.value.buffer)
        );
        // TODO Remove this Workbench check later
        if (value.match(/^Is Workbench:\d+.\d+.\d$/)) {
            if (value.split(":")[1] === "0.0.1") {
                this._flashVerifiedState = FLASH_VERIFICATION_STATE.OUT_OF_DATE;
            } else if (value.split(":")[1] === "0.0.2") {
                this._flashVerifiedState = FLASH_VERIFICATION_STATE.VERIFIED;
            }
        }
        if (value.match(/^Is SAMLabs:\d+.\d+.\d$/)) {
            if (value.split(":")[1] === "0.0.1") {
                this._flashVerifiedState = FLASH_VERIFICATION_STATE.VERIFIED;
            }
        }
    };

    _onAccelerometerChange = (event) => {
        this._xAccel = new DataView(event.target.value.buffer).getInt16(0, true);
        this._yAccel = new DataView(event.target.value.buffer).getInt16(2, true);
        this._zAccel = new DataView(event.target.value.buffer).getInt16(4, true);
        this.emit("accelerometerChanged");
    };

    _onTemperatureChange = (event) => {
        var value = new Uint8Array(event.target.value.buffer)[0];
        if (value !== this._temperature) {
            this._temperature = value;
            this._isTemperatureChanged = true;
            this.emit("temperatureChanged");
        }
        this._isTemperatureChanged = false;
    };

    _onButtonAChange = (event) => {
        var value = new Uint8Array(event.target.value.buffer)[0];
        if (value === 0) {
            this._aPressed = false;
            this.emit("AReleased");
        } else if (value === 1) {
            this._aPressed = true;
            this.emit("APressed");
        } else if (value === 2) {
            this.emit("ALongPressed");
        }
    };

    _onButtonBChange = (event) => {
        var value = new Uint8Array(event.target.value.buffer)[0];
        if (value === 0) {
            this._bPressed = false;
            this.emit("BReleased");
        } else if (value === 1) {
            this._bPressed = true;
            this.emit("BPressed");
        } else if (value === 2) {
            this.emit("BLongPressed");
        }
    };

    // IO Pin Functions

    isPin0Pressed = () => this._pins[0].isPressed;

    isPin1Pressed = () => this._pins[1].isPressed;

    isPin2Pressed = () => this._pins[2].isPressed;

    resetPins = (setCharacteristics) => {
        const maxPins = 17; // Total number of pins available is 0 to 16 (inclusive so 17 total)

        // Empty the pins array
        this._pins = [];

        // Setup new pins
        for (var i = 0; i < maxPins; i++) {
            this._pins[i] = new Pin(i);
        }

        if (setCharacteristics) {
            this._setIOPinsIOAD();
        }
    };

    getAnalogPin = (pinId) => {
        var pin = this._pins[pinId];

        if (pin) {
            pin.isAnalog = true;
            pin.isInput = true;

            this._setIOPinsIOAD();

            if (pin.value !== null) {
                return pin.value;
            }

            return 0;
        }

        return 0;
    };

    getDigitalPin = (pinId) => {
        var pin = this._pins[pinId];

        if (pin) {
            pin.isAnalog = false;
            pin.isInput = true;

            this._setIOPinsIOAD();

            if (pin.value !== null) {
                return pin.value;
            }

            return 0;
        }

        return 0;
    };

    writeDigitalPin = (pinId, value) => {
        var pin = this._pins[pinId];

        if (pin) {
            pin.isAnalog = false; // Make digital
            pin.isInput = false; // Make output

            this._setIOPinsIOAD();

            if (pin.value != value) {
                this._digitalWriteToPin(pinId, value);
                pin.value = value;
            }
        }
    };

    _digitalWriteToPin = async (pin, value) => {
        const digitalValue = value === 0 ? 0 : 1;
        var pinValueArray = [pin, digitalValue];

        await this._characteristics.ioPinData.writeValue(
            new Uint8Array(pinValueArray)
        );
    };

    _onioPinChange = (event) => {
        const dv = new DataView(event.target.value.buffer);
        for (var i = 0; i < dv.byteLength; i = i + 2) {
            var pinId = dv.getUint8(i);
            var value = dv.getUint8(i + 1);

            if (this._pins[pinId].baseValue === null) {
                this._pins[pinId].baseValue = value;
            }
            this._pins[pinId].value = value;

            this._checkAnalogPinPressed(pinId, value);
        }

        this.emit("ioPinChanged");
    };

    _checkAnalogPinPressed = (pinId) => {
        // Only check pins 0, 1, 2
        if (pinId !== 0 && pinId !== 1 && pinId !== 2) {
            return;
        }

        // Only check if we have an existing base value
        if (
            this._pins[0].baseValue === null &&
            this._pins[1].baseValue === null &&
            this._pins[2].baseValue === null
        ) {
            return;
        }

        const p0 = this._pins[0].value || this._pins[0].baseValue;
        const p1 = this._pins[1].value || this._pins[1].baseValue;
        const p2 = this._pins[2].value || this._pins[2].baseValue;

        const d0 = Math.abs(this._pins[0].baseValue - p0);
        const d1 = Math.abs(this._pins[1].baseValue - p1);
        const d2 = Math.abs(this._pins[2].baseValue - p2);

        const data = [
            { pin: 0, d: d0 },
            { pin: 1, d: d1 },
            { pin: 2, d: d2 },
        ];

        const max = data.reduce((prev, current) =>
            prev.d > current.d ? prev : current
        );
        const min = data.reduce((prev, current) =>
            prev.d < current.d ? prev : current
        );

        if (min.d >= 5) {
            switch (max.pin) {
                case 0:
                    if (!this._pins[0].isPressed) {
                        this._pins[0].isPressed = true;
                        this.emit("Pin0Pressed");
                    }
                    break;
                case 1:
                    if (!this._pins[1].isPressed) {
                        this._pins[1].isPressed = true;
                        this.emit("Pin1Pressed");
                    }
                    break;
                case 2:
                    if (!this._pins[2].isPressed) {
                        this._pins[2].isPressed = true;
                        this.emit("Pin2Pressed");
                    }
                    break;
            }
        }

        switch (pinId) {
            case 0:
                if (this._pins[0].isPressed && this._pins[0].baseValue - p0 < 5) {
                    this._pins[0].isPressed = false;
                    this.emit("Pin0Released");
                }
                break;
            case 1:
                if (this._pins[1].isPressed && this._pins[1].baseValue - p1 < 5) {
                    this._pins[1].isPressed = false;
                    this.emit("Pin1Released");
                }
                break;
            case 2:
                if (this._pins[2].isPressed && this._pins[2].baseValue - p2 < 5) {
                    this._pins[2].isPressed = false;
                    this.emit("Pin2Released");
                }
                break;
        }
    };

    _setIOPinsIOAD = async () => {
        var ioConfiguration = 0b000000000000000000000000000;
        var adConfiguration = 0b000000000000000000000000000;

        for (var i = 0; i < this._pins.length; i++) {
            var pin = this._pins[i];
            if (pin.isInput) {
                var ioMask = 1 << pin.id;
                ioConfiguration |= ioMask;
            }

            if (pin.isAnalog) {
                var adMask = 1 << pin.id;
                adConfiguration |= adMask;
            }
        }

        // Only write to the configurations if there has been a change since last configuration.
        if (this._lastIOConfiguration !== ioConfiguration) {
            this._lastIOConfiguration = ioConfiguration;
            await this._characteristics.ioPinIOConfiguration.writeValue(
                new Uint8Array([ioConfiguration])
            );
        }

        if (this._lastADConfiguration !== adConfiguration) {
            this._lastADConfiguration = adConfiguration;
            await this._characteristics.ioPinIOConfiguration.writeValue(
                new Uint8Array([adConfiguration])
            );
        }
    };
}

export default Controller;
