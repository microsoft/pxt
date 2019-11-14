import * as React from "react";
import * as core from "./core";
import * as cmds from "./cmds";
import * as codecard from "./codecard";

export function pairAsync(): Promise<void> {
    const webUsb = pxt.usb.isEnabled;
    const webBluetooth = pxt.webBluetooth.hasPartialFlash();

    // not supported
    if (!webUsb && !webBluetooth) return Promise.resolve();
    // only one of each
    if (webUsb && !webBluetooth) return pairUsbAsync();
    if (!webUsb && webBluetooth) return pairBluetoothAsync();
    // multiple pairing options
    return showPairingDialogAsync();
}

function showPairingDialogAsync() {
    return core.dialogAsync({
        header: lf("Pair device for one-click downloads"),
        hasCloseIcon: true,
        hideCancel: true,
        jsx: <div className="ui cards">
            <codecard.CodeCardView
                name={lf("USB")}
                description={lf("Connect via a USB cable.")}
                icon="usb"
                onClick={pairUsbAsync}
            />
            <codecard.CodeCardView
                name={lf("Bluetooth")}
                description={lf("Connect wirelessly using Bluetooth Low Energy.")}
                icon="bluetooth"
                onClick={pairBluetoothAsync}
            />
        </div>
    })
}

function pairLoaderAsync(name: string, pre: () => Promise<void>, result: (success: boolean) => void) {
    core.showLoading("devicepair", lf("Pairing {0} with {1}...", pxt.appTarget.appTheme.boardNickname || pxt.appTarget.appTheme.boardName, name))
    return pre().then(() => {
        result(true);
        core.hideLoading("devicepair")
        core.infoNotification(lf("Device paired! Try downloading now."))
    }, (err: Error) => {
        result(false);
        core.hideLoading("devicepair")
        core.errorNotification(lf("Failed to pair the device: {0}", err.message))
    });
}

let prePairUsbDialogShown = false;
function pairUsbAsync() {
    pxt.tickEvent("pair.usb")
    core.hideDialog();
    if (prePairUsbDialogShown) return pair();

    const prePairAsync = pxt.commands.webUsbPairDialogAsync
        ? pxt.commands.webUsbPairDialogAsync(core.confirmAsync)
        : Promise.resolve(1);
    return prePairAsync.then((res) => {
        if (res) {
            prePairUsbDialogShown = true;
            return pair();
        }
        else return Promise.resolve();
    });

    function pair() {
        return pairLoaderAsync(lf("USB"), () => pxt.usb.pairAsync(), cmds.setWebUSBPaired)
    }
}

function pairBluetoothAsync(): Promise<void> {
    pxt.tickEvent("menu.pair.bluetooth")
    core.hideDialog();
    return pairLoaderAsync(lf("Bluetooth"), () => pxt.webBluetooth.pairAsync(), () => { });
}