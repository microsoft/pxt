import ServoMotorController from "./Controller";
import * as simulator from "../../simulator";


class ServoMotor{
    Controller: any;
    assignedName: pxsim.SimulatorMessage;
    static instances = new Map();
    constructor(id: pxsim.SimulatorMessage){
        this.assignedName = id;
        this.Controller = new ServoMotorController('#00FF00');
        ServoMotor.instances.set(id, this);
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
            if (ev.data.type === `setPosition for ${this.assignedName}`) {
                this.Controller.setPosition(ev.data.value);
            }
            if (ev.data.type === `setServoMotorColor for ${this.assignedName}`) {
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
    }
    static hasInstanceWithId(id: string ) {
        return ServoMotor.instances.has(id);
    }
}

export default ServoMotor;