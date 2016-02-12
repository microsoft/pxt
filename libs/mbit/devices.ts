namespace devices {
    export enum MesCameraEvent {
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

    export enum MesAlertEvent {
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

    export enum MesDeviceInfo {
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

    export enum MesRemoteControlEvent {
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

    