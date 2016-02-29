/// <reference path="../typings/jquery/jquery.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom"
import * as pkg from "./package";
import * as core from "./core";
import * as blocklyrenderer from "./blocklyrenderer"

export interface BlocksPreviewProps {
    xml: string;
}

export interface BlocksPreviewState {

}


export class BlocksPreview extends React.Component<BlocksPreviewProps, BlocksPreviewState> {
    workspace : Blockly.Workspace;
    constructor(props: BlocksPreviewProps) {
        super(props);
        this.state = {}
    }
    
    componentDidUpdate() {
        let el = $(ReactDOM.findDOMNode(this));
        let svg = blocklyrenderer.render(this.props.xml);
        
        el.children().remove();
        el.append(svg);
    }

    render() {
        return (<div style={ { width: '100%', minHeight: '10em'} }></div>)
    }
}