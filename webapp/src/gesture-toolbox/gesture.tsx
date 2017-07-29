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

import * as Recorder from "./recorder";
import * as Types from "./types";
import * as Webcam from "./webcam";
import * as Viz from "./visualizations";
import * as Model from "./model";
import { streamerCode } from "./streamer";

type ISettingsProps = pxt.editor.ISettingsProps;
type IAppProps = pxt.editor.IAppProps;
type IAppState = pxt.editor.IAppState;
type IProjectView = pxt.editor.IProjectView;

export const gesturesContainerID: string = "gestures-container";
export const connectionIndicatorID: string = "connection-indicator";

export interface GestureToolboxState {
    visible?: boolean;
}


export class GestureToolbox extends data.Component<ISettingsProps, GestureToolboxState> {
    private graphX: Viz.RealTimeGraph;
    private graphY: Viz.RealTimeGraph;
    private graphZ: Viz.RealTimeGraph;
    
    private lastConnectedTime: number;
    private isConnected: boolean;

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false
        }

        this.lastConnectedTime = 0;
        this.isConnected = false;

        Recorder.initKeyboard();
    }


    hide() {
        this.setState({ visible: false });
        Webcam.mediaStream.stop();
    }


    show() {
        this.setState({ visible: true });
        let wasRecording = false;
        
        setInterval(() => {
            if (Date.now() - this.lastConnectedTime > 1000) {
                Viz.setDisconnected();
                this.isConnected = false;

                if (hidbridge.shouldUse())
                    hidbridge.initAsync();
            }
            else {
                if (!this.isConnected) {
                    this.isConnected = true;
                    Viz.setConnected();
                }
            }
        }, 1000);

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

                        if (!this.isConnected) {
                            Viz.setConnected();
                            this.isConnected = true;
                        }
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
            let blockCode = Model.core.GenerateBlock();
            this.props.parent.updateFileAsync("custom.ts", blockCode);
        });
    }


    shouldComponentUpdate(nextProps: ISettingsProps, nextState: GestureToolboxState, nextContext: any): boolean {
        return this.state.visible != nextState.visible;
    }


    renderCore() {
        const { visible } = this.state;

        const newGesture = () => {
        }

        const importGesture = () => {
        }

        return (
            <sui.Modal open={this.state.visible} className="gesture_toolbox" header={lf("Gesture Toolkit") } size="fullscreen"
                onClose={() => this.hide() } dimmer={true}
                closeIcon={true}
                closeOnDimmerClick
                >
                <div id={connectionIndicatorID} className="ui label">
                    <i className="remove icon"></i>
                    <span></span>
                </div>

                <div className="ui cards">
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
                </div>

                <div className="ui segment">
                    
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