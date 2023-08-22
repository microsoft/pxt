// @ts-nocheck
import BaseController from "../../../../react-common/components/SAMLabsCommon/BaseController"

class TemperatureController extends BaseController {

    constructor(appManager: any) {
        super(appManager, 'SAM Temperature')
        this._value = 0
        this._rawValue = 100
    }

    getCelsiusValue = () => this._value
    getFarenheitValue = () => (this.getCelsiusValue() * 9/5) + 32

    _onReadCharacteristicValueChanged = (value: any[]) => {
        this._rawValue = value[0]
        const processedValue = Math.max(0, Math.round(this._rawValue / 2 - 50))

        if(this._value !== processedValue) {

            this._value = processedValue
            this.emit('valueChanged')
        }
    }
 }


export default TemperatureController;