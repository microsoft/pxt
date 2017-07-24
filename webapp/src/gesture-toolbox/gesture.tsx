/// <reference path="../../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./../data";
import * as sui from "./../sui";
import * as pkg from "./../package";
import * as blocks from "./../blocks"
import * as hidbridge from "./../hidbridge";
import Cloud = pxt.Cloud;

import * as Recorder from "./recorder";
import * as Types from "./types";
import * as Webcam from "./webcam";
import * as Viz from "./visualizations"

type ISettingsProps = pxt.editor.ISettingsProps;
type IAppProps = pxt.editor.IAppProps;
type IAppState = pxt.editor.IAppState;
type IProjectView = pxt.editor.IProjectView;

export let gesturesContainerID: string = "gestures-container";


export interface GestureToolboxState {
    visible?: boolean;
}


export class GestureToolbox extends data.Component<ISettingsProps, GestureToolboxState> {
    private graphX: Viz.RealTimeGraph;
    private graphY: Viz.RealTimeGraph;
    private graphZ: Viz.RealTimeGraph;

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false
        }

        Recorder.initKeyboard();
    }


    hide() {
        this.setState({ visible: false });
        Webcam.mediaStream.stop();
    }


    show() {
        this.setState({ visible: true });
        let wasRecording = false;

        Webcam.init("webcam-video");

        this.graphX = new Viz.RealTimeGraph("realtime-graph-x", "red");
        this.graphY = new Viz.RealTimeGraph("realtime-graph-y", "green");
        this.graphZ = new Viz.RealTimeGraph("realtime-graph-z", "blue");

        setInterval(() => {
            let testData = new Types.Vector(Math.random() * 2048, Math.random() * 2048, Math.random() * 2048);
            this.graphX.update(testData.X, Viz.smoothedLine);
            this.graphY.update(testData.Y, Viz.smoothedLine);
            this.graphZ.update(testData.Z, Viz.smoothedLine);

            if (wasRecording == false && Recorder.isRecording == true) {
                Recorder.startRecording(testData, 0, "TestGesture");
            }
            else if (wasRecording == true && Recorder.isRecording == true) {
                Recorder.continueRecording(testData);
            }
            else if (wasRecording == true && Recorder.isRecording == false) {
                Recorder.stopRecording();
            }
            
            wasRecording = Recorder.isRecording;
        }, 40);

        // if (hidbridge.shouldUse()) {
        //     hidbridge.initAsync()
        //     .then(dev => {
        //         dev.onSerial = (buf, isErr) => {
        //             let strBuf: string = Util.fromUTF8(Util.uint8ArrayToString(buf));
        //             let newData = Recorder.parseString(strBuf);

        //             if (newData.acc) {
        //                 this.graphX.update(newData.accVec.X, Viz.smoothedLine);
        //                 this.graphY.update(newData.accVec.Y, Viz.smoothedLine);
        //                 this.graphZ.update(newData.accVec.Z, Viz.smoothedLine);
        //             }
        //         }
        //     });
        // }
    }


    shouldComponentUpdate(nextProps: ISettingsProps, nextState: GestureToolboxState, nextContext: any): boolean {
        return this.state.visible != nextState.visible;
    }


    renderCore() {
        const { visible } = this.state;

        return (
            <sui.Modal open={this.state.visible} className="gesture_toolbox" header={lf("Gesture Toolkit") } size="fullscreen"
                onClose={() => this.hide() } dimmer={true}
                closeIcon={true}
                closeOnDimmerClick
                >
                <div className="ui three column grid">
                    <div className="four wide column">
                        <video id="webcam-video"></video>
                    </div>
                    <div className="nine wide column">
                        <div className="row graph-x" id="realtime-graph-x"></div>
                        <div className="row graph-y" id="realtime-graph-y"></div>
                        <div className="row graph-z" id="realtime-graph-z"></div>
                    </div>
                    <div className="three wide column">
                        <button className="ui button icon-and-text primary fluid download-button big">
                            <i className="download icon icon-and-text"></i>
                            <span className="ui text">Program Streamer</span>
                        </button>
                        <br/>
                        <button className="ui button blocks-menuitem green big">
                            <i className="xicon blocks icon icon-and-text"></i>
                            <span className="ui text">Create Block</span>
                        </button>
                    </div>
                </div>
                <br/>
                <div id={gesturesContainerID}>
                    {/* How each new gesture set will look like: */}
                    {/*
                    <div className="gesture-container">
                        <span>Gesture Name: </span>
                        <span contentEditable className="gesture-name ui text big">New Gesture</span>
                        <br/>
                        <video className="rec-video"></video>

                        <div className="main-graph">
                            <div className="ui row graph-x"> X </div>
                            <div className="ui row graph-y"> Y </div>
                            <div className="ui row graph-z"> Z </div>
                        </div>

                        <div className="vertical-sep"></div>

                        <div className="samples-container">
                            <div className="sample-graph">
                                <div className="ui row graph-x"> X </div>
                                <div className="ui row graph-y"> Y </div>
                                <div className="ui row graph-z"> Z </div>
                            </div>
                        </div>
                    </div>
                    */}
                </div>
            </sui.Modal>
        )
    }
}