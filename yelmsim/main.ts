/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/yelmlib.d.ts"/>

namespace yelm.rt {
    export interface SimulatorMessage {
        kind: string;
    }

    export interface SimulatorRunMessage extends SimulatorMessage {
        code: string;
        target: string;
        enums: Util.Map<number>;
    }
    
    export interface SimulatorStateMessage extends SimulatorMessage {
        state:string;
    }

    export module Embed {
        export function start() {
            console.log('listening for simulator commands')
            window.addEventListener("message", receiveMessage, false);            
        }

        function receiveMessage(event: MessageEvent) {
            console.log('received ' + JSON.stringify(event.data, null, 2))
            
            let origin = event.origin; // || (<any>event).originalEvent.origin;
            // TODO: test origins

            let data: SimulatorMessage = event.data || {};
            let kind = data.kind || '';
            switch (kind || '') {
                case 'run': run(<SimulatorRunMessage>data);break;
                case 'stop': stop(); break;
                default: console.error('unknown message');
            }
        }
        
        function postMessage(data: any) {
            // TODO: origins
            console.log('sending ' + JSON.stringify(data, null, 2))
            window.postMessage(data, "*");
        }
        
        var runtime : yelm.rt.Runtime;        
        export function stop() {
            if (runtime) {
                console.log('stopping preview runtime...')
                runtime.kill();
            }            
        }
        
        export function run(msg: SimulatorRunMessage) {
            stop();
            // TODO test data
            console.log('starting ' + msg.target);
            runtime = new Runtime(msg.code, msg.target);
            runtime.enums = msg.enums;
            switch(msg.target) {
                case 'microbit': initMicrobit(); break;
                case 'minecraft': initMinecraft(); break;
                default: console.error('unknown target');
            }
            
            postMessage({ kind: 'status', state: 'running' });
            runtime.run((v) => {
                
            })
        }
                
        function initMicrobit() {
            console.log('setting up microbit simulator')
            let view = new yelm.rt.micro_bit.MicrobitBoardSvg({
                theme: yelm.rt.micro_bit.randomTheme(),
                runtime: runtime
            })
            document.body.innerHTML = ''; // clear children
            document.body.appendChild(view.element);            
        }
        
        function initMinecraft() {
            console.log('setting up minecraft simulator');
            // TODO
        }
    }
}

