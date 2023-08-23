// @ts-nocheck
import { parameterValidator } from '../../../../react-common/components/SAMLabsCommon/Utils'
import BaseController from "../../../../react-common/components/SAMLabsCommon/BaseController";

class BuzzerController extends BaseController {
    constructor(appManager:any) {
        super(appManager, 'SAM Buzzer')
        this._volume = 100
        this._pitch = 0
        this._rawValue = this._getValue()
    }

    _reset = () => {
        this._pitch = 0
        this._volume = 100
        this._rawValue = this._getValue()
        this._setWriteCharacteristicValue([this._rawValue])
    }

    getPitch = () => this._pitch

    getVolume = () => this._volume

    setPitch = parameterValidator(['number'], (pitch: number) => {
        this._pitch = pitch % 13
        const rawValue = this._getValue()
        if(rawValue !== this._rawValue) {
            this._rawValue = rawValue
            this._setWriteCharacteristicValue([this._rawValue])
        }
    })

    setVolume = parameterValidator(['number'], (volume: number) => {
        if(volume > 100) volume = 100
        if(volume < 0) volume = 0
        this._volume = volume
        const rawValue = this._getValue()
        if(rawValue !== this._rawValue) {
            this._rawValue = rawValue
            this._setWriteCharacteristicValue([this._rawValue])
        }
    })

    clear = () => {
        this.setVolume(0)
        this.setPitch(0)
    }

    _getValue = () => {
        const interval = Math.round(this._volume/100 * 7)

        return this._pitch + (interval * 32)
    }
}

export default BuzzerController;