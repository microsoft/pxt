enum MesCameraEvent {
    //% enumval=MES_CAMERA_EVT_TAKE_PHOTO blockId="take photo"
    TakePhoto,
    //% enumval=MES_CAMERA_EVT_START_VIDEO_CAPTURE blockId="start video capture"
    StartVideoCapture,
    //% enumval=MES_CAMERA_EVT_STOP_VIDEO_CAPTURE blockId="stop video capture"
    StopVideoCapture,
    //% enumval=MES_CAMERA_EVT_TOGGLE_FRONT_REAR blockId="toggle front-rear"
    ToggleFrontRear,
    //% enumval=MES_CAMERA_EVT_LAUNCH_PHOTO_MODE blockId="launch photo mode"
    LaunchPhotoMode,
    //% enumval=MES_CAMERA_EVT_LAUNCH_VIDEO_MODE blockId="launch video mode"
    LaunchVideoMode,
    //% enumval=MES_CAMERA_EVT_STOP_PHOTO_MODE blockId="stop photo mode"
    StopPhotoMode,
    //% enumval=MES_CAMERA_EVT_STOP_VIDEO_MODE blockId="stop video mode"
    StopVideoMode,
}

enum MesAlertEvent {
    //% enumval=MES_ALERT_EVT_DISPLAY_TOAST blockId="display toast"
    DisplayToast,
    //% enumval=MES_ALERT_EVT_VIBRATE blockId="vibrate"
    Vibrate,
    //% enumval=MES_ALERT_EVT_PLAY_SOUND blockId="play sound"
    PlaySound,
    //% enumval=MES_ALERT_EVT_PLAY_RINGTONE blockId="play ring tone"
    PlayRingtone,
    //% enumval=MES_ALERT_EVT_FIND_MY_PHONE blockId="find my phone"
    FindMyPhone,
    //% enumval=MES_ALERT_EVT_ALARM1 blockId="ring alarm"
    RingAlarm,
    //% enumval=MES_ALERT_EVT_ALARM2 blockId="ring alarm 2"
    RingAlarm2,
    //% enumval=MES_ALERT_EVT_ALARM3 blockId="ring alarm 3"
    RingAlarm3,
    //% enumval=MES_ALERT_EVT_ALARM4 blockId="ring alarm 4"
    RingAlarm4,
    //% enumval=MES_ALERT_EVT_ALARM5 blockId="ring alarm 5"
    RingAlarm5,
    //% enumval=MES_ALERT_EVT_ALARM6 blockId="ring alarm 6"
    RingAlarm6,
}

enum MesDeviceInfo {
    //% enumval=MES_DEVICE_INCOMING_CALL blockId="incoming call"
    IncomingCall,
    //% enumval=MES_DEVICE_INCOMING_MESSAGE blockId="incoming message"
    IncomingMessage,
    //% enumval=MES_DEVICE_ORIENTATION_LANDSCAPE blockId="orientation landscape"
    OrientationLandscape,
    //% enumval=MES_DEVICE_ORIENTATION_PORTRAIT blockId="orientation portrait"
    OrientationPortrait,
    //% enumval=MES_DEVICE_GESTURE_DEVICE_SHAKEN blockId="shaken"
    Shaken,
    //% enumval=MES_DEVICE_DISPLAY_OFF blockId="display off"
    DisplayOff,
    //% enumval=MES_DEVICE_DISPLAY_ON blockId="display on"
    DisplayOn,
}

enum MesRemoteControlEvent {
    //% enumval=MES_REMOTE_CONTROL_EVT_PLAY blockId="play"
    play,
    //% enumval=MES_REMOTE_CONTROL_EVT_PAUSE blockId="pause"
    pause,
    //% enumval=MES_REMOTE_CONTROL_EVT_STOP blockId="stop"
    stop,
    //% enumval=MES_REMOTE_CONTROL_EVT_NEXTTRACK blockId="next track"
    nextTrack,
    //% enumval=MES_REMOTE_CONTROL_EVT_PREVTRACK blockId="previous track"
    previousTrack,
    //% enumval=MES_REMOTE_CONTROL_EVT_FORWARD blockId="forward"
    forward,
    //% enumval=MES_REMOTE_CONTROL_EVT_REWIND blockId="rewind"
    rewind,
    //% enumval=MES_REMOTE_CONTROL_EVT_VOLUMEUP blockId="volume up"
    volumeUp,
    //% enumval=MES_REMOTE_CONTROL_EVT_VOLUMEDOWN blockId="volume down"
    volumeDown,
}

