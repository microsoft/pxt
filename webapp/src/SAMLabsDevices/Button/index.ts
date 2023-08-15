import ButtonController from "./Controller";
import * as simulator from "../../simulator";


class Button{
    Controller: any;
    assignedName: pxsim.SimulatorMessage;
    static instances = new Map();
    constructor(id: pxsim.SimulatorMessage){
        this.assignedName = id;
        this.Controller = new ButtonController('#00FF00');
        Button.instances.set(id, this);
        window.addEventListener("message", ev => {
            if (ev.data.type === `${this.assignedName} hydrate`) {
                if(this.Controller._isConnected){
                    simulator.driver.samMessageToTarget({ type: `${this.assignedName} bluetoothIsConnected`} );
                }
            }
            if (ev.data.type === `${this.assignedName} connect`) {
                this.Controller.connect(()=>{});
            }
            if (ev.data.type === `setButtonColor for ${this.assignedName}`) {
                this.Controller.setColor(ev.data.value);
            }



        }, false);
        this.Controller.on('connected',()=>{
            simulator.driver.samMessageToTarget({ type: `${this.assignedName} bluetoothConnected`} );
        })
        this.Controller.on('bluetoothError',()=>{
            simulator.driver.samMessageToTarget({ type: `${this.assignedName} bluetoothConnectionErr`} );
        })
        this.Controller.on('pressed',()=>{
            simulator.driver.samMessageToTarget({ type: `${this.assignedName} buttonPressed`} );
        })
        this.Controller.on('released',()=>{
            simulator.driver.samMessageToTarget({ type: `${this.assignedName} buttonReleased`} );
        })
    }
    static hasInstanceWithId(id: string ) {
        return Button.instances.has(id);
    }
}

export default Button;