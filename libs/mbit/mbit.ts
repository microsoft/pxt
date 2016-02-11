type Action = () => void;

enum Button {
    //% enumval=MICROBIT_ID_BUTTON_A
    A,
    //% enumval=MICROBIT_ID_BUTTON_A
    B,
    //% enumval=MICROBIT_ID_BUTTON_AB
    AB,
}

enum Dimension {
    //% enumval=0
    X,
    //% enumval=1
    Y,
    //% enumval=2
    Z,
    //% enumval=3
    Strength,
}

enum Rotation {
    //% enumval=0
    Pitch,
    //% enumval=1
    Roll,
}

enum DisplayMode {
    //% enumval=0
    BackAndWhite,
    //% enumval=1
    Greyscale,
}

enum TouchPins {
    //% enumval=uBit.io.P0
    P0,
    //% enumval=uBit.io.P1
    P1,
    //% enumval=uBit.io.P2
    P2,
}

enum DigitalPins {
    //% enumval=uBit.io.P0
    P0,
    //% enumval=uBit.io.P1
    P1,
    //% enumval=uBit.io.P2
    P2,
    //% enumval=uBit.io.P3
    P3,
    //% enumval=uBit.io.P4
    P4,
    //% enumval=uBit.io.P5
    P5,
    //% enumval=uBit.io.P6
    P6,
    //% enumval=uBit.io.P7
    P7,
    //% enumval=uBit.io.P8
    P8,
    //% enumval=uBit.io.P9
    P9,
    //% enumval=uBit.io.P10
    P10,
    //% enumval=uBit.io.P11
    P11,
    //% enumval=uBit.io.P12
    P12,
    //% enumval=uBit.io.P13
    P13,
    //% enumval=uBit.io.P14
    P14,
    //% enumval=uBit.io.P15
    P15,
    //% enumval=uBit.io.P16
    P16,
    //% enumval=uBit.io.P19
    P19,
    //% enumval=uBit.io.P20
    P20,
}

enum AnalogPins {
    //% enumval=uBit.io.P0
    P0,
    //% enumval=uBit.io.P1
    P1,
    //% enumval=uBit.io.P2
    P2,
    //% enumval=uBit.io.P3
    P3,
    //% enumval=uBit.io.P4
    P4,
    //% enumval=uBit.io.P10
    P10,
}

enum MesCameraEvent {
    //% enumval=MES_CAMERA_EVT_TAKE_PHOTO
    TakePhoto,
    //% enumval=MES_CAMERA_EVT_START_VIDEO_CAPTURE
    StartVideoCapture,
    //% enumval=MES_CAMERA_EVT_STOP_VIDEO_CAPTURE
    StopVideoCapture,
    //% enumval=MES_CAMERA_EVT_TOGGLE_FRONT_REAR
    ToggleFront_rear,
    //% enumval=MES_CAMERA_EVT_LAUNCH_PHOTO_MODE
    LaunchPhotoMode,
    //% enumval=MES_CAMERA_EVT_LAUNCH_VIDEO_MODE
    LaunchVideoMode,
    //% enumval=MES_CAMERA_EVT_STOP_PHOTO_MODE
    StopPhotoMode,
    //% enumval=MES_CAMERA_EVT_STOP_VIDEO_MODE
    StopVideoMode,
}

enum MesAlertEvent {
    //% enumval=MES_ALERT_EVT_DISPLAY_TOAST
    DisplayToast,
    //% enumval=MES_ALERT_EVT_VIBRATE
    Vibrate,
    //% enumval=MES_ALERT_EVT_PLAY_SOUND
    PlaySound,
    //% enumval=MES_ALERT_EVT_PLAY_RINGTONE
    PlayRingtone,
    //% enumval=MES_ALERT_EVT_FIND_MY_PHONE
    FindMyPhone,
    //% enumval=MES_ALERT_EVT_ALARM1
    RingAlarm,
    //% enumval=MES_ALERT_EVT_ALARM2
    RingAlarm2,
    //% enumval=MES_ALERT_EVT_ALARM3
    RingAlarm3,
    //% enumval=MES_ALERT_EVT_ALARM4
    RingAlarm4,
    //% enumval=MES_ALERT_EVT_ALARM5
    RingAlarm5,
    //% enumval=MES_ALERT_EVT_ALARM6
    RingAlarm6,
}

