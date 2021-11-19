import { pushNotificationMessage } from "react-common/Notification"

///////////////////////////////////////////////////////////
////////////       Notification msg           /////////////
///////////////////////////////////////////////////////////

function showNotificationMsg(kind: string, msg: string) {
    pushNotificationMessage({ kind: kind, text: msg, hc: false }); // No high contrast support in skillmap
}

export function errorNotification(msg: string) {
    pxt.tickEvent("notification.error", { message: msg })
    debugger // trigger a breakpoint when a debugger is connected, like in U.oops()
    showNotificationMsg("err", msg)
}

export function warningNotification(msg: string) {
    pxt.log("warning: " + msg)
    showNotificationMsg("warn", msg)
}

export function infoNotification(msg: string) {
    pxt.debug(msg)
    showNotificationMsg("info", msg)
}