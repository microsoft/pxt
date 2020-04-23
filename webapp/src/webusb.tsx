import * as React from "react";
import * as core from "./core";
import * as cmds from "./cmds";

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

export function webUsbPairDialogAsync(pairAsync: () => Promise<boolean>, confirmAsync: (options: core.PromptOptions) => Promise<number>): Promise<number> {
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
                            <strong>{lf("Connect {0} to computer with USB cable", boardName)}</strong>
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
        const confirmOptions = () => {
            return {
                header: lf("Pair device for one-click downloads"),
                jsxd,
                hasCloseIcon: true,
                hideAgree: true,
                hideCancel: true,
                helpUrl,
                className: 'downloaddialog',
                buttons: [
                    {
                        label: lf("Pair device"),
                        icon: "usb",
                        className: "primary",
                        onclick: () => {
                            core.showLoading("pair", lf("Select your device and press \"Connect\"."))
                            pairAsync()
                                .finally(() => {
                                    core.hideLoading("pair")
                                    core.hideDialog();
                                })
                                .then(paired => {
                                    if (paired || failedOnce) {
                                        resolve(paired ? 1 : 0)
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

export function renderUnpairDialog() {
    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    const header = lf("How to unpair your {0}", boardName);
    const jsx = <div><p>
        {lf("You can unpair your {0} if the WebUSB download is malfunctioning. Click on the lock icon and uncheck your device.", boardName)}
    </p>
        <img className="ui image centered medium" src={"./static/webusb/unpair.gif"} alt={lf("A gif showing how to unpair the {0}", boardName)} />
    </div>
    const helpUrl = pxt.appTarget.appTheme.usbDocs
        && (pxt.appTarget.appTheme.usbDocs + "/webusb#unpair");
    return { header, jsx, helpUrl };
}