enum MesDeviceInfo {
    //% enumval=MES_DEVICE_INCOMING_CALL
    IncomingCall,
    //% enumval=MES_DEVICE_INCOMING_MESSAGE
    IncomingMessage,
    //% enumval=MES_DEVICE_ORIENTATION_LANDSCAPE
    OrientationLandscape,
    //% enumval=MES_DEVICE_ORIENTATION_PORTRAIT
    OrientationPortrait,
    //% enumval=MES_DEVICE_GESTURE_DEVICE_SHAKEN
    Shaken,
    //% enumval=MES_DEVICE_DISPLAY_OFF
    DisplayOff,
    //% enumval=MES_DEVICE_DISPLAY_ON
    DisplayOn,
}

enum MesRemoteControlEvent {
    //% enumval=MES_REMOTE_CONTROL_EVT_PLAY
    play,
    //% enumval=MES_REMOTE_CONTROL_EVT_PAUSE
    pause,
    //% enumval=MES_REMOTE_CONTROL_EVT_STOP
    stop,
    //% enumval=MES_REMOTE_CONTROL_EVT_NEXTTRACK
    nextTrack,
    //% enumval=MES_REMOTE_CONTROL_EVT_PREVTRACK
    previousTrack,
    //% enumval=MES_REMOTE_CONTROL_EVT_FORWARD
    forward,
    //% enumval=MES_REMOTE_CONTROL_EVT_REWIND
    rewind,
    //% enumval=MES_REMOTE_CONTROL_EVT_VOLUMEUP
    volumeUp,
    //% enumval=MES_REMOTE_CONTROL_EVT_VOLUMEDOWN
    volumeDown,
}

enum MesDpadButtonInfo {
    //% enumval=MES_DPAD_BUTTON_A_DOWN
    ADown,
    //% enumval=MES_DPAD_BUTTON_A_UP
    AUp,
    //% enumval=MES_DPAD_BUTTON_B_DOWN
    BDown,
    //% enumval=MES_DPAD_BUTTON_B_UP
    BUp,
    //% enumval=MES_DPAD_BUTTON_C_DOWN
    CDown,
    //% enumval=MES_DPAD_BUTTON_C_UP
    CUp,
    //% enumval=MES_DPAD_BUTTON_D_DOWN
    DDown,
    //% enumval=MES_DPAD_BUTTON_D_UP
    DUp,
    //% enumval=MES_DPAD_BUTTON_1_DOWN
    _1Up,
    //% enumval=MES_DPAD_BUTTON_1_UP
    _1Down,
    //% enumval=MES_DPAD_BUTTON_2_DOWN
    _2Down,
    //% enumval=MES_DPAD_BUTTON_2_UP
    _2Up,
    //% enumval=MES_DPAD_BUTTON_3_DOWN
    _3Down,
    //% enumval=MES_DPAD_BUTTON_3_UP
    _3Up,
    //% enumval=MES_DPAD_BUTTON_4_DOWN
    _4Down,
    //% enumval=MES_DPAD_BUTTON_4_UP
    _4Up,
}

enum Notes {
    //% enumval=262
    C,
    //% enumval=277
    CSharp_,
    //% enumval=294
    D,
    //% enumval=311
    Eb,
    //% enumval=330
    E,
    //% enumval=349
    F,
    //% enumval=370
    FSharp_,
    //% enumval=392
    G,
    //% enumval=415
    GSharp_,
    //% enumval=440
    A,
    //% enumval=466
    Bb,
    //% enumval=494
    B,
    //% enumval=131
    C3,
    //% enumval=139
    CSharp_3,
    //% enumval=147
    D3,
    //% enumval=156
    Eb3,
    //% enumval=165
    E3,
    //% enumval=175
    F3,
    //% enumval=185
    FSharp_3,
    //% enumval=196
    G3,
    //% enumval=208
    GSharp_3,
    //% enumval=220
    A3,
    //% enumval=233
    Bb3,
    //% enumval=247
    B3,
    //% enumval=262
    C4,
    //% enumval=277
    CSharp_4,
    //% enumval=294
    D4,
    //% enumval=311
    Eb4,
    //% enumval=330
    E4,
    //% enumval=349
    F4,
    //% enumval=370
    FSharp_4,
    //% enumval=392
    G4,
    //% enumval=415
    GSharp_4,
    //% enumval=440
    A4,
    //% enumval=466
    Bb4,
    //% enumval=494
    B4,
    //% enumval=523
    C5,
    //% enumval=555
    CSharp_5,
    //% enumval=587
    D5,
    //% enumval=622
    Eb5,
    //% enumval=659
    E5,
    //% enumval=698
    F5,
    //% enumval=740
    FSharp_5,
    //% enumval=784
    G5,
    //% enumval=831
    GSharp_5,
    //% enumval=880
    A5,
    //% enumval=932
    Bb5,
    //% enumval=989
    B5,
}

