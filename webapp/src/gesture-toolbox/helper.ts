import { Vector } from './types';

export function parseString(strBuf: string): any {
    // populate members of newData (type: SensorData) with the values received from the device
    let strBufArray = strBuf.split(" ");
    let result = {acc: false, accVec: new Vector(0, 0, 0),
                  mag: false, magVec: new Vector(0, 0, 0)};

    for (let i = 0; i < strBufArray.length; i++) {
        if (strBufArray[i] == "A") {
            result.accVec = new Vector(parseInt(strBufArray[i + 1]), parseInt(strBufArray[i + 2]), parseInt(strBufArray[i + 3]));
            result.acc = true;

            i += 3;
        }
        else if (strBufArray[i] == "M") {
            result.magVec = new Vector(parseInt(strBufArray[i + 1]), parseInt(strBufArray[i + 2]), parseInt(strBufArray[i + 3]));
            result.mag = true;

            i += 3;
        }
    }

    return result;
}

export function trim(val: number, maxVal: number): number {
    if (val < -maxVal) return -maxVal;
    else if (val > maxVal) return maxVal;
    else return val;
}