import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

export interface AccessibleBlocksInfoState {
    shown?: boolean;
}

export class AccessibleBlocksInfo extends data.Component<{}, AccessibleBlocksInfoState> {
    constructor(props: {}) {
        super(props);
        this.state = { shown: false }
        this.handleOnClose = this.handleOnClose.bind(this);
    }

    handleOnClose() {
        this.setState({ shown: true })
    }

    render() {
        const shown = this.state.shown;
        if (shown) return <div />;
        return <sui.Modal isOpen={!this.state.shown} onClose={this.handleOnClose} closeIcon={true}
            dimmer={true} header={lf("Move, edit, and insert blocks using your keyboard")}>
            <div className="ui equal width grid">
                <div className="column">
                    <h3>{lf("Navigate")}</h3>
                    <span className="ui small">{lf("Use the WASD keys to move between blocks. Hold shift to move on the workspace.")}</span>
                </div>
                <div className="column">
                    <h3>{lf("Modify")}</h3>
                    <span className="ui small">{lf("Press Enter to 'mark' a block, then X to disconnect, I to reconnect.")}</span>
                </div>
                <div className="column">
                    <h3>{lf("Insert")}</h3>
                    <span className="ui small">{lf("Use T to open the toolbox. Inside the toolbox, use WASD to navigate, and Enter to insert.")}</span>
                </div>
            </div>
            <div className="ui grid">
                <strong><a href="https://developers.google.com/blockly/guides/configure/web/keyboard-nav">
                    {lf("See the official Blockly Documentation for additional detail")}
                </a></strong>
            </div>
        </sui.Modal>
    }
}