namespace basic {
    //% help=functions/show-string weight=87
    //% shim=micro_bit::scrollString async
    /**
     * Display text on the display, one character at a time, and shift by one column each ``interval`` milliseconds. If the string fits on the screen (i.e. is one letter), does not scroll.
     * @param interval how fast to shift characters; eg: 150, 100, 200, -100
     */
    export function showString(text: string, interval: number = 150): void { }

    /**
     * Turn off all LEDs
     */
    //% help=functions/clear-screen weight=79
    //% shim=micro_bit::clearScreen
    export function clearScreen(): void { }

    /**
     * Pause for the specified time in milliseconds
     * @param ms how long to pause for, eg: 100, 200, 500, 1000, 2000
     */
    //% help=functions/pause weight=88
    //% shim=micro_bit::pause async 
    export function pause(ms: number): void { }

    /**
     * Scroll a number on the screen and shift by one column every ``interval`` milliseconds. If the number fits on the screen (i.e. is a single digit), does not scroll.
     * @param interval speed of scroll; eg: 150, 100, 200, -100
     */
    //% help=functions/show-number
    //% weight=89
    //% shim=micro_bit::scrollNumber
    //% async
    export function showNumber(value: number, interval: number = 150): void { }

    /**
     * Repeats the code forever in the background. On each iteration, allows other codes to run.
     * @param body TODO
     */
    //% help=functions/forever weight=55 shim=micro_bit::forever async
    export function forever(body:() => void) : void {}
}

namespace input {
    /**
     * Get the button state (pressed or not) for ``A`` and ``B``.
     */
    //% help=functions/button-is-pressed weight=59
    //% shim=micro_bit::isButtonPressed
    export function buttonIsPressed(button: Button): boolean { return false; }
}

namespace control {
    /**
     * Schedules code that run in the background.
    //% help=functions/in-background shim=micro_bit::runInBackground
     */
    export function inBackground(body: Action): void { }
}

namespace helpers {
    export function arraySplice<T>(arr: T[], start: number, len: number) {
        if (start < 0) return;
        for (let i = 0; i < len; ++i)
            arr.removeAt(start)
    }
}

namespace console {
    export function log(msg: string) {
        serial.writeLine(msg);
    }
}

namespace serial {
    /**
     * Prints a line of text to the serial
     */
    export function writeLine(text: string): void {
        writeString(text);
        writeString("\r\n");
    }

    /**
     * Prints a numeric value to the serial
     */
    export function writeNumber(value: number): void {
        writeString(value.toString());
    }

    /**
     * Reads a line of text from the serial port.
     */
    //% shim=micro_bit::serialReadString
    export function readString(): string {
        return ""
    }

    /**
     * Sends a piece of text through Serial connection.
     */
    //% shim=micro_bit::serialSendString
    export function writeString(text: string): void {
    }

    /**
     * Sends the current pixel values, byte-per-pixel, over serial.
     */
    //% shim=micro_bit::serialSendDisplayState
    export function writeScreen(): void {
    }

    /**
     * Reads the screen from serial.
     */
    //% shim=micro_bit::serialReadDisplayState
    export function readScreen(): void {
    }

    /**
     * Writes a ``name: value`` pair line to the serial.
     */
    //% weight=80
    export function writeValue(name: string, value: number): void {
        writeString(name);
        writeString(": ");
        writeNumber(value);
        writeLine("");
    }
}

namespace basic {
    /**
     * Shows a sequence of LED screens as an animation with an ``interval`` delay between each frame
     * {language:leds:bitmatrix}
     * @param leds TODO
     * @param interval TODO
     */
    //% help=functions/show-animation shim=micro_bit::showAnimation
    export function showAnimation(leds: string, interval: number) : void {}

    /**
     * Draws an image on the LED screen and pauses for the given milliseconds.
     * {language:leds:bitframe}
     * @param leds TODO
     * @param ms TODO
     */
    //% help=functions/show-leds weight=95 shim=micro_bit::showLeds
    export function showLeds(leds: string, ms: number) : void {}

    /**
     * Draws an image on the LED screen.
     * {language:leds:bitframe}
     * @param leds TODO
     */
    //% help=functions/plot-leds weight=80 shim=micro_bit::plotLeds async
    export function plotLeds(leds: string) : void {}
}

