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
    editGestureMode?: boolean;
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

        for (let i = 0; i < dataObj.length; i++)
            dataObj[i].gestures.forEach(sample => { sample.cropEndIndex = sample.rawData.length - 1; sample.cropStartIndex = 0;})

        this.state = {
            visible: false,
            editGestureMode: false,
            data: dataObj,
            connected: false
        };

        this.lastConnectedTime = 0;

        Recorder.initKeyboard();
        p = this.props.parent;
    }

    componentDidUpdate() {
        if (this.state.editGestureMode) {
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
                            // Recorder.startRecording(newData.accVec, 0, "TestGesture");
                        }
                        else if (wasRecording == true && Recorder.isRecording == true) {
                            // Recorder.continueRecording(newData.accVec);
                        }
                        else if (wasRecording == true && Recorder.isRecording == false) {
                            // Recorder.stopRecording();
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
    }


    hide() {
        this.setState({ visible: false, editGestureMode: false });

        Webcam.mediaStream.stop();
    }


    show() {
        this.setState({ visible: true });
    }


    getGestureIndex(gid: number): number {
        for (let i = 0; i < this.state.data.length; i++) {
            if (this.state.data[i].gestureID == gid) return i;
        }

        return -1;
    }

    getSampleIndex(gid: number, sid: number): number {
        for (let i = 0; i < this.state.data[gid].gestures.length; i++) {
            if (this.state.data[gid].gestures[i].sampleID == sid) return i;
        }

        return -1;
    }

    renderCore() {
        
        const { visible } = this.state;

        const backToMain = () => {
            this.setState({ editGestureMode: false });
        }

        const newGesture = () => {
            this.setState({ editGestureMode: true });
        }

        const importGesture = () => {
        }

        const onConnectionStatusChange = (connectionStatus: boolean) => {
            this.setState({ connected: connectionStatus });
        }

        const onSampleDelete = (gid: number, sid: number) => {
            console.log("sample [" + gid + ", " + sid + "] has been deleted");
            // should change the state of this ui -> with less items
            let gi = this.getGestureIndex(gid);
            let si = this.getSampleIndex(gi, sid);

            let cloneData = this.state.data.slice();

            cloneData[gi].gestures.splice(si, 1);

            this.setState({ data: cloneData });
        }

        const onSampleCrop = (gid: number, sid: number, newStart: number, newEnd: number) => {
            console.log("sample [" + gid + ", " + sid + "] has been updated");
            let gi = this.getGestureIndex(gid);
            let si = this.getSampleIndex(gi, sid);

            let cloneArray = this.state.data.slice();

            cloneArray[gi].gestures[si].cropStartIndex = newStart;
            cloneArray[gi].gestures[si].cropEndIndex = newEnd;

            this.setState({ data: cloneArray });
        }

        const targetTheme = pxt.appTarget.appTheme;

        return (
            <sui.Modal open={this.state.visible} className="gesturedialog" size="fullscreen"
                onClose={() => this.hide() } dimmer={true} closeIcon={false} closeOnDimmerClick>
                <sui.Segment attached="top">
                    {this.state.editGestureMode
                        ?
                        <button className="ui button icon huge clear left floated" onClick={() => backToMain() }>
                            <i className="icon chevron left"></i>
                        </button>
                        :
                        <span className="ui header left floated">{lf("Gesture Toolbox")}</span>
                    }
                    <Indicator.ConnectionIndicator 
                        parent={ this }
                        onConnStatChangeHandler={ onConnectionStatusChange }
                        class={ "right floated" }
                    />  
                    {/* <button className="ui button icon huge clear" onClick={() => this.hide() }>
                        <i className="icon close"></i>
                    </button> */}
                </sui.Segment>
                <div className="ui segment bottom attached tab active tabsegment">
                {
                    this.state.editGestureMode == false ? 
                    <div className="ui">
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
                        <div className="ui segments">
                            <div className="ui segment">
                                <h1>Gesture1</h1>
                            </div>
                            <div className="ui segment">
                                <h1>Gesture2</h1>
                            </div>
                        </div>
                    </div>
                    :
                    <div>
                        <div className="ui segment three column grid">
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

                        <div className="ui segments">
                            {
                                this.state.data.map((gesture) => 
                                    <div className="ui segment">
                                    {
                                        gesture.gestures.map((sample) =>
                                            <GraphCard
                                                key={ sample.sampleID }
                                                parent={ this }
                                                gestureID={ gesture.gestureID }
                                                sampleID={ sample.sampleID }
                                                dx={ 7 }
                                                graphHeight={ 70 }
                                                maxVal={ 2450 }
                                                onDeleteHandler={ onSampleDelete }
                                                onCropHandler={ onSampleCrop }
                                            />
                                        )
                                    }
                                    </div>)
                            }
                        </div>
                    </div>
                }
                </div>
            </sui.Modal>
        )
    }
}


// <div>
//                 <div ref="graphContainer">
//                     <svg ref="svgX"></svg>
//                     <svg ref="svgY"></svg>
//                     <svg ref="svgZ"></svg>
//                 </div>
//                 <div className="ui basic buttons">
//                     <div className="ui button">Hold Recording</div>
//                     <div className="ui button">Toggle Recording</div>
//                 </div>
//             </div>