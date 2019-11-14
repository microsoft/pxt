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
        header: lf("Pair device"),
        hasCloseIcon: true,
        jsx: <div className="ui cards">
            <codecard.CodeCardView
                header={lf("USB")}
                description={lf("Connect via a USB cable.")}
                icon="usb"
                onClick={pairUsbAsync}
             />
            <codecard.CodeCardView
                header={lf("Bluetooth")}
                description={lf("Connect wirelessly using Bluetooth Low Energy.")}
                icon="bluetooth"
                onClick={pairBluetoothAsync}
             />
        </div>
    })
}

function pairUsbAsync() {
    pxt.tickEvent("pair.usb")
    const prePairAsync = pxt.commands.webUsbPairDialogAsync
        ? pxt.commands.webUsbPairDialogAsync(core.confirmAsync)
        : Promise.resolve(1);
    return prePairAsync.then((res) => {
        if (res) {
            return pxt.usb.pairAsync()
                .then(() => {
                    cmds.setWebUSBPaired(true);
                    core.infoNotification(lf("Device paired! Try downloading now."))
                }, (err: Error) => {
                    core.errorNotification(lf("Failed to pair the device: {0}", err.message))
                });
        }
        return Promise.resolve();
    });
}

function pairBluetoothAsync(): Promise<void> {
    pxt.tickEvent("menu.pair.bluetooth")
    core.showLoading("webblepair", lf("Pairing Bluetooth device..."))
    return pxt.webBluetooth.pairAsync()
        .then(() => {
            core.infoNotification(lf("Device paired! Try downloading now."))
            core.hideLoading("webblepair")
        });
}