namespace input {
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
    //% help=functions/magnetic-force weight=43 shim=micro_bit::getMagneticForce async
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
    //% help=functions/light-level weight=55 shim=micro_bit::lightLevel async
    export function lightLevel() : number { return 0; }
}

namespace led {
    /**
     * Turn on the specified LED using ``x``, ``y`` coordinates (``x`` is horizontal, ``y`` is vertical)
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/plot weight=78 shim=micro_bit::plot async
    export function plot(x: number, y: number) : void {}

    /**
     * Get the on/off state of the specified LED using ``x, y`` coordinates.
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/point weight=76 shim=micro_bit::point async
    export function point(x: number, y: number) : boolean { return false;}

    /**
     * Turn off the specified LED using x, y coordinates (x is horizontal, y is vertical)
     * @param x TODO
     * @param y TODO
     */
    //% help=functions/unplot weight=77 shim=micro_bit::unPlot async
    export function unplot(x: number, y: number) : void {}

    /**
     * Get the screen brightness from 0 (off) to 255 (full bright).
     */
    //% help=functions/brightness weight=75 shim=micro_bit::getBrightness async
    export function brightness() : number { return 0;}

    /**
     * Set the screen brightness from 0 (off) to 255 (full bright).
     * @param value TODO
     */
    //% help=functions/set-brightness weight=74 shim=micro_bit::setBrightness async
    export function setBrightness(value: number) : void {}

    /**
     * Cancels the current animation and clears other pending animations.
     */
    //% weight=10 shim=uBit.display.stopAnimation async help=functions/stop-animation
    export function stopAnimation() : void {}

    /**
     * Sets the display mode between black and white and greyscale for rendering LEDs.
     * @param mode TODO
     */
    //% shim=micro_bit::setDisplayMode async weight=1 help=/functions/set-display-mode
    export function setDisplayMode(mode: DisplayMode) : void {}
}
namespace pins {
    /**
     * Set a pin or connector value to either 0 or 1.
     * @param name TODO
     * @param value TODO
     */
    //% help=functions/digital-write-pin weight=48 shim=micro_bit::digitalWritePin async
    export function digitalWritePin(name: string, value: number) : void { }

    /**
     * Read the specified pin or connector as either 0 or 1
     * @param name TODO
     */
    //% help=functions/digital-read-pin weight=49 shim=micro_bit::digitalReadPin async
    export function digitalReadPin(name: string) : number { return 0; }

    /**
     * Read the connector value as analog, that is, as a value comprised between 0 and 1023.
     * @param name TODO
     */
    //% help=functions/analog-read-pin weight=47 shim=micro_bit::analogReadPin async
    export function analogReadPin(name: string) : number { return 0; }

    /**
     * Set the connector value as analog. Value must be comprised between 0 and 1023.
     * @param name TODO
     * @param value TODO
     */
    //% help=functions/analog-write-pin weight=46 shim=micro_bit::analogWritePin async
    export function analogWritePin(name: string, value: number) : void { }

    /**
     * Configures the Pulse-width modulation (PWM) of the analog output to the given value in **microseconds** or `1/1000` milliseconds.
     * If this pin is not configured as an analog output (using `analog write pin`), the operation has no effect.
     * @param pin TODO
     * @param micros TODO
     */
    //% shim=micro_bit::setAnalogPeriodUs async help=functions/analog-set-period weight=10
    export function analogSetPeriod(pin: string, micros: number) : void { }

    /**
     * Sets the pin used when using `pins->analog pitch`.
     * @param name TODO
     */
    //% shim=micro_bit::enablePitch async help=functions/analog-set-pitch weight=12
    export function analogSetPitchPin(name: string) : void { }

    /**
     * Emits a Pulse-width modulation (PWM) signal to the current pitch pin. Use `analog set pitch pin` to define the pitch pin.
     * @param frequency TODO
     * @param ms TODO
     */
    //% shim=micro_bit::pitch help=functions/analog-pitch weight=14
    export function analogPitch(frequency: number, ms: number) : void { }

    /**
     * Re-maps a number from one range to another. That is, a value of ``from low`` would get mapped to ``to low``, a value of ``from high`` to ``to high``, values in-between to values in-between, etc.
     * @param value TODO
     * @param fromLow TODO
     * @param fromHigh TODO
     * @param toLow TODO
     * @param toHigh TODO
     */
    //% help=functions/map weight=40
    export function map(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number) : number
    {
        let r: number;
        return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    }

