import * as React from "react";
import * as hidbridge from "./../hidbridge";

export interface IConnectionIndicator { parent?: any, onConnStatChangeHandler?: (con: boolean) => void, class?: string }
export interface ConnectionState { connected: boolean }
export class ConnectionIndicator extends React.Component<IConnectionIndicator, ConnectionState> {

    constructor(props: IConnectionIndicator) {
        super(props);

        this.state = { connected: false };

        setInterval(() => {
            if (Date.now() - props.parent.lastConnectedTime > 1000) {
                this.setState({ connected: false });
                this.props.onConnStatChangeHandler(false);

                if (hidbridge.shouldUse())
                    hidbridge.initAsync();
            }
            else {
                if (!this.state.connected) {
                    this.setState({ connected: true });
                    this.props.onConnStatChangeHandler(true);
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
            <div className={"ui basic label " + status.color + " " + this.props.class}>
                <i className={"icon " + status.icon + " " + status.color}></i>
                {status.string}
            </div>
        );
    }
}

