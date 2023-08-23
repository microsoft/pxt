// @ts-nocheck
import BaseController from "../../../../react-common/components/SAMLabsCommon/BaseController";

class TiltController extends BaseController {
    constructor(appManager: any) {
        super(appManager, 'SAM Tilt')
        this._value = false
    }

    getValue = () => this._value

    _onReadCharacteristicValueChanged = (value: any[]) => {
        let isTilted = !!value[0]

        if(this._value !== isTilted) {
            this._value = isTilted
            this.emit('valueChanged', isTilted)
        }
    }
}
export default TiltController;