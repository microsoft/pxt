import * as React from "react";
import * as core from "./core";
import * as cmds from "./cmds";
import { ModalButton } from "./sui";

function resolveFirmwareUrl(): string {
    const boardid = pxt.appTarget?.simulator?.boardDefinition?.id;
    if (boardid) {
        const bundled = pxt.appTarget.bundledpkgs[boardid];
        if (bundled) {
            const cfg = pxt.Package.parseAndValidConfig(bundled[pxt.CONFIG_NAME]);
            if (cfg) {
                return cfg.firmwareUrl;
            }
        }
    }
    return undefined;
}

let userPrefersDownloadFlag = false;

type ConfirmAsync = (options: core.PromptOptions) => Promise<number>;

export async function webUsbPairDialogAsync(pairAsync: () => Promise<boolean>, confirmAsync: ConfirmAsync, implicitlyCalled?: boolean) {
    if (pxt.appTarget.appTheme.downloadDialogTheme) {
        return webUsbPairThemedDialogAsync(pairAsync, confirmAsync, implicitlyCalled);
    }
    else {
        return webUsbPairLegacyDialogAsync(pairAsync, confirmAsync);
    }
}

export async function webUsbPairThemedDialogAsync(pairAsync: () => Promise<boolean>, confirmAsync: ConfirmAsync, implicitlyCalled?: boolean): Promise<number> {
    const boardName = getBoardName();

    if (!implicitlyCalled) {
        clearUserPrefersDownloadFlag();
    }

    const notPairedResult = () => userPrefersDownloadFlag ? pxt.commands.WebUSBPairResult.UserRejected : pxt.commands.WebUSBPairResult.Failed;
    let lastPairingError: any;

    if (!await showConnectDeviceDialogAsync(confirmAsync))
        return notPairedResult();

    let connected = pxt.packetio.isConnected();

    if (!connected && pxt.packetio.isConnecting()) {
        const start = Date.now();
        const TRY_FOR_MS = 2500;
        core.showLoading("attempting-reconnect", lf("Reconnecting to your {0}", boardName));
        try {
            await pxt.Util.promiseTimeout(TRY_FOR_MS, (async () => {
                while (!pxt.packetio.isConnected() && Date.now() < start + TRY_FOR_MS) {
                    await pxt.Util.delay(30);
                }
                connected = pxt.packetio.isConnected();
            })());
        } catch (e) {
            // continue pairing flow
        }
        core.hideLoading("attempting-reconnect");
    }

    let paired = connected;


    if (!connected) {
        // TODO: consider watching .isConnected while showPickWebUSB runs,
        // and hiding the dialog automatically if connection occurs
        // while the modal is still up.
        const webUsbInstrDialogRes = await showPickWebUSBDeviceDialogAsync(confirmAsync, implicitlyCalled);
        connected = pxt.packetio.isConnected();
        if (connected) {
            // plugged in underneath previous dialog, continue;
            core.hideDialog();
        } else if (!webUsbInstrDialogRes) {
            return notPairedResult();
        } else {
            let errMessage: any;
            try {
                paired = await pairAsync();
            } catch (e) {
                errMessage = e.message;
                lastPairingError = e;
            }
            core.hideDialog();

            if (pxt.packetio.isConnected()) {
                // user connected previously paired device &&
                // exitted browser pair dialog without reselecting it;
                // this is fine.
                paired = true;
            } else if (errMessage) {
                // error occured in catch, throw now that we know pairing
                // didn't happen underneath this dialog flow
                core.errorNotification(lf("Pairing error: {0}", errMessage));
                paired = false;
            }
        }
    }


    if (paired && !pxt.packetio.isConnected()) {
        // Confirm connection is valid (not e.g. being controlled by another tab).
        core.showLoading("attempting-connection", lf("Connecting to your {0}", boardName));
        try {
            paired = await cmds.maybeReconnectAsync(
                false /** pairIfDeviceNotFound **/,
                true /** skipIfConnected **/,
            );
        } catch (e) {
            // Error while attempting connection
            paired = false;
            lastPairingError = e;
        }
        core.hideLoading("attempting-connection");
    }

    if (paired) {
        await showConnectionSuccessAsync(confirmAsync, implicitlyCalled);
    }
    else {
        const tryAgain = await showConnectionFailureAsync(confirmAsync, implicitlyCalled, lastPairingError);

        if (tryAgain) return webUsbPairThemedDialogAsync(pairAsync, confirmAsync, implicitlyCalled);
    }

    if (paired) {
        return pxt.commands.WebUSBPairResult.Success;
    } else {
        return notPairedResult();
    }
}

