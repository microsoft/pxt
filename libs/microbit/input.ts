enum Button {
    //% enumval=MICROBIT_ID_BUTTON_A
    A,
    //% enumval=MICROBIT_ID_BUTTON_B
    B,
    //% enumval=MICROBIT_ID_BUTTON_AB
    //% blockId="A+B"
    AB,
}

enum Dimension {
    //% enumval=0 blockId=x    
    X,
    //% enumval=1 blockId=y
    Y,
    //% enumval=2 blockId=z
    Z,
    //% enumval=3 blockId=strength
    Strength,
}

enum Rotation {
    //% enumval=0 blockId=pitch
    Pitch,
    //% enumval=1 blockId=roll
    Roll,
}

enum TouchPins {
    //% enumval=uBit.io.P0
    P0,
    //% enumval=uBit.io.P1
    P1,
    //% enumval=uBit.io.P2
    P2,
}

enum Gestures {
    //% blockId=shake enumval=MICROBIT_ACCELEROMETER_EVT_SHAKE
    Shake,
    //% blockId="logo up" enumval=MICROBIT_ACCELEROMETER_EVT_TILT_UP
    LogoUp,
    //% blockId="logo down" enumval=MICROBIT_ACCELEROMETER_EVT_TILT_DOWN
    LogoDown,
    //% blockId="screen up" enumval=MICROBIT_ACCELEROMETER_EVT_FACE_UP
    ScreenUp,
    //% blockId="screen down" enumval=MICROBIT_ACCELEROMETER_EVT_FACE_DOWN
    ScreenDown
}

//% color=300 weight=99
namespace input {
    /**
     * Do something when a button (``A``, ``B`` or both ``A+B``) is pressed
     * @param button TODO
     * @param body TODO
     */
    //% help=functions/on-button-pressed weight=85
    //% shim=micro_bit::onButtonPressed
    //% blockId=device_button_event 
    //% block="on button|%NAME|pressed" 
    //% icon="\uf192"
    export function onButtonPressed(button: Button, body: Action): void { }

    /**
     * Attaches code to run when the screen is facing up.
     * @param body TODO
     */
    //% help=functions/on-gesture shim=micro_bit::on_event weight=84
    //% blockId=device_gesture_event block="on |%NAME" icon="\uf135"
    export function onGesture(gesture: Gestures, body: Action): void { }

    /**
     * Do something when a pin(``P0``, ``P1`` or both ``P2``) is pressed.
     * @param name TODO
     * @param body TODO
     */
    //% help=functions/on-pin-pressed weight=83 shim=micro_bit::onPinPressed
    //% blockId=device_pin_event block="on pin|%NAME|pressed" icon="\uf094"
    export function onPinPressed(name: TouchPins, body: Action): void { }

    /**
     * Get the button state (pressed or not) for ``A`` and ``B``.
     */
    //% help=functions/button-is-pressed weight=57
    //% shim=micro_bit::isButtonPressed 
    //% block="button|%NAME|is pressed"
    //% blockId=device_get_button2
    //% icon="\uf192" blockGap=8
    export function buttonIsPressed(button: Button): boolean {
        return false;
    }


    /**
     * Get the current compass compass heading in degrees.
     */
    //% help=functions/compass-heading 
    //% weight=56 icon="\uf14e"
    //% shim=micro_bit::compassHeading
    //% blockId=device_heading block="compass heading (°)" blockGap=8
    export function compassHeading(): number {
        return 0;
    }


    /**
     * Gets the temperature in Celsius degrees (°C).
     */
    //% weight=55 icon="\uf06d"
    //% help=functions/temperature shim=uBit.thermometer.getTemperature
    //% blockId=device_temperature block="temperature (°C)" blockGap=8
    export function temperature(): number {
        return 0;
    }

    /**
     * Get the acceleration value in milli-gravitys (when the board is laying flat with the screen up, x=0, y=0 and z=-1024)
     * @param dimension TODO
     */
    //% help=functions/acceleration weight=54 icon="\uf135"
    //% shim=micro_bit::getAcceleration
    //% blockId=device_acceleration block="acceleration (mg)|%NAME" blockGap=8
    export function acceleration(dimension: Dimension): number {
        return 0;
    }


    /**
     * Reads the light level applied to the LED screen in a range from ``0`` (dark) to ``255`` bright. In the simulator, the ``acceleration y`` is used to emulate this value.
     */
    //% help=functions/light-level weight=53 shim=micro_bit::lightLevel
    //% blockId=device_get_light_level block="light level" blockGap=8 icon="\uf185"
    export function lightLevel(): number {
        return 0;
    }

    /**
     * The pitch of the device, rotation along the ``x-axis``, in degrees.
     * @param kind TODO
     */
    //% help=/functions/rotation weight=52 shim=micro_bit::getRotation
    //% blockId=device_get_rotation block="rotation (°)|%NAME" blockGap=8 icon="\uf197"
    export function rotation(kind: Rotation): number {
        return 0;
    }

    /**
     * Get the magnetic force value in ``micro-Teslas`` (``µT``). This function is not supported in the simulator.
     * @param dimension TODO
     */
    //% help=functions/magnetic-force weight=51 shim=micro_bit::getMagneticForce
    //% blockId=device_get_magnetic_force block="magnetic force (µT)|%NAME" blockGap=8 icon="\uf076"
    export function magneticForce(dimension: Dimension): number {
        return 0;
    }

    /**
     * Gets the number of milliseconds elapsed since power on.
     */
    //% help=functions/running-time shim=micro_bit::getCurrentTime weight=50
    //% blockId=device_get_running_time block="running time (ms)" blockGap=8 icon="\uf017"
    export function runningTime(): number {
        return 0;
    }

    /**
     * Obsolete, compass calibration is automatic.
     */
    //% help=functions/calibrate weight=0 shim=TD_NOOP
    export function calibrate(): void { }

    /**
     * Get the pin state (pressed or not). Requires to hold the ground to close the circuit.
     * @param name TODO
     */
    //% help=functions/pin-is-pressed weight=58 shim=micro_bit::isPinTouched block="pin|%NAME|is pressed" icon="\uf094"
    export function pinIsPressed(name: TouchPins): boolean {
        return false;
    }

    /**
     * Attaches code to run when the screen is facing up.
     * @param body TODO
     */
    //% help=functions/on-screen-up
    export function onScreenUp(body: Action): void {
        onGesture(Gestures.ScreenUp, body);
    }

    /**
     * Attaches code to run when the screen is facing down.
     * @param body TODO
     */
    //% help=functions/on-screen-down
    export function onScreenDown(body: Action): void {
        onGesture(Gestures.ScreenDown, body);
    }

    /**
     * Attaches code to run when the device is shaken.
     * @param body TODO
     */
    //% help=functions/on-shake
    export function onShake(body: Action): void {
        onGesture(Gestures.Shake, body);
    }

    /**
     * Attaches code to run when the logo is oriented upwards and the board is vertical.
     * @param body TODO
     */
    //% help=functions/on-logo-up
    export function onLogoUp(body: Action): void {
        onGesture(Gestures.LogoUp, body);
    }

    /**
     * Attaches code to run when the logo is oriented downwards and the board is vertical.
     * @param body TODO
     */
    //% help=functions/on-logo-down
    export function onLogoDown(body: Action): void {
        onGesture(Gestures.LogoDown, body);
    }
}
