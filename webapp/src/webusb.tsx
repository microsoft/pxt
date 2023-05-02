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

export function webUsbPairDialogAsync(pairAsync: () => Promise<boolean>, confirmAsync: ConfirmAsync, implicitlyCalled?: boolean) {
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


    if (!await showConnectDeviceDialogAsync(confirmAsync))
        return notPairedResult();
    if (!await showPickWebUSBDeviceDialogAsync(confirmAsync, implicitlyCalled))
        return notPairedResult();

    core.showLoading("pair", lf("Select your {0} and press \"Connect\".", boardName))

    let paired: boolean;

    try {
        paired = await pairAsync();
    }
    catch (e) {
        core.errorNotification(lf("Pairing error: {0}", e.message));
        paired = false;
    }
    finally {
        core.hideLoading("pair")
    }

    if (paired) {
        await showConnectionSuccessAsync(confirmAsync, implicitlyCalled);
    }
    else {
        const tryAgain = await showConnectionFailureAsync(confirmAsync, implicitlyCalled);

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
                            {lf("We recommend pairing for easy downloads.")}
                            <br/>
                            <br/>
                            {lf("Press 'Pair' below and select your device from the browser pop-up.")}
                        </div>
                    </div>
                </div>
            </div>
            {selectDeviceImage &&
                <div className="column">
                    <div className="ui">
                        <div className="image download-dialog-image">
                            <img alt={lf("Image selecting {0} from a list of web usb devices", boardName)} className="ui medium rounded image" src={selectDeviceImage} />
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
                            <br/>
                            <br/>
                            {lf("If you need to unpair this {0}, you can do so through the '…' menu next to the 'Download' button", boardName)}
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


function showConnectionFailureAsync(confirmAsync: ConfirmAsync, showDownloadAsFileButton?: boolean) {
    const boardName = getBoardName();

    const jsxd = () => (
        <div>
            <div className="ui content download-troubleshoot-header">
                {lf("We couldn't find your {0}. Here's a few ways to fix that:", boardName)}
            </div>
        </div>
    );


    return showPairStepAsync({
        confirmAsync,
        jsxd,
        buttonLabel: lf("Try Again"),
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
}: PairStepOptions) {
    let tryAgain = false;

    const buttons: ModalButton[] = [
        {
            label: buttonLabel,
            className: "primary",
            icon: buttonIcon,
            labelPosition: "left",
            onclick: () => {
                pxt.tickEvent(tick);
                core.hideDialog();
                tryAgain = true;
            },
        }
    ];

    if (showDownloadAsFileButton) {
        buttons.unshift({
            label: lf("Download as file"),
            className: "secondary",
            icon: pxt.appTarget.appTheme.downloadIcon || "xicon file-download",
            labelPosition: "left",
            onclick: () => {
                pxt.tickEvent("downloaddialog.button.webusb.preferdownload");
                userPrefersDownloadFlag = true;
                tryAgain = false;
                core.hideDialog();
            },
        });
    }

    await confirmAsync({
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
    const jsx = <div><p>
        {lf("You can unpair your {0} if the WebUSB download is malfunctioning. Click on the lock icon and uncheck your device.", boardName)}
    </p>
        <img className="ui image centered medium" src={"./static/webusb/unpair.gif"} alt={lf("A gif showing how to unpair the {0}", boardName)} />
    </div>

    // TODO: show usb forget here
    const helpUrl = pxt.appTarget.appTheme.usbDocs
        && (pxt.appTarget.appTheme.usbDocs + "/webusb#unpair");
    return { header, jsx, helpUrl };
}


export function clearUserPrefersDownloadFlag() {
    userPrefersDownloadFlag = false;
}

export function userPrefersDownloadFlagSet() {
    return userPrefersDownloadFlag;
}