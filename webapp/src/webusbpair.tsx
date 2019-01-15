import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface WebUSBPairProps extends ISettingsProps {
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface WebUSBPairState {
    visible?: boolean;
    loading?: boolean;
    pairingError?: boolean;
    device0?: string;
    device1?: string;
}

export class WebUSBPairEditor extends data.Component<WebUSBPairProps, WebUSBPairState> {
    private showPromise: Promise<void>;
    private showResolve: () => void;

    constructor(props: WebUSBPairProps) {
        super(props);
        this.state = {
            visible: false
        }

        this.show = this.show.bind(this);
        this.pair = this.pair.bind(this);
        this.hide = this.hide.bind(this);
    }

    shouldComponentUpdate(nextProps: WebUSBPairProps, nextState: WebUSBPairState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.loading != nextState.loading
            || this.state.device0 != nextState.device0
            || this.state.device1 != nextState.device1
    }

    showAsync(): Promise<void> {
        if (!this.showPromise)
            this.showPromise = new Promise((resolve, reject) => {
                this.showResolve = resolve;
                this.show();
            })
        return this.showPromise;
    }

    show() {
        this.setState({ visible: true, loading: false, device0: undefined, device1: undefined, pairingError: false });
    }

    hide() {
        this.setState({ visible: false });
        if (this.showPromise) {
            this.showResolve();
            this.showPromise = undefined;
            this.showResolve = undefined;
        }
    }

    pair() {
        const { loading, device0, device1 } = this.state;
        if (loading)
            return; // already in system dialog

        this.setState({ loading: true, pairingError: false });
        pxt.usb.pairAsync()
            .then(() => pxt.usb.deviceSerialNumberAsync())
            .then(serialNumber => {
                if (!serialNumber) {
                    this.setState({ pairingError: true });
                } else if (!device0) {
                    this.setState({ device0: serialNumber });
                } else if (serialNumber != device0) {
                    this.setState({ device1: serialNumber })
                }
            })
            .finally(() => {
                this.setState({ loading: false });
            })
    }

    renderCore() {
        const { visible, loading, device0, device1, pairingError } = this.state;
        const targetTheme = pxt.appTarget.appTheme;
        const boardName = targetTheme.boardName || lf("device");

        const actions: sui.ModalButton[] = [];
        if (!device0 && !device1) {
            // first step of wizard
            actions.push({
                label: lf("Pair"),
                onclick: this.pair,
                icon: 'usb',
                loading,
                className: 'primary'
            });
        } else if (device0) {
            // step 2
            actions.push({
                label: lf("Connect"),
                onclick: this.pair,
                icon: 'usb',
                loading,
                className: 'primary'
            });
        } else { // success
            actions.push({
                label: lf("Close"),
                onclick: this.hide,
                icon: 'usb',
                loading,
                className: 'primary'
            });
        }

        return (
            <sui.Modal isOpen={visible} className="webusbpairdialog" size="small"
                onClose={this.hide}
                dimmer={true} header={lf("Pair your {0}", boardName)}
                closeIcon={true} buttons={actions}
                closeOnDimmerClick
                closeOnDocumentClick
                closeOnEscape>
                <div>
                    {!device0 && !device1 ?
                        <div className="ui">
                            <h3>Step 1</h3>
                            <p>
                                {lf("Connect {0} to computer with USB cable", boardName)}.
                    {lf("Press Pair and select the device in the pairing dialog.")}
                            </p>
                        </div> : undefined}
                    {device0 && !device1 ?
                        <div className="ui">
                            <h3>Step 2</h3>
                            <p>
                                {lf("Well done!")}
                                {lf("Press Connect and select the device in the pairing dialog.")}
                            </p>
                        </div> : undefined}
                    {device0 && device1 ?
                        <div className="ui">
                            <h3>All done!</h3>
                            <p>
                                {lf("Your device is paired and connected. Close the dialog to continue.")}
                            </p>
                        </div> : undefined}
                    {pairingError ?
                        <div className="ui warning message">
                            {lf("Oops, it looks like pairing failed. Make sure your device is connected and try again.")}
                        </div> : undefined}
                </div>
            </sui.Modal>
        )
    }
}
