/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";

interface HintTooltipState {
    show?: boolean;
}

interface HintTooltipProps {
    text: string;
    onClick: any;
    pokeUser?: boolean;
    animationDuration?: number;
}

export class HintTooltip extends data.Component<HintTooltipProps, HintTooltipState> {
    constructor(props: HintTooltipProps) {
        super(props);
    }

    componentWillReceiveProps(nextProps: HintTooltipProps) {
        if (nextProps.pokeUser != this.state.show) {
            this.setState({ show: nextProps.pokeUser });
        }
    }

    renderCore() {
        // Animation should be attached to 'show' class
        return <div className={`tooltip ${this.state.show ? 'show' : ''}`}
                    role="tooltip"
                    onClick={this.props.onClick}>
                        {this.props.text}
                </div>;
    }
}

export class HintManager {
    private timer: number;
    private defaultDuration: number = 10000;
    private defaultDisplayCount: number = 3;
    private hints: { [key: string]: any } = {};

    public addHint(id: string, callback: any, duration?: number) {
        this.hints[id] = pxt.Util.debounce(() => {
            callback();
            this.stopPokeUserActivity();
        }, duration || this.defaultDuration);
    }

    // starts a timer, overwriting current timer
    // TODO: if/when we add more hints, should discuss whether this count is across all hints or per-hint
    public pokeUserActivity(id: string, displayCount?: number) {
        if (displayCount == undefined || displayCount < this.defaultDisplayCount) {
            this.stopPokeUserActivity();
            this.timer = this.hints[id]();
        }
    }

    // stops current user hint timer
    public stopPokeUserActivity() {
        clearTimeout(this.timer);
        this.timer = null;
    }
}