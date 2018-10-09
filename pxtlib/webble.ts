namespace pxt.webBluetooth {

    export let isEnabled = false

    export function setEnabled(v: boolean) {
        if (!isAvailable()) v = false
        isEnabled = v
    }

    export function isAvailable() {
        return !!navigator.bluetooth
    }


}