window.addEventListener('load', function(ev) {
    let ens = <yelm.U.Map<number>>{"NO_PWMS":3,"MICROBIT_DEFAULT_PWM_PERIOD":20000,"MICROBIT_ID_BLE":1000,"MES_REMOTE_CONTROL_ID":1001,"MES_REMOTE_CONTROL_EVT_PLAY":1,"MES_REMOTE_CONTROL_EVT_PAUSE":2,"MES_REMOTE_CONTROL_EVT_STOP":3,"MES_REMOTE_CONTROL_EVT_NEXTTRACK":4,"MES_REMOTE_CONTROL_EVT_PREVTRACK":5,"MES_REMOTE_CONTROL_EVT_FORWARD":6,"MES_REMOTE_CONTROL_EVT_REWIND":7,"MES_REMOTE_CONTROL_EVT_VOLUMEUP":8,"MES_REMOTE_CONTROL_EVT_VOLUMEDOWN":9,"MES_CAMERA_ID":1002,"MES_CAMERA_EVT_LAUNCH_PHOTO_MODE":1,"MES_CAMERA_EVT_LAUNCH_VIDEO_MODE":2,"MES_CAMERA_EVT_TAKE_PHOTO":3,"MES_CAMERA_EVT_START_VIDEO_CAPTURE":4,"MES_CAMERA_EVT_STOP_VIDEO_CAPTURE":5,"MES_CAMERA_EVT_STOP_PHOTO_MODE":6,"MES_CAMERA_EVT_STOP_VIDEO_MODE":7,"MES_CAMERA_EVT_TOGGLE_FRONT_REAR":8,"MES_ALERTS_ID":1004,"MES_ALERT_EVT_DISPLAY_TOAST":1,"MES_ALERT_EVT_VIBRATE":2,"MES_ALERT_EVT_PLAY_SOUND":3,"MES_ALERT_EVT_PLAY_RINGTONE":4,"MES_ALERT_EVT_FIND_MY_PHONE":5,"MES_ALERT_EVT_ALARM1":6,"MES_ALERT_EVT_ALARM2":7,"MES_ALERT_EVT_ALARM3":8,"MES_ALERT_EVT_ALARM4":9,"MES_ALERT_EVT_ALARM5":10,"MES_ALERT_EVT_ALARM6":11,"MES_SIGNAL_STRENGTH_ID":1101,"MES_SIGNAL_STRENGTH_EVT_NO_BAR":1,"MES_SIGNAL_STRENGTH_EVT_ONE_BAR":2,"MES_SIGNAL_STRENGTH_EVT_TWO_BAR":3,"MES_SIGNAL_STRENGTH_EVT_THREE_BAR":4,"MES_SIGNAL_STRENGTH_EVT_FOUR_BAR":5,"MES_DEVICE_INFO_ID":1103,"MES_DEVICE_ORIENTATION_LANDSCAPE":1,"MES_DEVICE_ORIENTATION_PORTRAIT":2,"MES_DEVICE_GESTURE_NONE":3,"MES_DEVICE_GESTURE_DEVICE_SHAKEN":4,"MES_DEVICE_DISPLAY_OFF":5,"MES_DEVICE_DISPLAY_ON":6,"MES_DEVICE_INCOMING_CALL":7,"MES_DEVICE_INCOMING_MESSAGE":8,"MICROBIT_NAME_LENGTH":5,"MICROBIT_NAME_CODE_LETTERS":5,"MMA8653_SAMPLE_RANGES":3,"MMA8653_SAMPLE_RATES":8,"MICROBIT_ACCELEROMETER_EVT_DATA_UPDATE":1,"MICROBIT_ACCELEROMETER_EVT_TILT_UP":1,"MICROBIT_ACCELEROMETER_EVT_TILT_DOWN":2,"MICROBIT_ACCELEROMETER_EVT_TILT_LEFT":3,"MICROBIT_ACCELEROMETER_EVT_TILT_RIGHT":4,"MICROBIT_ACCELEROMETER_EVT_FACE_UP":5,"MICROBIT_ACCELEROMETER_EVT_FACE_DOWN":6,"MICROBIT_ACCELEROMETER_EVT_FREEFALL":7,"MICROBIT_ACCELEROMETER_EVT_3G":8,"MICROBIT_ACCELEROMETER_EVT_6G":9,"MICROBIT_ACCELEROMETER_EVT_8G":10,"MICROBIT_ACCELEROMETER_EVT_SHAKE":11,"MICROBIT_ACCELEROMETER_REST_TOLERANCE":200,"MICROBIT_ACCELEROMETER_TILT_TOLERANCE":200,"MICROBIT_ACCELEROMETER_FREEFALL_TOLERANCE":400,"MICROBIT_ACCELEROMETER_SHAKE_TOLERANCE":1000,"MICROBIT_ACCELEROMETER_3G_TOLERANCE":3072,"MICROBIT_ACCELEROMETER_6G_TOLERANCE":6144,"MICROBIT_ACCELEROMETER_8G_TOLERANCE":8192,"MICROBIT_ACCELEROMETER_GESTURE_DAMPING":10,"MICROBIT_ACCELEROMETER_SHAKE_DAMPING":10,"MICROBIT_ACCELEROMETER_SHAKE_COUNT_THRESHOLD":4,"MICROBIT_BUTTON_EVT_DOWN":1,"MICROBIT_BUTTON_EVT_UP":2,"MICROBIT_BUTTON_EVT_CLICK":3,"MICROBIT_BUTTON_EVT_LONG_CLICK":4,"MICROBIT_BUTTON_EVT_HOLD":5,"MICROBIT_BUTTON_EVT_DOUBLE_CLICK":6,"MICROBIT_BUTTON_LONG_CLICK_TIME":1000,"MICROBIT_BUTTON_HOLD_TIME":1500,"MICROBIT_BUTTON_STATE":1,"MICROBIT_BUTTON_STATE_HOLD_TRIGGERED":2,"MICROBIT_BUTTON_STATE_CLICK":4,"MICROBIT_BUTTON_STATE_LONG_CLICK":8,"MICROBIT_BUTTON_SIGMA_MIN":0,"MICROBIT_BUTTON_SIGMA_MAX":12,"MICROBIT_BUTTON_SIGMA_THRESH_HI":8,"MICROBIT_BUTTON_SIGMA_THRESH_LO":2,"MICROBIT_BUTTON_DOUBLE_CLICK_THRESH":50,"MAG3110_SAMPLE_RATES":11,"MICROBIT_COMPASS_EVT_CAL_REQUIRED":1,"MICROBIT_COMPASS_EVT_CAL_START":2,"MICROBIT_COMPASS_EVT_CAL_END":3,"MICROBIT_COMPASS_EVT_DATA_UPDATE":4,"MICROBIT_COMPASS_EVT_CONFIG_NEEDED":5,"MICROBIT_COMPASS_EVT_CALIBRATE":6,"MICROBIT_COMPASS_STATUS_CALIBRATED":1,"MICROBIT_COMPASS_STATUS_CALIBRATING":2,"MICROBIT_ID_BUTTON_A":1,"MICROBIT_ID_BUTTON_B":2,"MICROBIT_ID_BUTTON_RESET":3,"MICROBIT_ID_ACCELEROMETER":4,"MICROBIT_ID_COMPASS":5,"MICROBIT_ID_DISPLAY":6,"MICROBIT_IO_PINS":20,"MICROBIT_ID_IO_P0":7,"MICROBIT_ID_IO_P1":8,"MICROBIT_ID_IO_P2":9,"MICROBIT_ID_IO_P3":10,"MICROBIT_ID_IO_P4":11,"MICROBIT_ID_IO_P5":12,"MICROBIT_ID_IO_P6":13,"MICROBIT_ID_IO_P7":14,"MICROBIT_ID_IO_P8":15,"MICROBIT_ID_IO_P9":16,"MICROBIT_ID_IO_P10":17,"MICROBIT_ID_IO_P11":18,"MICROBIT_ID_IO_P12":19,"MICROBIT_ID_IO_P13":20,"MICROBIT_ID_IO_P14":21,"MICROBIT_ID_IO_P15":22,"MICROBIT_ID_IO_P16":23,"MICROBIT_ID_IO_P19":24,"MICROBIT_ID_IO_P20":25,"MICROBIT_ID_BUTTON_AB":26,"MICROBIT_ID_GESTURE":27,"MICROBIT_ID_THERMOMETER":28,"MICROBIT_ID_NOTIFY":1023,"MICROBIT_ID_NOTIFY_ONE":1022,"MICROBIT_STACK_SIZE":2048,"MICROBIT_HEAP_BLOCK_SIZE":4,"MICROBIT_HEAP_REUSE_SD":1,"FIBER_TICK_PERIOD_MS":6,"MESSAGE_BUS_LISTENER_MAX_QUEUE_DEPTH":10,"MICROBIT_SYSTEM_COMPONENTS":10,"MICROBIT_IDLE_COMPONENTS":6,"MICROBIT_BLE_ENABLED":1,"MICROBIT_BLE_PAIRING_MODE":1,"MICROBIT_BLE_PRIVATE_ADDRESSES":0,"MICROBIT_BLE_DFU_SERVICE":1,"MICROBIT_BLE_EVENT_SERVICE":1,"MICROBIT_BLE_DEVICE_INFORMATION_SERVICE":1,"MICROBIT_BLE_LED_SERVICE":0,"MICROBIT_BLE_ACCELEROMETER_SERVICE":0,"MICROBIT_BLE_MAGNETOMETER_SERVICE":0,"MICROBIT_BLE_BUTTON_SERVICE":0,"MICROBIT_BLE_IO_PIN_SERVICE":0,"MICROBIT_BLE_TEMPERATURE_SERVICE":0,"MICROBIT_BLE_MAXIMUM_SCROLLTEXT":20,"USE_ACCEL_LSB":0,"MICROBUG_REFERENCE_DEVICE":1,"MICROBIT_3X9":2,"MICROBIT_SB1":3,"MICROBIT_SB2":4,"MICROBIT_DISPLAY_MINIMUM_BRIGHTNESS":2,"MICROBIT_DISPLAY_MAXIMUM_BRIGHTNESS":255,"MICROBIT_DEFAULT_SCROLL_SPEED":120,"MICROBIT_DEFAULT_PRINT_SPEED":400,"MICROBIT_PANIC_HEAP_FULL":1,"MICROBIT_DBG":0,"MICROBIT_HEAP_DBG":0,"MICROBIT_DFU_OPCODE_START_DFU":1,"MICROBIT_DFU_OPCODE_START_PAIR":2,"MICROBIT_DFU_HISTOGRAM_WIDTH":5,"MICROBIT_DFU_HISTOGRAM_HEIGHT":5,"MICROBIT_DISPLAY_EVT_ANIMATION_COMPLETE":1,"MICROBIT_DISPLAY_EVT_FREE":2,"MICROBIT_DISPLAY_ROW_COUNT":3,"MICROBIT_DISPLAY_COLUMN_COUNT":9,"MICROBIT_DISPLAY_WIDTH":5,"MICROBIT_DISPLAY_HEIGHT":5,"MICROBIT_DISPLAY_SPACING":1,"MICROBIT_DISPLAY_ERROR_CHARS":4,"MICROBIT_DISPLAY_GREYSCALE_BIT_DEPTH":8,"MICROBIT_FONT_WIDTH":5,"MICROBIT_FONT_HEIGHT":5,"MICROBIT_FONT_ASCII_START":32,"MICROBIT_FONT_ASCII_END":126,"MICROBIT_HEAP_COUNT":2,"MICROBIT_I2C_MAX_RETRIES":9,"MICROBIT_IO_PIN_SERVICE_PINCOUNT":20,"MICROBIT_IO_PIN_SERVICE_DATA_SIZE":10,"NO_CONN":0,"MICROBIT_CONTROL_BUS_ID":0,"MICROBIT_ID_ANY":0,"MICROBIT_EVT_ANY":0,"MICROBIT_PIN_MAX_OUTPUT":1023,"MICROBIT_PIN_MAX_SERVO_RANGE":180,"MICROBIT_PIN_DEFAULT_SERVO_RANGE":1000,"MICROBIT_SERIAL_DEFAULT_BAUD_RATE":115200,"MICROBIT_SERIAL_BUFFER_SIZE":20,"MICROBIT_THERMOMETER_PERIOD":1000,"MICROBIT_THERMOMETER_EVT_UPDATE":1};
        yelm.rt.Embed.run({code:`var __main__2456 = entryPoint  = function (step) {
var r0 = rr0, r1 = rr1, r2 = rr2, r3 = rr3
while (true) { switch (step) {
  case 0: // start
    push(lr)
    r0 = _inline_1247_Lit
    r0 = rt.bitvm.stringData(r0)
    push(r0)
    rt.micro_bit.forever(r0)
    r0 = pop()
    rt.bitvm.decr(r0)
  case 72:  // .ret.2456
    return leave(r0)
} } }

var __main__2456_Lit = function (step) {
var r0 = rr0, r1 = rr1, r2 = rr2, r3 = rr3
while (true) { switch (step) {
  case 0: // start
    push(lr)
    push(r5)
    r5 = r1
    return actionCall(__main__2456, 88)
  case 88:  // .call.1.0
    r5 = pop()
    return leave(r0)
} } }

var _inline_1247 = function (step) {
var r0 = rr0, r1 = rr1, r2 = rr2, r3 = rr3
while (true) { switch (step) {
  case 0: // start
    push(lr)
    r0 = "Hello!"
    r0 = rt.bitvm.stringData(r0)
    r1 = 150
    setupResume(108)
    return rt.micro_bit.scrollString(r0, r1)
  case 108:  // .async.2.0
  case 108:  // .ret.1247
    return leave(r0)
} } }

var _inline_1247_Lit = function (step) {
var r0 = rr0, r1 = rr1, r2 = rr2, r3 = rr3
while (true) { switch (step) {
  case 0: // start
    push(lr)
    push(r5)
    r5 = r1
    return actionCall(_inline_1247, 124)
  case 124:  // .call.2.1
    r5 = pop()
    return leave(r0)
} } }
// The End.
`,target:'microbit', enums:ens, kind:'run'});    
}, false)