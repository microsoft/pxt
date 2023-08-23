// @ts-nocheck
import BaseController from "../../../../react-common/components/SAMLabsCommon/BaseController";


class Controller extends BaseController {
    _isPressed
    constructor(appManager:any) {
        super(appManager, 'SAM Button')
        this._isPressed = false
    }

    getIsPressed = () => this._isPressed

    _onReadCharacteristicValueChanged = (value:number[]) => {
        if(value[0] === 255) {
            this._isPressed = true
            this.emit('pressed')
        }
        else {
            this._isPressed = false
            this.emit('released')
        }
    }
}

export default Controller;

