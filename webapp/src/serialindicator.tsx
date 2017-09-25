/// <reference path="../../built/pxtsim.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as core from "./core";

//TODO change name of this module
//TODO fix type of onclick
export interface SerialIndicatorProps {
    isSim: boolean,
    onClick: any
}

export interface SerialIndicatorState {
    active?: boolean
}

export class SerialIndicator extends React.Component<SerialIndicatorProps, SerialIndicatorState>{

    constructor(props: any) {
        super(props)
        this.state = {active: false}
        window.addEventListener("message", this.setActive.bind(this))
    }

    setActive(ev: MessageEvent) {
        let msg = ev.data
        if (!this.state.active && msg.type === "serial") {
            const sim = !!msg.sim
            if (sim === this.props.isSim) {
                this.setState({active: true})
            }
        }
    }

    clear() {
        this.setState({active: false})
    }

    render() {
        return(!this.state.active ? (<div></div>) : (
            <div className="ui left labeled button">
                <a className="ui basic label">
                    {this.props.isSim ? lf("Simulator serial") : lf("Device serial")}
                </a>
                <div className="ui button" onClick={this.props.onClick}>
                    <i className="external square icon"></i>
                </div>
            </div>
        ))
    }
}
