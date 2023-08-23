import Controller from "../../../react-common/components/SAMLabsCommon/MicrobitController/Controller";
import * as simulator from "../simulator";


interface LEDValues {
    x: number;
    y: number;
}

class Microbit {
    Controller: any;
    assignedName: pxsim.SimulatorMessage;
    static instances = new Map();
    constructor(id:pxsim.SimulatorMessage){
        this.assignedName = id;
        this.Controller = new Controller();
        Microbit.instances.set(id, this);
        window.addEventListener("message", ev => {
            if (ev.data.type === `${this.assignedName} hydrate`) {
                if(this.Controller._connected){
                    simulator.driver.samMessageToTarget({ type: `${this.assignedName} bluetoothIsConnected`} );
                }
            }
            if (ev.data.type === `${this.assignedName} connect`) {
                this.Controller.connect();
            }
            if (ev.data.type === `${this.assignedName} disconnect`) {
                this.Controller.disconnect();
            }
            if (ev.data.type === `${this.assignedName} ledDisplayWord`) {
                this.Controller.displayText(ev.data.value);
            }
            if (ev.data.type === `${this.assignedName} ledDisplayShape`) {
                this.Controller.displayPattern(ev.data.value);
            }
            if (ev.data.type === `${this.assignedName} plot`) {
                this.Controller.plot(ev.data.value.x, ev.data.value.y);
            }
            if (ev.data.type === `${this.assignedName} unplot`) {
                this.Controller.unplot(ev.data.value.x, ev.data.value.y);
            }
            if (ev.data.type === `${this.assignedName} toggle`) {
                this.Controller.toggle(ev.data.value.x, ev.data.value.y);
            }
            if (ev.data.type === `${this.assignedName} clearLED`) {
                this.Controller.clearLED();
            }

        }, false);
        this.Controller.on('connected',()=>{
            simulator.driver.samMessageToTarget({ type: `${this.assignedName} bluetoothConnected`} );
        })
        this.Controller.on('bluetoothError',()=>{
            simulator.driver.samMessageToTarget({ type: `${this.assignedName} bluetoothConnectionErr`} );
        })
        this.Controller.on('disconnected',()=>{
            simulator.driver.samMessageToTarget({ type: `${this.assignedName} bluetoothDisconnected`} );
        })
        this.Controller.on("APressed", this.onAButtonDown);
        this.Controller.on("AReleased", this.onAButtonUp);
        this.Controller.on("BPressed", this.onBButtonDown);
        this.Controller.on("BReleased", this.onBButtonUp);
        this.Controller.on(
            "temperatureChanged",
            this.onTemperatureChanged
        );
        this.Controller.on(
            "accelerometerChanged",
            this.onAccelerometerChanged
        );
    }
    static hasInstanceWithId(id:any) {
        return Microbit.instances.has(id);
    }
    onAButtonDown = () => {
        simulator.driver.samMessageToTarget({ type:`${this.assignedName} AButtonDown`} );
    }
    onAButtonUp = () => {
        simulator.driver.samMessageToTarget({ type: `${this.assignedName} AButtonUp`} );
    }
    onBButtonDown = () => {
        simulator.driver.samMessageToTarget({ type: `${this.assignedName} BButtonDown` } );
    }
    onBButtonUp = () => {
        simulator.driver.samMessageToTarget({ type: `${this.assignedName} BButtonUp` } );
    }
    onTemperatureChanged = () => {
        simulator.driver.samMessageToTarget({ type: `${this.assignedName} temperatureChanged`,value:{
                temperature: this.Controller._temperature,
                isTemperatureChanged: this.Controller._isTemperatureChanged
            } } );
    }
    onAccelerometerChanged = () => {
        simulator.driver.samMessageToTarget({ type: `${this.assignedName} accelerometerChanged` ,value:{
                x: this.Controller._xAccel,
                y: this.Controller._yAccel,
                z: this.Controller._zAccel
            }} );
    }
}

export default  Microbit;