function showConnectDeviceDialogAsync(confirmAsync: ConfirmAsync) {
    const connectDeviceImage = theme().connectDeviceImage;
    const boardName = getBoardName();

    const jsxd = () => (
        connectDeviceImage
            ? <img
                alt={lf("Image connecting {0} to a computer", boardName)}
                className="ui medium rounded image webusb-connect-image"
                src={connectDeviceImage}
            />
            : <div className={`ui one column grid padded download-dialog`}>
            <div className="column">
                <div className="ui">
                    <div className="content">
                        <div className="description">
                            {lf("First, make sure your {0} is connected to your computer with a USB cable.", boardName)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return showPairStepAsync({
        hideClose: true,
        confirmAsync,
        jsxd,
        buttonLabel: lf("Next"),
        buttonIcon: pxt.appTarget?.appTheme?.downloadDialogTheme?.deviceIcon,
        header: lf("1. Connect your {0} to your computer", boardName),
        tick: "downloaddialog.button.connectusb",
    });
}

function showPickWebUSBDeviceDialogAsync(confirmAsync: ConfirmAsync, showDownloadAsFileButton?: boolean) {
    const boardName = getBoardName();

    const selectDeviceImage = theme().selectDeviceImage;
    const columns = selectDeviceImage ? "two" : "one";

    const jsxd = () => (
        <div className={`ui ${columns} column grid padded download-dialog`}>
            <div className="column">
                <div className="ui">
                    <div className="content">
                        <div className="description">
                            {lf("Press the Pair button below.")}
                            <br />
                            <br />
                            {lf("A window will appear in the top of your browser.")}
                            <br />
                            <br />
                            {lf("Select the {0} device and click Connect.", boardName)}
                        </div>
                    </div>
                </div>
            </div>
            {selectDeviceImage &&
                <div className="column">
                    <div className="ui">
                        <div className="image download-dialog-image">
                            <img alt={lf("Image selecting {0} from a list of WebUSB devices", boardName)} className="ui large rounded image" src={selectDeviceImage} />
                        </div>
                    </div>
                </div>
            }
        </div>
    );

    return showPairStepAsync({
        confirmAsync,
        jsxd,
        buttonLabel: lf("Pair"),
        buttonIcon: pxt.appTarget?.appTheme?.downloadDialogTheme?.deviceIcon,
        showDownloadAsFileButton,
        header: lf("2. Pair your {0} to your browser", boardName),
        tick: "downloaddialog.button.pickusbdevice",
        doNotHideOnAgree: true,
    });
}

function showConnectionSuccessAsync(confirmAsync: ConfirmAsync, willTriggerDownloadOnClose: boolean) {
    const boardName = getBoardName();
    const connectionImage = theme().connectionSuccessImage;
    const columns = connectionImage ? "two" : "one";

    const jsxd = () => (
        <div className={`ui ${columns} column grid padded download-dialog`}>
            <div className="column">
                <div className="ui">
                    <div className="content">
                        <div className="description">
                            {lf("Your {0} is connected! Pressing 'Download' will now automatically copy your code to your {0}.", boardName)}
                        </div>
                    </div>
                </div>
            </div>
            {connectionImage &&
                <div className="column">
                    <div className="ui">
                        <div className="image download-dialog-image">
                            <img alt={lf("Image of {0}", boardName)} className="ui medium rounded image" src={connectionImage} />
                        </div>
                    </div>
                </div>
            }
        </div>
    );

    return showPairStepAsync({
        confirmAsync,
        jsxd,
        buttonLabel: willTriggerDownloadOnClose ? lf("Download") : lf("Done"),
        buttonIcon: pxt.appTarget.appTheme.downloadDialogTheme?.deviceSuccessIcon,
        header: lf("Connected to {0}", boardName),
        tick: "downloaddialog.button.webusbsuccess",
        help: undefined,
        headerIcon: "large circle check purple",
    });
}


function showConnectionFailureAsync(confirmAsync: ConfirmAsync, showDownloadAsFileButton: boolean, error: any) {
    const boardName = getBoardName();
    const tryAgainText = lf("Try Again");
    const helpText = lf("Help");
    const downloadAsFileText = lf("Download as File");

    const errorDisplay = error?.type === "devicelocked"
        ? lf("We couldn't connect to your {0}. It may be in use by another application.", boardName)
        : lf("We couldn't find your {0}.", boardName);
    const jsxd = () => (
        <div>
            <div className="ui content download-troubleshoot-header">
                {errorDisplay}
                <br />
                <br />
                {lf("Click \"{0}\" for more info, \"{1}\" to retry pairing, or \"{2}\" for drag-and-drop flashing.", helpText, tryAgainText, downloadAsFileText)}
            </div>
        </div>
    );


    return showPairStepAsync({
        confirmAsync,
        jsxd,
        buttonLabel: tryAgainText,
        buttonIcon: pxt.appTarget?.appTheme?.downloadDialogTheme?.deviceIcon,
        header: lf("Failed to connect"),
        tick: "downloaddialog.button.webusbfailed",
        help: theme().troubleshootWebUSBHelpURL,
        headerIcon: "exclamation triangle purple",
        showDownloadAsFileButton,
    });
}

interface PairStepOptions {
    confirmAsync: ConfirmAsync;
    jsxd: () => JSX.Element;
    buttonLabel: string;
    buttonIcon?: string;
    header: string;
    tick: string;
    help?: string;
    headerIcon?: string;
    showDownloadAsFileButton?: boolean;
    hideClose?: boolean;
    doNotHideOnAgree?: boolean;
}

async function showPairStepAsync({
    confirmAsync,
    jsxd,
    buttonLabel,
    buttonIcon,
    header,
    tick,
    help,
    headerIcon,
    showDownloadAsFileButton,
    hideClose,
    doNotHideOnAgree,
}: PairStepOptions) {
    let tryAgain = false;

    /**
     * The deferred below is only used when doNotHideOnAgree is set
     */
    let deferred: () => void;
    const agreeButtonClicked = doNotHideOnAgree && new Promise((_res: (val: void) => void, rej: () => void) => {
        deferred = _res;
    });

    const buttons: ModalButton[] = [
        {
            label: buttonLabel,
            className: "primary",
            icon: buttonIcon,
            labelPosition: "left",
            onclick: () => {
                pxt.tickEvent(tick);
                tryAgain = true;
                if (doNotHideOnAgree) {
                    deferred();
                }
            },
            noCloseOnClick: doNotHideOnAgree,
        }
    ];

    if (showDownloadAsFileButton) {
        buttons.unshift({
            label: lf("Download as File"),
            className: "secondary",
            icon: pxt.appTarget.appTheme.downloadIcon || "xicon file-download",
            labelPosition: "left",
            onclick: () => {
                pxt.tickEvent("downloaddialog.button.webusb.preferdownload");
                userPrefersDownloadFlag = true;
                tryAgain = false;
            },
        });
    }

    const dialog = confirmAsync({
        header,
        jsxd,
        hasCloseIcon: !hideClose,
        hideCancel: hideClose,
        hideAgree: true,
        className: "downloaddialog",
        helpUrl: help,
        bigHelpButton: !!help,
        headerIcon: headerIcon ? headerIcon + " header-inline-icon" : undefined,
        buttons,
    });

    if (doNotHideOnAgree) {
        await Promise.race([agreeButtonClicked, dialog]);
        // resolve possibly dangling promise
        deferred?.();
    } else {
        await dialog;
    }

    return tryAgain;
}

export function webUsbPairLegacyDialogAsync(pairAsync: () => Promise<boolean>, confirmAsync: ConfirmAsync): Promise<number> {
    let failedOnce = false;
    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    const helpUrl = pxt.appTarget.appTheme.usbDocs;
    const jsxd = () => {
        const firmwareUrl = failedOnce && resolveFirmwareUrl();
        if (pxt.commands?.renderUsbPairDialog)
            return pxt.commands?.renderUsbPairDialog(firmwareUrl, failedOnce);

        return <div className={`ui ${firmwareUrl ? "four" : "three"} column grid stackable`}>
            {firmwareUrl && <div className="column firmware">
                <div className="ui">
                    <div className="content">
                        <div className="description">
                            {lf("Update Firmware")}
                            <br />
                            <a href={firmwareUrl} target="_blank" rel="noopener noreferrer">{lf("Check your firmware version and update if needed")}</a>
                        </div>
                    </div>
                </div>
            </div>}
            <div className="column">
                <div className="ui">
                    <div className="content">
                        <div className="description">
                            <span className="ui yellow circular label">1</span>
                            {lf("Connect {0} to your computer with a USB cable", boardName)}
                            <br />
                        </div>
                    </div>
                </div>
            </div>
            <div className="column">
                <div className="ui">
                    <div className="content">
                        <div className="description">
                            <span className="ui blue circular label">2</span>
                            {lf("Select the device in the pairing dialog")}
                        </div>
                    </div>
                </div>
            </div>
            <div className="column">
                <div className="ui">
                    <div className="content">
                        <div className="description">
                            <span className="ui blue circular label">3</span>
                            {lf("Press \"Connect\"")}
                        </div>
                    </div>
                </div>
            </div>
        </div>;
    }

    return new Promise((resolve, reject) => {
        const boardName = getBoardName();

        const confirmOptions = () => {
            return {
                header: lf("Connect to your {0}…", boardName),
                jsxd,
                hasCloseIcon: true,
                hideAgree: true,
                helpUrl,
                className: 'downloaddialog',
                buttons: [
                    {
                        label: lf("Connect device"),
                        icon: "usb",
                        className: "primary",
                        onclick: () => {
                            core.showLoading("pair", lf("Select your {0} and press \"Connect\".", boardName))
                            pairAsync()
                                .finally(() => {
                                    core.hideLoading("pair")
                                    core.hideDialog();
                                })
                                .then(paired => {
                                    if (paired || failedOnce) {
                                        resolve(paired ? pxt.commands.WebUSBPairResult.Success : pxt.commands.WebUSBPairResult.Failed)
                                    } else {
                                        failedOnce = true;
                                        // allow dialog to fully close, then reopen
                                        core.forceUpdate();
                                        confirmAsync(confirmOptions());
                                    }
                                })
                                .catch(e => {
                                    pxt.reportException(e)
                                    core.errorNotification(lf("Pairing error: {0}", e.message));
                                    resolve(0);
                                });
                        }
                    }
                ]
            }
        };
        confirmAsync(confirmOptions());
    })
}

function getBoardName() {
    return pxt.appTarget.appTheme.boardName || lf("device");
}

function theme() {
    return pxt.appTarget.appTheme.downloadDialogTheme || {};
}

export function renderUnpairDialog() {
    const boardName = getBoardName();
    const header = lf("How to unpair your {0}", boardName);
    const unpairImg = theme().browserUnpairImage;
    const jsx = <div>
        <p>
            {lf("You can unpair your {0} if the WebUSB download is malfunctioning.", boardName)}
        </p>
        <p>
            {lf("Click on the icon on the left side of the address bar and uncheck your device.")}
        </p>
        {unpairImg && <img
            className="ui image centered medium"
            src={unpairImg}
            alt={lf("A gif showing how to unpair the {0}", boardName)}
        />}
    </div>

    const helpUrl = pxt.appTarget.appTheme.usbDocs
        && (pxt.appTarget.appTheme.usbDocs + "/webusb#unpair");
    return { header, jsx, helpUrl };
}

export function renderDisconnectDeviceDialog() {
    const boardName = getBoardName();
    const disconnectImage = theme().disconnectDeviceImage;

    return <>
        {disconnectImage && <img
            className="ui image centered medium"
            src={disconnectImage}
            alt={lf("Image of {0} being disconnected", boardName)}
        />}
        <div>
            {lf("Your {0} appears to have stalled", boardName)}
            <br />
            <br />
            {lf("Please disconnect any battery and usb connection, and try again.")}
        </div>
    </>;
}

export async function showDeviceForgottenDialog(confirmAsync: ConfirmAsync) {
    const boardName = getBoardName();
    const deviceForgottenImage = theme().usbDeviceForgottenImage;
    const columns = deviceForgottenImage ? "two" : "one";

    const jsxd = () => (
        <div className={`ui ${columns} column grid padded download-dialog`}>
            <div className="column">
                <div className="ui">
                    <div className="content">
                        <div className="description">
                            {lf("Your {0} has been disconnected.", boardName)}
                            <br />
                            <br />
                            {lf("Unplug it from your computer and disconnect any battery to fully reset it.")}
                        </div>
                    </div>
                </div>
            </div>
            {deviceForgottenImage &&
                <div className="column">
                    <div className="ui">
                        <div className="image download-dialog-image">
                            <img alt={lf("Image of {0} being disconnected", boardName)} className="ui medium rounded image" src={deviceForgottenImage} />
                        </div>
                    </div>
                </div>
            }
        </div>
    );

    await showPairStepAsync({
        confirmAsync,
        jsxd,
        buttonLabel: lf("Done"),
        header: lf("{0} disconnected", boardName),
        tick: "downloaddialog.button.webusbforgotten",
        help: undefined,
    });
}


export function clearUserPrefersDownloadFlag() {
    userPrefersDownloadFlag = false;
}

export function userPrefersDownloadFlagSet() {
    return userPrefersDownloadFlag;
}