/// <reference path="../../built/pxtsim.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as core from "./core";

export interface SerialIndicatorProps {
    isSim: boolean,
    onClick: () => any
}

export interface SerialIndicatorState {
    active?: boolean
    receivingData?: boolean
}

export class SerialIndicator extends React.Component<SerialIndicatorProps, SerialIndicatorState>{

    constructor(props: any) {
        super(props)
        this.state = { active: false, receivingData: false }
        window.addEventListener("message", this.handleMessage.bind(this))
    }

    handleMessage(ev: MessageEvent) {
        let msg = ev.data
        if (!this.state.active && msg.type === "serial") {
            const sim = !!msg.sim
            if (sim === this.props.isSim) {
                this.setState({ active: true, receivingData: true})
            }
        }
    }

    clear() {
        this.setState({ active: false })
    }

    render() {
        if (!this.state.active) return <div />;
        return <div className="ui segment inverted serialindicator" tabIndex={0} onClick={this.props.onClick} onKeyDown={sui.fireClickOnEnter}>
            <div className="ui label circular">
                <div className="detail indicator">
                    <span className={` ${this.state.receivingData ? "blink" : ""} ui green empty circular label`} />
                </div>
                <div className="detail">
                    <sui.Icon icon="bar graph"/>
                </div>
                {lf("Data Viewer") }
                <div className="detail">
                    {this.props.isSim ? lf("Simulator") : lf("Device") }
                </div>
            </div>
        </div>
    }
}