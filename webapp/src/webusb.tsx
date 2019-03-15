import * as React from "react";
import * as core from "./core";
import * as cmds from "./cmds";

function firmwareUrlAsync(): Promise<string> {
    return pxt.targetConfigAsync()
        .then(config => {
            const firmwareUrl = (config.firmwareUrls || {})[
                pxt.appTarget.simulator.boardDefinition ? pxt.appTarget.simulator.boardDefinition.id
                    : ""];
            return firmwareUrl;
        });
}

export function showWebUSBPairingInstructionsAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.tickEvent(`webusb.pair`);
    return firmwareUrlAsync()
        .then(firmwareUrl => {
            const boardName = pxt.appTarget.appTheme.boardName || lf("device");
            const jsx =
                <div className={`ui ${firmwareUrl ? "four" : "three"} column grid stackable`}>
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

            return core.confirmAsync({
                header: lf("Pair your {0}", boardName),
                agreeLbl: lf("Let's pair it!"),
                size: "",
                className: "webusbpair",
                jsx: jsx
            }).then(r => {
                if (!r) {
                    if (resp)
                        return cmds.browserDownloadDeployCoreAsync(resp)
                    else
                        pxt.U.userError(pxt.U.lf("Device not paired"))
                }
                if (!resp)
                    return pxt.usb.pairAsync()
                return pxt.usb.pairAsync()
                    .then(() => {
                        pxt.tickEvent(`webusb.pair.success`);
                        return cmds.hidDeployCoreAsync(resp)
                    })
                    .catch(e => cmds.browserDownloadDeployCoreAsync(resp));
            })
        });
}

let askPairingCount = 0;
function askWebUSBPairAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.tickEvent(`webusb.askpair`);
    askPairingCount++;
    if (askPairingCount > 3) { // looks like this is not working, don't ask anymore
        pxt.tickEvent(`webusb.askpaircancel`);
        return cmds.browserDownloadDeployCoreAsync(resp);
    }

    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    return core.confirmAsync({
        header: lf("No device detected..."),
        jsx: <div><p><strong>{lf("Do you want to pair your {0} to the editor?", boardName)}</strong></p>
            <p>{lf("You will get one-click downloads and data logging.")}</p></div>,
    }).then(r => r ? showWebUSBPairingInstructionsAsync(resp) : cmds.browserDownloadDeployCoreAsync(resp));
}

export function webUsbDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.tickEvent(`webusb.deploy`)
    return cmds.hidDeployCoreAsync(resp)
        .catch(e => askWebUSBPairAsync(resp));
}
