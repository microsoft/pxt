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

    private graphInitialized: boolean;
    private webcamInitialized: boolean;
    private recorderInitialized: boolean;

    private recorder: Recorder.Recorder;
    private curGestureIndex: number;

    private models: Model.SingleDTWCore[];
    private newName: string;

    lastConnectedTime: number;

    constructor(props: ISettingsProps) {
        super(props);

        // TODO: change this to load from outside
        let data: Types.Gesture[] = [];

        this.state = {
            visible: false,
            editGestureMode: false,
            data: data,
            connected: false
        };

        this.lastConnectedTime = 0;
        this.models = [];

        p = this.props.parent;

        this.graphInitialized = false;
        this.webcamInitialized = false;
        this.recorderInitialized = false;
    }


    resetGraph() {
        this.graphInitialized = false;
        this.webcamInitialized = false;
        this.recorderInitialized = false;
        // this.recorder.Disable();

        // mediaStream.stop();
    }


    hide() {
        this.setState({ visible: false, editGestureMode: false });
        this.resetGraph();
    }


    show() {
        this.setState({ visible: true });

        const onSerialData = (buf: any, isErr: any) => {
            let strBuf: string = Util.fromUTF8(Util.uint8ArrayToString(buf));
            let newData = Recorder.parseString(strBuf);

            this.lastConnectedTime = Date.now();

            if (this.state.editGestureMode && this.state.connected) {
                if (newData.acc && this.graphZ.isInitialized()) {
                    this.graphX.update(newData.accVec.X);
                    this.graphY.update(newData.accVec.Y);
                    this.graphZ.update(newData.accVec.Z);

                    this.recorder.Feed(newData.accVec);

                    if (this.models[this.curGestureIndex].isRunning()) {
                        let match = this.models[this.curGestureIndex].Feed(newData.accVec);
                        if (match.classNum != 0) {
                            console.log("RECOGNIZED GESTURE");
                            // TODO: add moving window that will show it has recognized something...
                            // in particular, it will be a rectangle on top of the graph with these dimensions (at each data tick):

                            let distFromRightEnd = this.models[this.curGestureIndex].getTick() - match.Te;
                            let width = match.Te - match.Ts;

                            // one way to implement this would be to create a RecognitionRectangle with a run() function
                            // push them into an array (because we might have more than one that needs to be shown at each tick)
                            // and then call the run() function on each element inside the array on each tick()
                            // though I'm sure that there would definitely be nicer ways to visualize this...
                        }
                    }
                }
            }
        };

        if (hidbridge.shouldUse()) {
            hidbridge.initAsync()
            .then(dev => {
                dev.onSerial = onSerialData;
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
            this.resetGraph();

            if (this.state.data[this.curGestureIndex].gestures.length == 0) {
                // delete the gesture
                let cloneData = this.state.data.slice();
                cloneData.splice(this.curGestureIndex, 1);
                this.setState({ data: cloneData });
            }
        }

        const newGesture = () => {
            this.setState({ editGestureMode: true });
            this.resetGraph();
            this.state.data.push(new Types.Gesture());
            // TODO: change this method of keeping the current gesture index to something more reliable
            this.curGestureIndex = this.state.data.length - 1;
            this.models.push(new Model.SingleDTWCore(this.state.data[this.curGestureIndex].gestureID + 1));
        }

        const editGesture = (gestureID: number) => {
            this.setState({ editGestureMode: true });
            this.resetGraph();

            this.curGestureIndex = this.getGestureIndex(gestureID);
        }

        const downloadGesture = (gestureID: number) => {
            this.setState({ editGestureMode: true });

            // TODO: download this gesture as a .JSON file
        }

        const createGestureBlock = (gestureID: number) => {
            this.setState({ editGestureMode: true });

            // TODO: create "singular" gesture block for the current gesture
        }

        const importGesture = () => {
        }

        const onConnectionStatusChange = (connectionStatus: boolean) => {
            if (this.state.connected != connectionStatus)
                this.setState({ connected: connectionStatus });
        }

        const onSampleDelete = (gid: number, sid: number) => {
            let gi = this.getGestureIndex(gid);
            let si = this.getSampleIndex(gi, sid);

            let cloneData = this.state.data.slice();

            cloneData[gi].gestures.splice(si, 1);

            this.setState({ data: cloneData });
        }

        const onSampleCrop = (gid: number, sid: number, newStart: number, newEnd: number) => {
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

        const initRecorder = (elem: any) => {
            // TODO: change recording type based on selected recording method:
            if (elem != null && !this.recorderInitialized) {
                const gestureState = this;
                const onNewSampleRecorded = (gestureIndex: number, newSample: Types.GestureSample) => {
                    // do stuff with `setState()` to update the graph

                    let cloneData = gestureState.state.data.slice();
                    // do not change the order of the following lines:
                    cloneData[gestureIndex].gestures.push(newSample);
                    this.models[this.curGestureIndex].Update(cloneData[gestureIndex].getCroppedData());
                    cloneData[gestureIndex].displayGesture = this.models[this.curGestureIndex].GetMainPrototype();
                    // TODO: allow users to change the video in the future.
                    // Probably just for the demo:
                    cloneData[gestureIndex].displayVideo = cloneData[gestureIndex].gestures[0].video;
                    this.setState({ data: cloneData });
                }

                this.recorder = new Recorder.Recorder(this.curGestureIndex, Recorder.RecordMode.PressAndHold, onNewSampleRecorded);
                this.recorder.initWebcam("webcam-video");
                this.recorderInitialized = true;
            }
        }

        const handleRenameChange = (event: any) => {
            this.newName = event.target.value;
        }

        const renameGesture = (gid: number) => {
            let gi = this.getGestureIndex(gid);

            let cloneData = this.state.data.slice();
            cloneData[gi].name = this.newName;

            this.setState({ data: cloneData });
        }

        const headerStyle = { height: "60px" };
        const videoStyle = { height: "258px", margin: "15px 0 15px 0" };
        const mainGraphStyle = { margin: "15px 15px 15px 0" };
        const containerStyle = { display: "inline-block", position: "relative", top: "1px", margin: "0 20px 15px 0" };

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
                        <div className="ui divider"></div>
                        {
                            this.state.data.length == 0 ? undefined :
                            <div>
                                {
                                    this.state.data.map((gesture) =>
                                        <div style={containerStyle} className="ui segments link" onClick={() => {editGesture(gesture.gestureID)}}>
                                            <div className="ui segment inverted teal" style={headerStyle}>
                                                <div className="ui label">
                                                    {gesture.name}
                                                </div>
                                                <button className="ui icon button blue inverted compact tiny right floated" onClick={() => {downloadGesture(gesture.gestureID)}}>
                                                    <i className="icon cloud download"></i>
                                                </button>
                                                <button className="ui icon button violet inverted compact tiny right floated" onClick={() => {createGestureBlock(gesture.gestureID)}}>
                                                    <i className="icon puzzle"></i>
                                                    &nbsp;Create Block
                                                </button>
                                            </div>
                                            <div className="ui segment">
                                                <div className="ui grid">
                                                    <video style={videoStyle} src={gesture.displayVideo} autoPlay loop></video>
                                                    <GraphCard
                                                        key={ gesture.gestureID }
                                                        editable={ false }
                                                        parent={ this }
                                                        data={ gesture.displayGesture }
                                                        dx={ 7 }
                                                        graphHeight={ 70 }
                                                        maxVal={ 2450 }
                                                        style={ mainGraphStyle }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }
                            </div>
                        }
                    </div>
                    :
                    <div>
                        <div className="ui segment three column grid">
                            <div className="four wide column">
                                {
                                    this.state.connected ?
                                    <video id="webcam-video"></video>
                                    :
                                    <div>Not Connected</div>
                                }
                            </div>
                            <div className="nine wide column">
                                {
                                    this.state.connected ?
                                    <div ref={initGraph}>
                                        <svg className="row" id="realtime-graph-x"></svg>
                                        <svg className="row" id="realtime-graph-y"></svg>
                                        <svg className="row" id="realtime-graph-z"></svg>
                                    </div>
                                    :
                                    <div>
                                        <p>1. Connect Device</p>
                                        <p>1. Upload Streamer Program</p>
                                    </div>
                                }
                            </div>
                            <div className="three wide column">
                                {
                                    this.state.connected ?
                                    <button id="record-btn" className="ui button blocks-menuitem green big" ref={initRecorder}>
                                        <i className="xicon blocks icon icon-and-text"></i>
                                        <span className="ui text">Record</span>
                                    </button>
                                    :
                                    <button id="program-streamer-btn" className="ui button icon-and-text primary fluid download-button big">
                                        <i className="download icon icon-and-text"></i>
                                        <span className="ui text">Program Streamer</span>
                                    </button>
                                }
                            </div>
                        </div>
                        <div style={containerStyle} className="ui segments">
                            <div className="ui segment inverted teal" style={headerStyle}>
                                <div className="ui action input mini">
                                    <input width="25" type="text" ref="gesture-name-input" placeholder={this.state.data[this.curGestureIndex].name} onChange={handleRenameChange}></input>
                                    <button onClick={() => renameGesture(this.state.data[this.curGestureIndex].gestureID)} className="ui right labeled icon button compact tiny">
                                        <i className="edit icon"></i>
                                        Rename
                                    </button>
                                </div>
                                <button className="ui icon button blue inverted compact tiny right floated" onClick={() => {downloadGesture(this.state.data[this.curGestureIndex].gestureID)}}>
                                    <i className="icon cloud download"></i>
                                </button>
                                <button className="ui icon button violet inverted compact tiny right floated" onClick={() => {createGestureBlock(this.state.data[this.curGestureIndex].gestureID)}}>
                                    <i className="icon puzzle"></i>
                                    &nbsp;Create Block
                                </button>
                            </div>
                            <div className="ui segment">
                                <div className="ui grid">
                                    {
                                        this.state.data[this.curGestureIndex].gestures.length == 0 ?
                                        <video style={videoStyle} src="" autoPlay loop></video>
                                        :
                                        <video style={videoStyle} src={this.state.data[this.curGestureIndex].displayVideo} autoPlay loop></video>
                                    }
                                    {
                                        this.state.data[this.curGestureIndex].gestures.length == 0 ?
                                        undefined
                                        :
                                        <GraphCard
                                            key={ this.state.data[this.curGestureIndex].gestureID }
                                            editable={ false }
                                            parent={ this }
                                            data={ this.state.data[this.curGestureIndex].displayGesture }
                                            dx={ 7 }
                                            graphHeight={ 70 }
                                            maxVal={ 2450 }
                                            style={ mainGraphStyle }
                                        />
                                    }
                                </div>
                            </div>
                        </div>
                        {
                            this.state.data[this.curGestureIndex].gestures.map((sample) =>
                                <GraphCard
                                    key={ sample.sampleID }
                                    editable={ true }
                                    parent={ this }
                                    gestureID={ this.state.data[this.curGestureIndex].gestureID }
                                    sampleID={ sample.sampleID }
                                    dx={ 7 }
                                    graphHeight={ 80 }
                                    maxVal={ 2450 }
                                    onDeleteHandler={ onSampleDelete }
                                    onCropHandler={ onSampleCrop }
                                />
                            )
                        }
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


// <div className="ui link card" onClick={() => {editGesture(gesture.gestureID)}}>
//                                                 <div className="ui grid">
//                                                     <div className="content column">
//                                                         <h2 className="meta">{gesture.name}</h2>
//                                                         <p className="meta">{gesture.description}</p>
//                                                     </div>
//                                                     <div className="column">
                                                        // <GraphCard
                                                        //     key={ gesture.gestureID }
                                                        //     editable={ false }
                                                        //     parent={ this }
                                                        //     data={ gesture.displayGesture }
                                                        //     dx={ 7 }
                                                        //     graphHeight={ 70 }
                                                        //     maxVal={ 2450 }
                                                        // />
//                                                     </div>
//                                                     <div className="content column">
//                                                         <span className="right floated">
//                                                             <i className="icon lightning outline"></i>
//                                                             {gesture.gestures.length + " "} Samples
//                                                         </span>
//                                                         <button className="ui button teal" onClick={() => {downloadGesture(gesture.gestureID)}}>
//                                                             <i className="icon cloud download icon-and-text"></i>
//                                                         </button>
//                                                         <button className="ui button violet" onClick={() => {createGestureBlock(gesture.gestureID)}}>
//                                                             <i className="icon puzzle icon-and-text"></i>
//                                                             <span className="ui text">Create Block</span>
//                                                         </button>
//                                                     </div>
//                                                 </div>
//                                             </div>
//                                              <div className="column">
//                                                 <h1>{"Gesture " + gesture.name}</h1>
//                                             </div>
//                                             <div className="column">
                            
//                                             </div>
//                                             <div className="column">
//                                                 <button className="ui button teal" >
//                                                     <i className="icon edit icon-and-text"></i>
//                                                     <span className="ui text">Edit Gesture</span>
//                                                 </button>
//                                                 <br/>
                                                // <button className="ui button teal" onClick={() => {downloadGesture(gesture.gestureID)}}>
                                                //     <i className="icon cloud download icon-and-text"></i>
                                                //     <span className="ui text">Download Gesture</span>
                                                // </button>
                                                // <br/>
                                                // <button className="ui button violet" onClick={() => {createGestureBlock(gesture.gestureID)}}>
                                                //     <i className="icon puzzle icon-and-text"></i>
                                                //     <span className="ui text">Create Block</span>
                                                // </button>
//                                             </div>
//                                         </div> 