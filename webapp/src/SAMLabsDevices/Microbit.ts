import Controller from "../../../react-common/components/SAMLabsBluetoothControllers/Microbit/Controller";
import * as simulator from "../simulator";

interface LEDValues {
    x: number;
    y: number;
}

class Microbit {
  Controller: any;
  constructor() {
    this.Controller = new Controller();

    window.addEventListener("message", ev => {
        if (ev.data.type === "microbitConnect") {
            this.connect()
        }

        if (ev.data.type === "ledDisplayWord") {
            this.displayText(ev.data.value);
        }
        if (ev.data.type === "ledDisplayShape") {
            this.displayPattern(ev.data.value);
        }
        if (ev.data.type === "plot") {
            this.plot(ev.data.value);
        }
        if (ev.data.type === "unplot") {
            this.unplot(ev.data.value);
        }
        if (ev.data.type === "toggle") {
            this.toggle(ev.data.value);
        }
        if (ev.data.type === "clearLED") {
            this.clearLED();
        }
    }, false);
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

   connect = () => {
    this.Controller.connect();
  };

   displayPattern=(value:string)=>{
      if (this.Controller._connected) {
        this.Controller.displayPattern(value);
      }
  }

   displayText=(value:string)=>{
        if (this.Controller._connected) {
            this.Controller.displayText(value);
        }
  }
   plot = (value:LEDValues)=>{
      this.Controller.plot(value.x, value.y);
  }
   unplot = (value:LEDValues)=>{
      this.Controller.unplot(value.x, value.y);
  }

   toggle = (value:LEDValues)=>{
      this.Controller.toggle(value.x, value.y);
  }
   clearLED = ()=>{
       this.Controller.clearLED();
  }
    onAButtonDown = () => {
        simulator.driver.postMessage({ type: "AButtonDown" } );
    }
    onAButtonUp = () => {
        simulator.driver.postMessage({ type: "AButtonUp" } );
    }
    onBButtonDown = () => {
        simulator.driver.postMessage({ type: "BButtonDown" } );
    }
    onBButtonUp = () => {
        simulator.driver.postMessage({ type: "BButtonUp" } );
    }
    onTemperatureChanged = () => {
        simulator.driver.postMessage({ type: "temperatureChanged",value:{
            temperature: this.Controller._temperature,
            isTemperatureChanged: this.Controller._isTemperatureChanged
            } } );
    }
    onAccelerometerChanged = () => {
        simulator.driver.samMessageToTarget({ type: "accelerometerChanged" ,value:{
            x: this.Controller._xAccel,
            y: this.Controller._yAccel,
            z: this.Controller._zAccel
            }} );
    }

}

export default Microbit;
