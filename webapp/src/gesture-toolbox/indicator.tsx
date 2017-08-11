import * as React from "react";
import * as hidbridge from "./../hidbridge";

export interface IConnectionIndicator { parent?: any, onConnStatChangeHandler?: (con: boolean) => void, class?: string }
export interface ConnectionState { connected?: boolean, reconnecting?: boolean }
export class ConnectionIndicator extends React.Component<IConnectionIndicator, ConnectionState> {
    private intervalID: number;
    private attemptTimes: number;

    constructor(props: IConnectionIndicator) {
        super(props);
        this.props = props;

        this.attemptTimes = 0;
        
        if (Date.now() - this.props.parent.lastConnectedTime < 2500)
            this.state = { connected: true, reconnecting: false };
        else
            this.state = { connected: false, reconnecting: false };

        this.intervalID = setInterval(() => {
            let elapsedTime = Date.now() - this.props.parent.lastConnectedTime;

            if (elapsedTime > 2500) {
                if (this.state.connected && !this.state.reconnecting) {
                    // make sure that it only calls setState when it's going to change the state (and not overwrite the same state)
                    this.setState({ connected: false });
                    this.props.onConnStatChangeHandler(false);
                }

                if(!this.state.reconnecting) {
                    // make sure that it doesn't try to call hidbridge.initAsync() when it is being reconnected (and cause a race condition)
                    this.setState({ reconnecting: true });

                    if (hidbridge.shouldUse())
                        hidbridge.initAsync();
                }
                else {
                    this.attemptTimes++;

                    if (this.attemptTimes == 3) {
                        this.attemptTimes = 0;
                        this.setState({ connected: false, reconnecting: false });
                    }
                }
            }
            else {
                // we are connected to the device
                if (!this.state.connected) {
                    // make sure that it only calls setState when it's going to change the state (and not overwrite the same state)
                    this.setState({ connected: true, reconnecting: false });
                    this.props.onConnStatChangeHandler(true);

                }
            }
        }, 1000);
    }

    componentDidMount() {
        
    }

    componentWillUnmount() {
        clearInterval(this.intervalID);
    }

    componentDidUpdate() {
        ($('.ui.embed') as any).embed();
    }

    render() {
        let status = { string: "", icon: "", color: "" };

        if (this.state.reconnecting)
            status = { string: "Reconnecting", icon: "refresh", color: "yellow" };
        else if (this.state.connected)
            status = { string: "Connected", icon: "checkmark", color: "green" };
        else if (!this.state.connected)
            status = { string: "Disconnected", icon: "remove", color: "red" };

        return (
            <div className={"ui basic label " + status.color + " " + this.props.class}>
                <i className={"icon " + status.icon + " " + status.color}></i>
                {status.string}
            </div>
        );
    }
}

