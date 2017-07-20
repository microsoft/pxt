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
        Viz.init("realtime-graph", 600, 400);

        window.setInterval(() => {
            Viz.update(new Types.Vector(Math.random() * 30, Math.random() * 30, Math.random() * 30));
        }, 40);
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
                    <div className="six wide column">
                        {/* Webcam */}
                        <video id="webcam-video"></video>
                    </div>
                    <div className="eight wide column">
                        {/* Sensor Data */}
                        <div id="realtime-graph"></div>
                    </div>
                    <div className="two wide column">buttons</div>
                </div>
            </sui.Modal>
        )
    }
}