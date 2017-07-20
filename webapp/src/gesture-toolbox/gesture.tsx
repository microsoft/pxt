/// <reference path="../../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./../data";
import * as sui from "./../sui";
import * as pkg from "./../package";
import * as blocks from "./../blocks"
import * as hidbridge from "./../hidbridge";
import Cloud = pxt.Cloud;

import * as Types from "./types";
import * as Webcam from "./webcam";
import * as Viz from "./visualizations"

type ISettingsProps = pxt.editor.ISettingsProps;
type IAppProps = pxt.editor.IAppProps;
type IAppState = pxt.editor.IAppState;
type IProjectView = pxt.editor.IProjectView;


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
    }


    hide() {
        this.setState({ visible: false });
        Webcam.mediaStream.stop();
    }


    show() {
        this.setState({ visible: true });

        Webcam.init("webcam-video");
        let maxval = 30;

        this.graphX = new Viz.RealTimeGraph("realtime-graph-x", "red", 5, maxval);
        this.graphY = new Viz.RealTimeGraph("realtime-graph-y", "green", 5, maxval);
        this.graphZ = new Viz.RealTimeGraph("realtime-graph-z", "blue", 5, maxval);

        if (hidbridge.shouldUse()) {
            hidbridge.initAsync()
            .then(dev => {
                dev.onSerial = (buf, isErr) => {
                    let strBuf: string = Util.fromUTF8(Util.uint8ArrayToString(buf));
                }
            });
        }

        // window.setInterval(() => {
        //     this.graphX.update(Math.random() * maxval * 2 - maxval, this.graphX.smoothedLine);
        //     this.graphY.update(Math.random() * maxval * 2 - maxval, this.graphY.smoothedLine);
        //     this.graphZ.update(Math.random() * maxval * 2 - maxval, this.graphZ.smoothedLine);
        // }, 40);
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
                closeOnDimmerClick closeOnDocumentClick
                >
                <div className="ui three column grid">
                    <div className="four wide column">
                        <video id="webcam-video"></video>
                    </div>
                    <div className="nine wide column">
                        <div className="row" id="realtime-graph-x"></div>
                        <div className="row" id="realtime-graph-y"></div>
                        <div className="row" id="realtime-graph-z"></div>
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
            </sui.Modal>
        )
    }
}