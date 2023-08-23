import PressureSensorController from "./Controller";
import * as simulator from "../../simulator";


class PressureSensor{
    Controller: any;
    assignedName: pxsim.SimulatorMessage;
    static instances = new Map();
    constructor(id: pxsim.SimulatorMessage){
        this.assignedName = id;
        this.Controller = new PressureSensorController('#00FF00');
        PressureSensor.instances.set(id, this);
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
            if (ev.data.type === `setPressureSensorColor for ${this.assignedName}`) {
                this.Controller.setColor(ev.data.value);
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
        return PressureSensor.instances.has(id);
    }
}

export default PressureSensor;