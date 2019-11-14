import * as React from "react";
import * as pkg from "./package";
import * as srceditor from "./srceditor"
import * as sui from "./sui";
import * as core from "./core";
import * as cmds from "./cmds";

export function pairAsync() {
    const webUsb = pxt.usb.isEnabled;
    const webBluetooth = pxt.webBluetooth.hasPartialFlash();

    // not supported
    if (!webUsb && !webBluetooth) return Promise.resolve();
    // only one of each
    if (webUsb && !webBluetooth) return pairUsbAsync();
    if (!webUsb && webBluetooth) return pairBluetoothAsync();
    // multiple pairing options
    return Promise.resolve();
}

function pairUsbAsync() {
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

function pairBluetoothAsync() {
    pxt.tickEvent("menu.pair.bluetooth")
    core.showLoading("webblepair", lf("Pairing Bluetooth device..."))
    pxt.webBluetooth.pairAsync()
        .then(() => {
            core.infoNotification(lf("Device paired! Try downloading now."))
            core.hideLoading("webblepair")
        });
}