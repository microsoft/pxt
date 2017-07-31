import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./../sui"
import * as blockspreview from "./../blockspreview"
import * as hidbridge from "./../hidbridge";

const lf = pxt.Util.lf;
const repeat = pxt.Util.repeatMap;

type ISettingsProps = pxt.editor.ISettingsProps;

export interface IConnectionIndicator {
    parent?: any;
}

export interface ConnectionState {
    connected: boolean;
}

export class ConnectionIndicatorView extends React.Component<IConnectionIndicator, ConnectionState> {

    constructor(props: IConnectionIndicator) {
        super(props);

        this.state = { connected: false };

        setInterval(() => {
            if (Date.now() - props.parent.lastConnectedTime > 1000) {
                this.setState({ connected: false });

                if (hidbridge.shouldUse())
                    hidbridge.initAsync();
            }
            else {
                if (!this.state.connected) {
                    this.setState({ connected: true });
                }
            }
        }, 1000);
    }

    componentDidUpdate() {
        ($('.ui.embed') as any).embed();
    }

    render() {
        const status = (this.state.connected ?
            { string: "Connected", icon: "checkmark", color: "green" }
            : { string: "Disconnected", icon: "remove", color: "red" });

        return (
            <div className={"ui basic label " + status.color}>
                <i className={"icon " + status.icon + " " + status.color}></i>
                <span>{status.string}</span>
            </div>
        );
    }
}
