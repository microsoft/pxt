import * as simulator from "../../simulator";
import LEDController from "./Controller";


class LED{
    Controller: any;
    assignedName: pxsim.SimulatorMessage;
    static instances = new Map();
    constructor(id: pxsim.SimulatorMessage){
        this.assignedName = id;
        this.Controller = new LEDController('#00FF00');
        LED.instances.set(id, this);
        window.addEventListener("message", ev => {
            if (ev.data.type === `${this.assignedName} hydrate`) {
                if(this.Controller._isConnected){
                    simulator.driver.samMessageToTarget({ type: `${this.assignedName} bluetoothIsConnected`} );
                }
            }
            if (ev.data.type === `${this.assignedName} connect`) {
                this.Controller.connect(()=>{});
            }
            if (ev.data.type === `${this.assignedName} disconnect`) {
                this.Controller.disconnect();
            }
            if (ev.data.type === `setLEDColor for ${this.assignedName}`) {
                this.Controller.setLEDColor(ev.data.value);
            }
            if (ev.data.type === `setLEDDeviceBodyColor for ${this.assignedName}`) {
                this.Controller.setColor(ev.data.value);
            }
            if (ev.data.type === `setLEDBrightness for ${this.assignedName}`) {
                this.Controller.setLEDBrightness(ev.data.value);
            }
            if (ev.data.type === `turnLEDOff for ${this.assignedName}`) {
                this.Controller.turnLEDOff();
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
        this.Controller.on('valueChanged',()=>{
            simulator.driver.samMessageToTarget({ type: `${this.assignedName} valueChanged`, value:this.Controller._value} );
        })

    }
    static hasInstanceWithId(id: string ) {
        return LED.instances.has(id);
    }
}

export default LED;