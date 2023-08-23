// @ts-nocheck
import BaseController from "../../../../react-common/components/SAMLabsCommon/BaseController";
import { parameterValidator } from "../../../../react-common/components/SAMLabsCommon/Utils"

class ServoMotorController extends BaseController {
    constructor(appManager: any) {
        super(appManager, 'SAM Servo Motor')
        this._position = 0
        this._adjustedPosition = 0
    }

    _reset = () => {
        this._position = 2
        this._adjustedPosition = 0
        this._setWriteCharacteristicValue([this._position])
    }

    getPosition = () => this._adjustedPosition

    setPosition = parameterValidator(['number'], (position: number) => {
        if(!position) position = 0
        if(position > 180) position = 180
        if(position < 0) position = 0
        let adjustedValue = Math.floor((Math.abs(position)/180) * 226)
        if(position < 2) {
            adjustedValue = 2
        }
        if(this._position === adjustedValue) return
        this._adjustedPosition = position
        this._position = adjustedValue
        this._setWriteCharacteristicValue([this._position])
    })
}

export default ServoMotorController;