// @ts-nocheck
import Controller from "./Controller";
import textToPixels from "./TextToPixels";

class VirtualController extends Controller {
  // _characteristics;
  ledMatrix;
  textValue;
  constructor() {
    super();
    this._connected = true;
    this._temperature = 0;
    this.textValue = undefined;
    this._xAccel = 0;
    this._yAccel = 0;
    this._zAccel = 0;
    this.ledMatrix = this._ledMatrix;

    this._characteristics = {
      ledText: {
        writeValue: (value) =>
          new Promise((resolve) => {
            this.textValue = new TextDecoder("utf8").decode(value);
            this._onLEDChange();
            this.emit("LEDChanged");
            resolve();
          }),
      },
      ledMatrix: {
        writeValue: () =>
          new Promise((resolve) => {
            this._textValue = undefined;
            this._onLEDChange();
            this.emit("LEDChanged");
            resolve();
          }),
      },
      buttonA: {
        oncharacteristicvaluechanged: this._onButtonAChange,
      },
      buttonB: {
        oncharacteristicvaluechanged: this._onButtonBChange,
      },
    };
  }

  _onLEDChange = () => {
    clearInterval(this.textInterval);
    if (this.textValue) {
      this.currentText = textToPixels(" " + this.textValue);
      this.currentTextCounter = 0;
      this.textInterval = setInterval(() => {
        this.ledMatrix = this.currentText.getStartingSquare(
          5,
          5,
          this.currentTextCounter++
        );
        if (this.currentTextCounter > this.currentText.width) {
          clearInterval(this.textInterval);
          this._displayingText = false;
        }
        this.emit("LEDChanged");
      }, (1000 * this.textValue.length + 1) / this.currentText.width);
      this.textValue = undefined;
    } else {
      this.ledMatrix = this._ledMatrix;
    }
  };
}

export default VirtualController;
