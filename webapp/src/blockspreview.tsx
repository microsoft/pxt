/// <reference path="../../typings/globals/jquery/index.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom"
import * as pkg from "./package";
import * as core from "./core";

export interface BlocksPreviewProps {
    xml: string;
}

export interface BlocksPreviewState {

}


export class BlocksPreview extends React.Component<BlocksPreviewProps, BlocksPreviewState> {
    workspace: Blockly.Workspace;
    constructor(props: BlocksPreviewProps) {
        super(props);
        this.state = {};
    }

    renderSvg() {
        let el = $(ReactDOM.findDOMNode(this));
        let svg = pxt.blocks.render(this.props.xml);

        el.children().remove();
        el.append(svg);
    }

    componentDidMount() {
        this.renderSvg();
    }

    componentDidUpdate() {
        this.renderSvg();
    }

    render() {
        return (<div style={ { width: "100%", minHeight: "10em", direction:"ltr" } }></div>)
    }
}