enum MesDpadButtonInfo {
    //% enumval=MES_DPAD_BUTTON_A_DOWN blockId="A down"
    ADown,
    //% enumval=MES_DPAD_BUTTON_A_UP blockId="A up"
    AUp,
    //% enumval=MES_DPAD_BUTTON_B_DOWN blockId="B down"
    BDown,
    //% enumval=MES_DPAD_BUTTON_B_UP blockId="B up"
    BUp,
    //% enumval=MES_DPAD_BUTTON_C_DOWN blockId="C down"
    CDown,
    //% enumval=MES_DPAD_BUTTON_C_UP blockId="C up"
    CUp,
    //% enumval=MES_DPAD_BUTTON_D_DOWN blockId="D down"
    DDown,
    //% enumval=MES_DPAD_BUTTON_D_UP blockId="D up"
    DUp,
    //% enumval=MES_DPAD_BUTTON_1_UP blockId="1 down"
    _1Down,
    //% enumval=MES_DPAD_BUTTON_1_DOWN blockId="1 up"
    _1Up,
    //% enumval=MES_DPAD_BUTTON_2_DOWN blockId="2 down"
    _2Down,
    //% enumval=MES_DPAD_BUTTON_2_UP blockId="2 up"
    _2Up,
    //% enumval=MES_DPAD_BUTTON_3_DOWN blockId="3 down"
    _3Down,
    //% enumval=MES_DPAD_BUTTON_3_UP blockId="3 up"
    _3Up,
    //% enumval=MES_DPAD_BUTTON_4_DOWN blockId="4 down"
    _4Down,
    //% enumval=MES_DPAD_BUTTON_4_UP blockId="4 up"
    _4Up,
}

//% color=156 weight=80
namespace devices {
    /**
     * Sends a ``camera`` command to the parent device.
     * @param event TODO
     */
    //% weight=30 help=functions/tell-camera-to shim=micro_bit::devices::camera
    //% blockId=devices_camera icon="\uf030" block="tell camera to|%property" blockGap=8
    export function tellCameraTo(event: MesCameraEvent): void { }

    /**
     * Sends a ``remote control`` command to the parent device.
     * @param event TODO
     */
    //% weight=29 help=functions/tell-remote-control-to shim=micro_bit::devices::remote_control
    //% blockId=devices_remote_control block="tell remote control to|%property" blockGap=14 icon="\uf144"
    export function tellRemoteControlTo(event: MesRemoteControlEvent): void { }

    /**
     * Sends an ``alert`` command to the parent device.
     * @param event TODO
     */
    //% weight=27 help=functions/raise-alert-to shim=micro_bit::devices::alert
    //% blockId=devices_alert block="raise alert to|%property" icon="\uf0f3"
    export function raiseAlertTo(event: MesAlertEvent): void { }

    /**
     * Registers code to run when the device notifies about a particular event.
     * @param event TODO
     * @param body TODO
     */
    //% shim=micro_bit::onDeviceInfo help=functions/on-notified
    //% weight=26
    //% blockId=devices_device_info_event block="on notified" icon="\uf10a"
    export function onNotified(event: MesDeviceInfo, body: Action): void { }

    /**
     * Register code to run when the micro:bit receives a command from the paired gamepad.
     * @param name TODO
     * @param body TODO
     */
    //% help=functions/on-gamepad-button weight=40 shim=micro_bit::onGamepadButton
    //% weight=25
    //% blockId=devices_gamepad_event block="on gamepad button|%NAME" icon="\uf11b"
    export function onGamepadButton(name: MesDpadButtonInfo, body: Action): void { }

    /**
     * Returns the last signal strength reported by the paired device.
     */
    //% help=functions/signal-strength weight=24 shim=micro_bit::signalStrength
    //% blockId=devices_signal_strength block="signal strength" blockGap=14 icon="\uf012" blockGap=14
    export function signalStrength(): number {
        return 0;
    }

    /**
     * Registers code to run when the device notifies about a change of signal strength.
     * @param body TODO
     */
    //% shim=micro_bit::onSignalStrengthChanged weight=23 help=functions/on-signal-strength-changed
    //% blockId=devices_signal_strength_changed_event block="on signal strength changed" icon="\uf012"
    export function onSignalStrengthChanged(body: Action): void { }
}