    /**
     * Writes a value to the servo, controlling the shaft accordingly. On a standard servo, this will set the angle of the shaft (in degrees), moving the shaft to that orientation. On a continuous rotation servo, this will set the speed of the servo (with ``0`` being full-speed in one direction, ``180`` being full speed in the other, and a value near ``90`` being no movement).
     * @param name TODO
     * @param value TODO
     */
    //% help=functions/servo-write-pin weight=44 shim=micro_bit::servoWritePin async
    export function servoWritePin(name: string, value: number) : void { }

    /**
     * Configures this IO pin as an analog/pwm output, configures the period to be 20 ms, and sets the pulse width, based on the value it is given **microseconds** or `1/1000` milliseconds.
     * @param pin TODO
     * @param micros TODO
     */
    //% shim=micro_bit::setServoPulseUs async help=functions/serial-set-pulse weight=10
    export function servoSetPulse(pin: string, micros: number) : void { }
}

namespace control {
    /**
     * Resets the BBC micro:bit.
     */
    //% weight=1 shim=uBit.reset async help=functions/reset
    export function reset() : void { }
}
namespace devices {
    /**
     * Sends a ``camera`` command to the parent device.
     * @param event TODO
     */
    //% weight=19 help=functions/tell-camera-to shim=micro_bit::devices::camera async
    export function tellCameraTo(event: string) : void { }

    /**
     * Sends an ``alert`` command to the parent device.
     * @param event TODO
     */
    //% weight=18 help=functions/raise-alert-to shim=micro_bit::devices::alert async
    export function raiseAlertTo(event: string) : void { }

    /**
     * Registers code to run when the device notifies about a particular event.
     * @param event TODO
     * @param body TODO
     */
    //% shim=micro_bit::onDeviceInfo async help=functions/on-notified
    export function onNotified(event: string, body:Action) : void { }

    /**
     * Sends a ``remote control`` command to the parent device.
     * @param event TODO
     */
    //% weight=20 help=functions/tell-remote-control-to shim=micro_bit::devices::remote_control async
    export function tellRemoteControlTo(event: string) : void { }

    /**
     * Returns the last signal strength reported by the paired device.
     */
    //% help=functions/signal-strength weight=40 shim=micro_bit::signalStrength async
    export function signalStrength() : number { return 0; }

    /**
     * Registers code to run when the device notifies about a change of signal strength.
     * @param body TODO
     */
    //% shim=micro_bit::onSignalStrengthChanged async help=functions/on-signal-strength-changed
    export function onSignalStrengthChanged(body:Action) : void { }

    /**
     * Register code to run when the micro:bit receives a command from the paired gamepad.
     * @param name TODO
     * @param body TODO
     */
    //% help=functions/on-gamepad-button weight=40 shim=micro_bit::onGamepadButton async
    export function onGamepadButton(name: string, body:Action) : void { }

}

namespace music {
    /**
     * Plays a tone through pin ``P0`` for the given duration.
     * @param frequency TODO
     * @param ms TODO
     */
    //% help=functions/play-tone weight=90
    export function playTone(frequency: number, ms: number) : void 
    {
        pins.analogSetPitchPin("P0");
        pins.analogPitch(frequency, ms);
    }

    /**
     * Gets the frequency of a note.
     * @param name TODO
     */
    //% shim=TD_ID async weight=40 help=functions/note-frequency
    export function noteFrequency(name: Notes) : number { return name; }

    /**
     * Plays a tone through pin ``P0``.
     * @param frequency TODO
     */
    //% help=functions/ring-tone weight=80
    export function ringTone(frequency: number) : void
    {
        pins.analogSetPitchPin("P0");
        pins.analogPitch(frequency, 0);
    }

    /**
     * Rests (plays nothing) for a specified time through pin ``P0``.
     * @param ms TODO
     */
    //% help=functions/rest weight=79
    export function rest(ms: number) : void
    {
        playTone(0, ms);
    }

    /**
     * This function is obsolete. Please use ``music->note frequency`` instead.
     * @param name TODO
     */
    //% weight=0 help=functions/note-frequency
    export function note(name: Notes) : number
    {
        return noteFrequency(name);
    }

    /**
     * This function is obsolete. Please use ``music->play tone`` instead.
     * @param frequency TODO
     * @param ms TODO
     */
    //% help=functions/play-tone weight=0
    export function playNote(frequency: number, ms: number) : void
    {
        playTone(frequency, ms);
    }

}

export interface Image {
    /**
     * Shows an frame from the image at offset ``x offset``.
     * @param xOffset TODO
     */
    //% help=functions/show-image weight=69 shim=micro_bit::showImage
    showImage(xOffset: number) : void;
}
