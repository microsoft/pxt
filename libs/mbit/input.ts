namespace input {
    export enum Button {
        //% enumval=MICROBIT_ID_BUTTON_A
        A,
        //% enumval=MICROBIT_ID_BUTTON_A
        B,
        //% enumval=MICROBIT_ID_BUTTON_AB
        AB,
    }
    
    export enum Dimension {
        //% enumval=0
        X,
        //% enumval=1
        Y,
        //% enumval=2
        Z,
        //% enumval=3
        Strength,
    }

    export enum Rotation {
        //% enumval=0
        Pitch,
        //% enumval=1
        Roll,
    }

    export enum TouchPins {
        //% enumval=uBit.io.P0
        P0,
        //% enumval=uBit.io.P1
        P1,
        //% enumval=uBit.io.P2
        P2,
    }
    
    export enum Gestures {
        Shake,
        LogoUp,
        LogoDown,
        ScreenUp,
        ScreenDown
    }
    
    /**
     * Get the button state (pressed or not) for ``A`` and ``B``.
     */
    //% help=functions/button-is-pressed weight=59
    //% shim=micro_bit::isButtonPressed block="button %1 is pressed"
    export function buttonIsPressed(button: Button): boolean { return false; }

    /**
     * Do something when a button (``A``, ``B`` or both ``A+B``) is pressed
     * @param name TODO
     * @param body TODO
     */
    //% help=functions/on-button-pressed weight=58 shim=micro_bit::onButtonPressed async
    export function onButtonPressed(name: Button, body:Action) : void {}

    /**
     * Get the current compass compass heading in degrees.
     */
    //% help=functions/compass-heading weight=56 shim=micro_bit::compassHeading async
    export function compassHeading() : number { return 0;}

    /**
     * Get the acceleration value in milli-gravitys (when the board is laying flat with the screen up, x=0, y=0 and z=-1024)
     * @param dimension TODO
     */
    //% help=functions/acceleration weight=57 shim=micro_bit::getAcceleration async
    export function acceleration(dimension: string) : number { return 0; }

    /**
     * Gets the number of milliseconds elapsed since power on.
     */
    //% help=functions/running-time shim=micro_bit::getCurrentTime async
    export function runningTime() : number { return 0; }

    /**
     * Obsolete, compass calibration is automatic.
     */
    //% help=functions/calibrate weight=0 shim=TD_NOOP
    export function calibrate() : void {}

    /**
     * Get the pin state (pressed or not). Requires to hold the ground to close the circuit.
     * @param name TODO
     */
    //% help=functions/pin-is-pressed weight=58 shim=micro_bit::isPinTouched async
    export function pinIsPressed(name: TouchPins) : boolean { return false; }

    /**
     * Do something when a pin(``P0``, ``P1`` or both ``P2``) is pressed.
     * @param name TODO
     * @param body TODO
     */
    //% help=functions/on-pin-pressed weight=57 shim=micro_bit::onPinPressed async
    export function onPinPressed(name: TouchPins, body:Action) : void {}

    /**
     * Gets the temperature in Celsius degrees (°C).
     */
    //% weight=70 help=functions/temperature shim=uBit.thermometer.getTemperature async
    export function temperature() : number { return 0; }

    /**
     * Get the magnetic force value in ``micro-Teslas`` (``µT``). This function is not supported in the simulator.
     * @param dimension TODO
     */
    //% help=functions/magnetic-force weight=43 shim=micro_bit::getMagneticForce
    export function magneticForce(dimension: Dimension) : number { return 0; }

    /**
     * The pitch of the device, rotation along the ``x-axis``, in degrees.
     * @param kind TODO
     */
    //% help=/functions/rotation weight=60 shim=micro_bit::getRotation
    export function rotation(kind: string) : number { return 0; }

    /**
     * Reads the light level applied to the LED screen in a range from ``0`` (dark) to ``255`` bright. In the simulator, the ``acceleration y`` is used to emulate this value.
     */
    //% help=functions/light-level weight=55 shim=micro_bit::lightLevel
    export function lightLevel() : number { return 0; }

    /**
     * Attaches code to run when the screen is facing up.
     * @param body TODO
     */
    //% help=functions/on-gesture shim=micro_bit::onGesture
    export function onGesture(gesture : Gestures, body:Action) : void
    {
    }

    /**
     * Attaches code to run when the screen is facing up.
     * @param body TODO
     */
    //% help=functions/on-screen-up
    export function onScreenUp(body:Action) : void
    {
        onGesture(Gestures.ScreenUp, body);
    }

    /**
     * Attaches code to run when the screen is facing down.
     * @param body TODO
     */
    //% help=functions/on-screen-down
    export function onScreenDown(body:Action) : void
    {
        onGesture(Gestures.ScreenDown, body);
    }

    /**
     * Attaches code to run when the device is shaken.
     * @param body TODO
     */
    //% help=functions/on-shake
    export function onShake(body:Action) : void
    {
        onGesture(Gestures.Shake, body);
    }

    /**
     * Attaches code to run when the logo is oriented upwards and the board is vertical.
     * @param body TODO
     */
    //% help=functions/on-logo-up
    export function onLogoUp(body:Action) : void
    {
        onGesture(Gestures.LogoUp, body);
    }

    /**
     * Attaches code to run when the logo is oriented downwards and the board is vertical.
     * @param body TODO
     */
    //% help=functions/on-logo-down
    export function onLogoDown(body:Action) : void
    {
        onGesture(Gestures.LogoDown, body);
    }
}
