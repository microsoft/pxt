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
    let ok = 0;
    const firmwareUrl = resolveFirmwareUrl();
    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    const helpUrl = pxt.appTarget.appTheme.usbDocs;
    const jsx = pxt.commands?.renderUsbPairDialog(firmwareUrl)
        || <div className={`ui ${firmwareUrl ? "four" : "three"} column grid stackable`}>
            {firmwareUrl ? <div className="column firmware">
                <div className="ui">
                    <div className="content">
                        <div className="description">
                            {lf("First time here?")}
                            <br />
                            <a href={firmwareUrl} target="_blank" rel="noopener noreferrer">{lf("Check your firmware version and update if needed")}</a>
                        </div>
                    </div>
                </div>
            </div>
                : undefined}
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

    return confirmAsync({
        header: lf("Pair device for one-click downloads"),
        jsx,
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
                    core.showLoading("pair", lf("Select device and press 'Connect'..."));
                    pairAsync()
                        .then(r => ok = !!r ? 1 : 0)
                        .finally(() => {
                            core.hideLoading("pair")
                            core.hideDialog();
                        });
                }
            }
        ]
    }).then(() => ok);
}
