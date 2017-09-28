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
            <div className="ui left labeled button"  onClick={this.props.onClick}>
                <a className="ui basic label">
                    {this.props.isSim ? lf("Simulator serial") : lf("Device serial")}
                </a>
                <AnimationPill isSim={true} />
                <div className="ui button">
                    <i className="external icon"></i>
                </div>
            </div>
        ))
    }
}

interface AnimationPillProps {
    isSim: boolean
}

class AnimationPill extends React.Component<AnimationPillProps, {}> {
    animationStarter: any
    animationStopper: any
    buffer: number[]
    active: boolean
    canvas: HTMLCanvasElement = undefined

    randomNumber() {
        let absval = Math.random() * 32767
        let bit = Math.random()
        return absval * (bit < 0.5 ? -1 : 1)
    }

    randomBuffer() {
        let arr: number[] = []
        //TODO no hardcoded 1000
        for (let i = 0; i < 1000; i++) {
            arr.push(this.randomNumber())
        }
        return arr
    }

    renderWave(buffer: number[]) {
        let canvas = this.canvas
        if (!canvas || !canvas.getContext) {
            return
        }
        let strip = canvas.getContext("2d")
        let h = strip.canvas.height
        let w = strip.canvas.width
        strip.clearRect(0, 0, w, h)
        strip.strokeStyle = "#fff"
        //TODO themeable
        strip.lineWidth = 1.0
        let b = 0
        let lastSample = (buffer[b++] + 32768) / 65536.0

        for (let x = 1; x < canvas.width; x++) {
            let sample = (buffer[b++] + 32768) / 65536.0
            if (b > buffer.length) {
                break
            }
            strip.beginPath()
            strip.moveTo(x - 1, h - lastSample * h)
            strip.lineTo(x, h - sample * h)
            strip.stroke()
            lastSample = sample
        }

    }

    animate() {
        let firstNum = this.buffer.shift()
        this.buffer.push(firstNum)
        this.renderWave(this.buffer)
    }

    constructor(props: AnimationPillProps) {
        super(props)
        this.buffer = this.randomBuffer()
        this.active = false
    }

    startAnimation() {
        clearTimeout(this.animationStopper)
        this.animationStopper = setTimeout(this.stopAnimation.bind(this), 2000)
        if (!this.active) {
            this.animationStarter = setInterval(this.animate.bind(this), 100)
            this.active = true
        }
    }

    stopAnimation() {
        if (this.active) {
            clearInterval(this.animationStarter)
            this.active = false
        }
    }

    handleMessage(e: MessageEvent) {
        let msg = e.data
        if (msg.type == "serial") {
            if (msg.sim == this.props.isSim) {
                this.startAnimation()
            }
        }
    }

    componentDidMount() {
        //this.animation = setInterval(this.animate.bind(this), 100)
        window.addEventListener("message", this.handleMessage.bind(this))
        this.canvas.setAttribute("style", "background-color:red;")
    }

    render() {
        //TODO width/height
        return <canvas ref={c => this.canvas = c} id="modulatorWavStrip"></canvas>
    }
}
