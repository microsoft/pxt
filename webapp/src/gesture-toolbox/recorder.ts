import { Vector, GestureSample, Gesture } from './types';
import * as Viz from './visualizations';
import * as Webcam from "./webcam";
import * as Model from "./model";
import * as GestureUI from "./gesture";
const MediaStreamRecorder = require("msr");

let nav = navigator as any;
let mediaStream: any;
let mediaRecorder: any;

export enum RecordMode {
    PressAndHold,
    PressToToggle
}

export class Recorder {
    private gestureIndex: number;
    private recordMode: RecordMode;
    private onRecordHandler: (gestureIndex: number, sample: GestureSample) => void;
    private enabled: boolean;
    private isRecording: boolean;
    private wasRecording: boolean;
    private sample: GestureSample;
    private recordBtn: any;

    constructor(gestureIndex: number, recordMode: RecordMode, onNewSampleRecorded: (gestureIndex: number, sample: GestureSample) => void) {
        this.gestureIndex = gestureIndex;
        this.recordMode = recordMode;
        this.onRecordHandler = onNewSampleRecorded;

        this.SetRecordingMethod(recordMode);

        this.enabled = true;
        this.wasRecording = false;
        this.isRecording = false;
    }

    public initWebcam(videoID: string) {
        nav.getUserMedia  = nav.getUserMedia || nav.webkitGetUserMedia ||
                            nav.mozGetUserMedia || nav.msGetUserMedia;

        if (nav.getUserMedia) {
            nav.getUserMedia({audio: false, video: true},
                (stream: any) => {
                    let video = document.getElementById(videoID) as any;
                    video.src = window.URL.createObjectURL(stream);
                    mediaStream = stream;

                    mediaRecorder = new MediaStreamRecorder(stream);
                    mediaRecorder.mimeType = 'video/mp4';
                }, () => {
                    console.error('unable to initialize webcam');
                });
        }
    }

    public initRecordButton(btnID: string) {
        this.recordBtn = Viz.d3.select("#" + btnID);
    }

    public Feed(yt: Vector) {
        if (this.enabled) {
            if (this.wasRecording == false && this.isRecording == true) {
                // start recording
                this.sample = new GestureSample();
                this.sample.startTime = Date.now();
                this.sample.rawData.push(yt);
                // start recording the video:
                mediaRecorder.start(15 * 1000);

                this.recordBtn.classed("green", true);
            }
            else if (this.wasRecording == true && this.isRecording == true) {
                // continue recording
                this.sample.rawData.push(yt);
            }
            else if (this.wasRecording == true && this.isRecording == false) {
                // stop recording
                this.sample.endTime = Date.now();
                this.sample.cropStartIndex = 0;
                this.sample.cropEndIndex = this.sample.rawData.length - 1;

                // stop recording the video
                mediaRecorder.stop();

                mediaRecorder.ondataavailable = (blob: any) => {
                    let vid = window.URL.createObjectURL(blob);
                    this.sample.video = vid;
                    this.onRecordHandler(this.gestureIndex, this.sample);
                };

                this.recordBtn.classed("green", false);
            }

            this.wasRecording = this.isRecording;
         }
    }

    public Disable() {
        this.enabled = false;
    }

    public SetRecordingMethod(recordMode: RecordMode) {
        this.recordMode = recordMode;
        
        if (recordMode == RecordMode.PressAndHold) {
            // assign events to capture if recording or not
            window.onkeydown = (e: any) => {
                // if pressed "space" key
                if (e.keyCode == 32)
                    this.isRecording = true;
            };

            window.onkeyup = (e: any) => {
                // if released "space" key
                if (e.keyCode == 32)
                    this.isRecording = false;
            };
        }
        else if (recordMode == RecordMode.PressToToggle) {
            // assign events to capture if recording or not
            window.onkeydown = (e: any) => {
                // if pressed "space" key
                if (e.keyCode == 32 && this.isRecording == false)
                    this.isRecording = true;
                else if (e.keyCode == 32 && this.isRecording == true)
                    this.isRecording = false;
            };

            window.onkeyup = null;
        }
    }

}


// export function startRecording(newData: Vector, gestIndex: number, gestName: string) {
//     let newSample = new GestureSample();
//     newSample.startTime = Date.now();
//     newSample.rawData.push(newData.clone());

//     if (gestIndex >= recData.length) {
//         let newGesture = new Gesture();
//         newGesture.label = gestIndex + 1;
//         newGesture.name = gestName;

//         recData.push(newGesture);
//     }

//     recData[gestIndex].gestures.push(newSample);
//     recPointer = gestIndex;

//     Webcam.mediaRecorder.start(15 * 1000);
// }


// export function continueRecording(newData: Vector) {
//     let cur = recData[recPointer].gestures.length - 1;
//     recData[recPointer].gestures[cur].rawData.push(newData.clone());
// }


// export function stopRecording() {
//     let cur = recData[recPointer].gestures.length - 1;
//     recData[recPointer].gestures[cur].endTime = Date.now();

//     Webcam.mediaRecorder.stop();


    // Webcam.mediaRecorder.ondataavailable = function (blob: any) {
    //     let vid = window.URL.createObjectURL(blob);
    //     recData[recPointer].gestures[cur].video = vid;

    //     if (cur == 0) {
    //         // create the whole container
    //         recData[recPointer].displayGesture.rawData = recData[recPointer].gestures[cur].rawData;
    //         recData[recPointer].displayGesture.video = recData[recPointer].gestures[cur].video;

    //         Viz.drawContainer(recPointer);
    //         Viz.drawVideo(recPointer, vid);
    //         Viz.drawGestureSample(recPointer, 0);
    //     }
    //     else {
    //         Viz.drawGestureSample(recPointer, cur);
    //     }

    //     Model.core.Update(recData[recPointer].getData());
    //     recData[recPointer].displayGesture.rawData = Model.core.refPrototype;
    //     Viz.drawMainGraph(recPointer);
    //     storeGestures();
    // };
// }


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

// export function Reload() {
//     for (let i = 0; i < recData.length; i++) {
//         for (let j = 0; j < recData[i].gestures.length; j++) {
//             if (j == 0) {
//                 Viz.drawContainer(i);
//                 Viz.drawVideo(i, recData[i].displayGesture.video);
//                 Viz.drawMainGraph(i);
//                 Viz.drawGestureSample(i, 0);
//             }
//             else {
//                 Viz.drawGestureSample(i, j);
//             }
//         }
//     }
// }


// function storeGestures() {
//     GestureUI.getParent().updateFileAsyncWithoutReload("gestures.json", JSON.stringify(recData));
// }


// function loadGestures() {

// }