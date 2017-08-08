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

const MediaStreamRecorder = require("msr");
let nav = navigator as any;
let mediaStream: any;
let mediaRecorder: any;

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

    private graphInitialized: boolean;
    private webcamInitialized: boolean;

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

        this.graphInitialized = false;
        this.webcamInitialized = false;
    }

    componentDidUpdate() {

        // if (this.state.editGestureMode) {
        //     let wasRecording = false;

        //     Webcam.init("webcam-video");

        //     this.graphX = new Viz.RealTimeGraph("realtime-graph-x", "red");
        //     this.graphY = new Viz.RealTimeGraph("realtime-graph-y", "green");
        //     this.graphZ = new Viz.RealTimeGraph("realtime-graph-z", "blue");

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

            //                 this.lastConnectedTime = Date.now();
            //             }

            //             if (Model.core.running) {
            //                 Viz.d3.select("#prediction-span")
            //                     .html(Model.core.Feed(newData.accVec).classNum);
            //             }

            //             if (wasRecording == false && Recorder.isRecording == true) {
            //                 // Recorder.startRecording(newData.accVec, 0, "TestGesture");
            //             }
            //             else if (wasRecording == true && Recorder.isRecording == true) {
            //                 // Recorder.continueRecording(newData.accVec);
            //             }
            //             else if (wasRecording == true && Recorder.isRecording == false) {
            //                 // Recorder.stopRecording();
            //             }

            //             wasRecording = Recorder.isRecording;
            //         }
            //     });
            // }

        //     // Viz.d3.select("#program-streamer-btn").on("click", () => {

        //     // });

        //     Viz.d3.select("#generate-block").on("click", () => {
        //         this.props.parent.updateFileAsync("custom.ts", Model.core.GenerateBlock());
        //     });
        // }
    }


    hide() {
        this.setState({ visible: false, editGestureMode: false });
        this.graphInitialized = false;
        this.webcamInitialized = false;

        mediaStream.stop();
    }


    show() {
        this.setState({ visible: true });

        if (hidbridge.shouldUse()) {
            hidbridge.initAsync()
            .then(dev => {
                dev.onSerial = (buf, isErr) => {
                    let strBuf: string = Util.fromUTF8(Util.uint8ArrayToString(buf));
                    let newData = Recorder.parseString(strBuf);

                    this.lastConnectedTime = Date.now();

                    if (this.state.editGestureMode && this.state.connected) {
                        if (newData.acc && this.graphZ.isInitialized()) {
                            this.graphX.update(newData.accVec.X);
                            this.graphY.update(newData.accVec.Y);
                            this.graphZ.update(newData.accVec.Z);
                        }
                    }
                }
            });
        }
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
        const targetTheme = pxt.appTarget.appTheme;

        const backToMain = () => {
            this.setState({ editGestureMode: false });
            this.graphInitialized = false;
            this.webcamInitialized = false;

            mediaStream.stop();
        }

        const newGesture = () => {
            this.setState({ editGestureMode: true });
            this.graphInitialized = false;
            this.webcamInitialized = false;
            // TODO: merge into a reset function
        }

        const importGesture = () => {
        }

        const onConnectionStatusChange = (connectionStatus: boolean) => {
            if (this.state.connected != connectionStatus)
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

        const initGraph = (elem: any) => {
            if (elem != null && !this.graphInitialized) {
                // initialize SVG
                let graph = Viz.d3.select(elem);

                let svgX_rt = graph.select("#realtime-graph-x");
                let svgY_rt = graph.select("#realtime-graph-y");
                let svgZ_rt = graph.select("#realtime-graph-z");

                let width = graph.node().offsetWidth - 2 * 16;
                let height = 75;
                let maxVal = 2450;
                let dx = 7;

                this.graphX = new Viz.RealTimeGraph(svgX_rt, width, height, maxVal, dx, "red");
                this.graphY = new Viz.RealTimeGraph(svgY_rt, width, height, maxVal, dx, "green");
                this.graphZ = new Viz.RealTimeGraph(svgZ_rt, width, height, maxVal, dx, "blue");

                this.graphInitialized = true;
            }
        }

        const initWebCam = (video: any) => {
            if (video != null && !this.webcamInitialized) {
                nav.getUserMedia  = nav.getUserMedia || nav.webkitGetUserMedia ||
                            nav.mozGetUserMedia || nav.msGetUserMedia;

                if (nav.getUserMedia) {
                    nav.getUserMedia({audio: false, video: true},
                        (stream: any) => {
                            video.autoplay = true;
                            video.src = window.URL.createObjectURL(stream);
                            mediaStream = stream;

                            mediaRecorder = new MediaStreamRecorder(stream);
                            mediaRecorder.mimeType = 'video/mp4';
                        }, () => {
                            console.error('unable to initialize webcam');
                        });
                }

                this.webcamInitialized = true;
            }
        }

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
                                <video id="webcam-video" ref={initWebCam}></video>
                            </div>
                            <div className="nine wide column" ref={initGraph}>
                                <svg className="row" id="realtime-graph-x"></svg>
                                <svg className="row" id="realtime-graph-y"></svg>
                                <svg className="row" id="realtime-graph-z"></svg>
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