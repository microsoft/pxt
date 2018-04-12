import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";

export interface BlocksPreviewProps {
    xml: string;
}

export interface BlocksPreviewState {

}

export class BlocksPreview extends data.Component<BlocksPreviewProps, BlocksPreviewState> {
    workspace: Blockly.Workspace;

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

    renderCore() {
        return (<div style={ { width: "100%", minHeight: "10em", direction: "ltr" } }></div>)
    }
}