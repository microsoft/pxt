import * as React from "react";
import * as hidbridge from "./../hidbridge";

export interface IConnectionIndicator { parent?: any }
export interface ConnectionState { connected: boolean }
export class ConnectionIndicator extends React.Component<IConnectionIndicator, ConnectionState> {
    static connected: boolean = false;

    constructor(props: IConnectionIndicator) {
        super(props);

        this.state = { connected: false };

        setInterval(() => {
            if (Date.now() - props.parent.lastConnectedTime > 1000) {
                this.setState({ connected: false });
                ConnectionIndicator.connected = false;

                if (hidbridge.shouldUse())
                    hidbridge.initAsync();
            }
            else {
                if (!this.state.connected) {
                    this.setState({ connected: true });
                    ConnectionIndicator.connected = true;
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

