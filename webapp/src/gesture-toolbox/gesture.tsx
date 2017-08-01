/// <reference path="../../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./../data";
import * as sui from "./../sui";
import * as pkg from "./../package";
import * as blocks from "./../blocks"
import * as hidbridge from "./../hidbridge";
import * as codecard from "./../codecard"
import Cloud = pxt.Cloud;

import { dataObj } from "./testData";
import * as Recorder from "./recorder";
import * as Types from "./types";
import * as Webcam from "./webcam";
import * as Viz from "./visualizations";
import * as Model from "./model";
import * as Indicator from "./indicator";
import { GraphCard } from "./graphcard";
import { streamerCode } from "./streamer";

type ISettingsProps = pxt.editor.ISettingsProps;
type IAppProps = pxt.editor.IAppProps;
type IAppState = pxt.editor.IAppState;
type IProjectView = pxt.editor.IProjectView;

export const gesturesContainerID: string = "gestures-container";
export const connectionIndicatorID: string = "connection-indicator";

interface GestureToolboxState {
    visible?: boolean;
    singleGestureView?: boolean;
    data?: Types.Gesture[];
    connected?: boolean;
}

export function getParent(): IProjectView {
    return p;
}


let p: IProjectView;

export class GestureToolbox extends data.Component<ISettingsProps, GestureToolboxState> {
    private graphX: Viz.RealTimeGraph;
    private graphY: Viz.RealTimeGraph;
    private graphZ: Viz.RealTimeGraph;

    lastConnectedTime: number;

    constructor(props: ISettingsProps) {
        super(props);

        // TODO:  
        // Load data (accelerometer gesture data + video + ...) from cloud

        this.state = {
            visible: false,
            singleGestureView: false,
            data: dataObj,
            connected: false
        };

        this.lastConnectedTime = 0;

        Recorder.initKeyboard();
        p = this.props.parent;
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

        if (hidbridge.shouldUse()) {
            hidbridge.initAsync()
            .then(dev => {
                dev.onSerial = (buf, isErr) => {
                    let strBuf: string = Util.fromUTF8(Util.uint8ArrayToString(buf));
                    let newData = Recorder.parseString(strBuf);

                    if (newData.acc) {
                        this.graphX.update(newData.accVec.X, Viz.smoothedLine);
                        this.graphY.update(newData.accVec.Y, Viz.smoothedLine);
                        this.graphZ.update(newData.accVec.Z, Viz.smoothedLine);

                        this.lastConnectedTime = Date.now();
                    }

                    if (Model.core.running) {
                        Viz.d3.select("#prediction-span")
                            .html(Model.core.Feed(newData.accVec).classNum);
                    }

                    if (wasRecording == false && Recorder.isRecording == true) {
                        Recorder.startRecording(newData.accVec, 0, "TestGesture");
                    }
                    else if (wasRecording == true && Recorder.isRecording == true) {
                        Recorder.continueRecording(newData.accVec);
                    }
                    else if (wasRecording == true && Recorder.isRecording == false) {
                        Recorder.stopRecording();
                    }

                    wasRecording = Recorder.isRecording;
                }
            });
        }

        // Viz.d3.select("#program-streamer-btn").on("click", () => {

        // });

        Viz.d3.select("#generate-block").on("click", () => {
            this.props.parent.updateFileAsync("custom.ts", Model.core.GenerateBlock());
        });
    }


    shouldComponentUpdate(nextProps: ISettingsProps, nextState: GestureToolboxState, nextContext: any): boolean {
        return this.state.visible != nextState.visible || this.state.connected != nextState.connected;
    }


    renderCore() {
        const { visible } = this.state;

        const newGesture = () => {
        }

        const importGesture = () => {
        }

        const onSampleDelete = (gid: number, sid: number) => {
            console.log("sample [" + gid + ", " + sid + "] has been deleted");
            // should change the state of this ui -> with less items
        }

        let gestureID = this.state.data[0].gestureID;
        let samples = this.state.data[0].gestures;

        return (
            <sui.Modal open={this.state.visible} className="gesture_toolbox" header={lf("Gesture Toolkit") } size="fullscreen"
                onClose={() => this.hide() } dimmer={true}
                closeIcon={true}
                closeOnDimmerClick
                >

                {/* <div className="ui cards">
                    <codecard.CodeCardView
                                key={'newpgesture'}
                                icon="wizard outline"
                                iconColor="primary"
                                name={lf("New Gesture...") }
                                description={lf("Creates a new empty gesture") }
                                onClick={() => newGesture() }
                                />
                    <codecard.CodeCardView
                                key={'importgesture'}
                                icon="upload outline"
                                iconColor="secondary"
                                name={lf("Import Gesture...") }
                                description={lf("Imports gesture from your computer") }
                                onClick={() => importGesture() }
                                />
                </div> */}
{/* gestureID?: number, sampleID?: number, dx?: number, graphHeight?: number, maxVal?: number } */}
                <Indicator.ConnectionIndicator parent={ this }/>

                <div>
                    {samples.map(sample =>
                        <GraphCard
                            parent = { this }
                            gestureID = { gestureID }
                            sampleID = { sample.sampleID }
                            dx = { 7 }
                            graphHeight = { 75 }
                            maxVal = { 2048 }
                            onDeleteHandler = { onSampleDelete }
                        />
                    )}
                </div>


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
                        <button id="program-streamer-btn" className="ui button icon-and-text primary fluid download-button big">
                            <i className="download icon icon-and-text"></i>
                            <span className="ui text">Program Streamer</span>
                        </button>
                        <br/>
                        <button id="generate-block" className="ui button blocks-menuitem green big">
                            <i className="xicon blocks icon icon-and-text"></i>
                            <span className="ui text">Create Block</span>
                        </button>
                    </div>
                </div>
                <span className="ui text big" id="prediction-span"></span>
                <div id={gesturesContainerID}>
                </div>
            </sui.Modal>
        )
    }
}
