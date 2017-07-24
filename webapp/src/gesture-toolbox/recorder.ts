import { Vector, GestureSample, Gesture } from './types';
import * as Viz from './visualizations';
import * as Webcam from "./webcam";

export let isRecording = false;
export let recData: Gesture[] = [];
let recPointer: number = -1;

export function initKeyboard() {
    // assign events to capture if recording or not
        window.onkeydown = (e: any) => {
            // if pressed "space" key
            if (e.keyCode == 32)
                isRecording = true;
        };

        window.onkeyup = (e: any) => {
            // if released "space" key
            if (e.keyCode == 32)
                isRecording = false;
        };
}


export function startRecording(newData: Vector, gestIndex: number, gestName: string) {
    let newSample = new GestureSample();
    newSample.startTime = Date.now();
    newSample.rawData.push(newData.clone());

    if (gestIndex >= recData.length) {
        let newGesture = new Gesture();
        newGesture.label = gestIndex + 1;
        newGesture.name = gestName;

        recData.push(newGesture);
    }

    recData[gestIndex].gestures.push(newSample);
    recPointer = gestIndex;

    Webcam.mediaRecorder.start(15 * 1000);
}


export function continueRecording(newData: Vector) {
    let cur = recData[recPointer].gestures.length - 1;
    recData[recPointer].gestures[cur].rawData.push(newData.clone());
}


export function stopRecording() {
    let cur = recData[recPointer].gestures.length - 1;
    recData[recPointer].gestures[cur].endTime = Date.now();

    Webcam.mediaRecorder.stop();


    Webcam.mediaRecorder.ondataavailable = function (blob: any) {
        let vid = window.URL.createObjectURL(blob);
        recData[recPointer].gestures[cur].video = vid;

        if (cur == 0) {
            // create the whole things
            recData[recPointer].displayGesture.rawData = recData[recPointer].gestures[cur].rawData;

            Viz.drawContainer(recPointer);
            Viz.drawVideo(recPointer, vid);
            Viz.drawMainGraph(recPointer);
            Viz.drawGestureSample(recPointer, 0);
        }
        else {
            // update the displayGesture using the DBA algorithm

            // Viz.drawMainGraph(recPointer);
            Viz.drawGestureSample(recPointer, 0);
        }
    };
}


export function parseString(strBuf: string): any {
    // populate members of newData (type: SensorData) with the values received from the device
    let strBufArray = strBuf.split(" ");
    let result = {acc: false, accVec: new Vector(0, 0, 0),
                  /*mag: false, magVec: new Vector(0, 0, 0)*/};

    for (let i = 0; i < strBufArray.length; i++) {
        if (strBufArray[i] == "A") {
            result.accVec = new Vector(parseInt(strBufArray[i + 1]), parseInt(strBufArray[i + 2]), parseInt(strBufArray[i + 3]));
            result.acc = true;

            i += 3;
        }
        // else if (strBufArray[i] == "M") {
            // result.magVec = new Vector(parseInt(strBufArray[i + 1]), parseInt(strBufArray[i + 2]), parseInt(strBufArray[i + 3]));
            // result.mag = true;

            // i += 3;
        // }
    }

    return result;
}
