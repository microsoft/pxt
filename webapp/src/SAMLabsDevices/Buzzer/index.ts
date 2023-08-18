import BuzzerController from "./Controller";
import * as simulator from "../../simulator";


class Buzzer{
    Controller: any;
    assignedName: pxsim.SimulatorMessage;
    static instances = new Map();
    constructor(id: pxsim.SimulatorMessage){
        this.assignedName = id;
        this.Controller = new BuzzerController('#00FF00');
        Buzzer.instances.set(id, this);
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
            if (ev.data.type === `setBuzzerVolume for ${this.assignedName}`) {
                this.Controller.setVolume(ev.data.value);
            }
            if (ev.data.type === `setBuzzerPitch for ${this.assignedName}`) {
                this.Controller.setPitch(ev.data.value);
            }
            if (ev.data.type === `clearBuzzer for ${this.assignedName}`) {
                this.Controller.clear();
            }
            if (ev.data.type === `setBuzzerColor for ${this.assignedName}`) {
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
        return Buzzer.instances.has(id);
    }
}

export default Buzzer;