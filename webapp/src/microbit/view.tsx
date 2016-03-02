/// <reference path="../../../built/yelmlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "../sui"

import rt = yelm.rt;
import U = yelm.U;

export class BoardView extends React.Component<yelm.rt.micro_bit.IBoardProps, {}> {
    view: yelm.rt.micro_bit.MicrobitBoardSvg;

    componentDidUpdate() {
        if (this.view && !$(this.view.element).parentsUntil("body").length) {
            $(this.refs["simsvg"]).empty().append(this.view.element)
        }
    }

    render() {
        let runtime = this.props.runtime

        if (!runtime) return null

        if (runtime.target.name != "microbit") return null;

        if (!this.view || this.view.board !== runtime.board) {
            let props = U.flatClone(this.props)
            if (!props.theme)
                props.theme = yelm.rt.micro_bit.randomTheme();
            this.view = new yelm.rt.micro_bit.MicrobitBoardSvg(props)
        }

        return (
            <div>
                <div ref="simsvg"></div>
            </div>
        )
    }
}