import DCMotorController from "./Controller";
import * as simulator from "../../simulator";


class DCMotor{
    Controller: any;
    assignedName: pxsim.SimulatorMessage;
    static instances = new Map();
    constructor(id: pxsim.SimulatorMessage){
        this.assignedName = id;
        this.Controller = new DCMotorController('#00FF00');
        DCMotor.instances.set(id, this);
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
            if (ev.data.type === `setDCMotorSpeed for ${this.assignedName}`) {
                this.Controller.setSpeed(ev.data.value);
            }
            if (ev.data.type === `setDCMotorColor for ${this.assignedName}`) {
                this.Controller.setColor(ev.data.value);
            }
            if (ev.data.type === `stopDCMotorSpeed for ${this.assignedName}`) {
                this.Controller.setSpeed(0);
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
    }
    static hasInstanceWithId(id: string ) {
        return DCMotor.instances.has(id);
    }
}

export default DCMotor;