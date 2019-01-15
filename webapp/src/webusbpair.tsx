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
    private showPromise: Promise<number>;
    private showResolve: (r: number) => void;

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
            || this.state.pairingError != nextState.pairingError
    }

    showAsync(): Promise<number> {
        if (!this.showPromise)
            this.showPromise = new Promise((resolve, reject) => {
                this.showResolve = resolve;
                this.show();
            })
        return this.showPromise;
    }

    show() {
        this.setState({
            visible: true,
            loading: false,
            device0: undefined,
            device1: undefined,
            pairingError: false
        });
    }

    hide() {
        this.setState({ visible: false });
        if (this.showPromise) {
            this.showResolve(this.state.device0 && this.state.device1 ? 1 : 0);
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
            .then(() => pxt.usb.deviceInfo())
            .then(info => {
                if (!info) {
                    this.setState({ pairingError: true });
                    return
                }
                const sn = info.serialNumber + info.vendorId + info.productId; // TODO: need to identify bootloader vs app
                if (!device0) {
                    this.setState({ device0: sn });
                } else if (sn != device0) {
                    this.setState({ device1: sn })
                } else {
                    // same serial number, press reset
                    this.setState({ pairingError: true });
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
        if (loading) {
            // no buttons while loading
        } else if (!device0 && !device1) {
            // first step of wizard
            actions.push({
                label: lf("Skip"),
                onclick: this.hide,
                icon: 'close',
                className: `secondary`
            });
            actions.push({
                label: lf("Pair"),
                onclick: this.pair,
                icon: 'usb',
                className: 'primary'
            });
        } else if (device0 && !device1) {
            // step 2
            actions.push({
                label: lf("Skip"),
                onclick: this.hide,
                icon: 'close',
                className: `secondary`
            });
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
                    <div className="ui two top attached steps">
                        <div className={`${(!device0 && !device1) ? 'active' : 'completed'} step`}>
                            <i className={`${!device0 && !device1 ? 'usb' : 'check'} icon`}></i>
                            <div className="content">
                                <div className="title">{lf("Pair")}</div>
                            </div>
                        </div>
                        <div className={`${(device0 && !device1) ? 'active' : (device0 && device1) ? 'completed' : ''} step`}>
                            <i className={`${device0 && device1 ? "check" : "plug"} icon`}></i>
                            <div className="content">
                                <div className="title">{lf("Connect")}</div>
                            </div>
                        </div>
                    </div>
                    <div className="ui basic segment">
                        {!device0 && !device1 ? <p>
                            {lf("Pair to download code in your device automatically.")}
                            {lf("Connect your device to your computer with a USB cable and click 'Pair' to get started.")}
                        </p> : undefined}
                        {device0 && !device1 ? <p>
                            {lf("Pairing successful! We need to connect to the device again to complete the procedure.")}
                            {lf("Press 'Connect' to continue.")}
                        </p> : undefined}
                        {device0 && device1 ? <p>{lf("Your device is paired and ready to be used!")}</p> : undefined}
                    </div>
                    {pairingError ?
                        <div className="ui warning message">
                            {lf("Oops, it looks like pairing failed. Make sure your device is connected and try again.")}
                        </div> : undefined}
                    {loading ? <div className="ui active dimmer">
                        <div className="ui loader"></div>
                    </div> : undefined}
                </div>
            </sui.Modal>
        )
    }
}
