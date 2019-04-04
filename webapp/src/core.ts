/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";

import * as coretsx from "./coretsx";

import Cloud = pxt.Cloud;
import Util = pxt.Util;

export type Component<S, T> = data.Component<S, T>;


///////////////////////////////////////////////////////////
////////////       Loading spinner            /////////////
///////////////////////////////////////////////////////////

let dimmerInitialized = false;
let loadingDimmer: coretsx.LoadingDimmer;

let loadingQueue: string[] = [];
let loadingQueueMsg: pxt.Map<string> = {};

export function isLoading() {
    return loadingDimmer && loadingDimmer.isVisible();
}

export function hideLoading(id: string) {
    pxt.debug("hideloading: " + id);
    if (loadingQueueMsg[id] != undefined) {
        // loading exists, remove from queue
        const index = loadingQueue.indexOf(id);
        if (index > -1) loadingQueue.splice(index, 1);
        delete loadingQueueMsg[id];
    } else {
        pxt.debug("Loading not in queue, disregard: " + id);
    }
    if (loadingQueue.length > 0) {
        // Show the next loading message
        displayNextLoading();
    } else {
        // Hide loading
        if (dimmerInitialized && loadingDimmer) {
            loadingDimmer.hide();
        }
    }
}

export function killLoadingQueue() {
    // Use this with care, only when you want to kill the loading queue
    // and force close them all
    loadingQueue = [];
    loadingQueueMsg = {};
    // Hide loading
    if (dimmerInitialized && loadingDimmer) {
        loadingDimmer.hide();
    }
}

export function showLoading(id: string, msg: string) {
    pxt.debug("showloading: " + id);
    if (loadingQueueMsg[id]) return; // already loading?
    initializeDimmer();
    loadingDimmer.show(lf("Please wait"));
    loadingQueue.push(id);
    loadingQueueMsg[id] = msg;
    displayNextLoading();
}

function displayNextLoading() {
    if (!loadingQueue.length) return;
    const id = loadingQueue[loadingQueue.length - 1]; // get last item
    const msg = loadingQueueMsg[id];
    loadingDimmer.show(msg);
}

function initializeDimmer() {
    if (dimmerInitialized) return;
    const wrapper = document.getElementById('content').appendChild(document.createElement('div'));
    loadingDimmer = ReactDOM.render(React.createElement(coretsx.LoadingDimmer, {}), wrapper);
    dimmerInitialized = true;
}

let asyncLoadingTimeout: pxt.Map<number> = {};

export function showLoadingAsync(id: string, msg: string, operation: Promise<any>, delay: number = 700): Promise<void> {
    clearTimeout(asyncLoadingTimeout[id]);
    asyncLoadingTimeout[id] = setTimeout(function () {
        showLoading(id, msg);
    }, delay);

    return operation.finally(() => {
        cancelAsyncLoading(id);
    });
}

export function cancelAsyncLoading(id: string) {
    clearTimeout(asyncLoadingTimeout[id]);
    hideLoading(id);
}

///////////////////////////////////////////////////////////
////////////       Notification msg           /////////////
///////////////////////////////////////////////////////////

function showNotificationMsg(kind: string, msg: string) {
    coretsx.pushNotificationMessage({ kind: kind, text: msg, hc: highContrast });
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

///////////////////////////////////////////////////////////
////////////       Dialogs (confirm, prompt)  /////////////
///////////////////////////////////////////////////////////

export interface ConfirmOptions extends DialogOptions {
    agreeLbl?: string;
    agreeIcon?: string;
    agreeClass?: string;
    hideAgree?: boolean;
    deleteLbl?: string;
}

export interface PromptOptions extends ConfirmOptions {
    initialValue?: string;
    placeholder?: string;
    onInputChanged?: (newValue?: string) => void;
}

export interface DialogOptions {
    type?: string;
    hideCancel?: boolean;
    disagreeLbl?: string;
    disagreeClass?: string;
    disagreeIcon?: string;
    logos?: string[];
    className?: string;
    header: string;
    body?: string;
    jsx?: JSX.Element;
    copyable?: string;
    size?: string; // defaults to "small"
    onLoaded?: (_: HTMLElement) => void;
    buttons?: sui.ModalButton[];
    timeout?: number;
    modalContext?: string;
    hasCloseIcon?: boolean;
}

export function dialogAsync(options: DialogOptions): Promise<void> {
    if (!options.type) options.type = 'dialog';
    if (!options.hideCancel) {
        if (!options.buttons) options.buttons = [];
        options.buttons.push({
            label: options.disagreeLbl || lf("Cancel"),
            className: (options.disagreeClass || "cancel"),
            icon: options.disagreeIcon || "cancel"
        })
    }
    return coretsx.renderConfirmDialogAsync(options as PromptOptions);
}

export function hideDialog() {
    coretsx.hideDialog();
}

export function confirmAsync(options: ConfirmOptions): Promise<number> {
    options.type = 'confirm';
    if (!options.buttons) options.buttons = []

    let result = 0

    if (!options.hideAgree) {
        options.buttons.push({
            label: options.agreeLbl || lf("Go ahead!"),
            className: options.agreeClass,
            icon: options.agreeIcon || "checkmark",
            approveButton: true,
            onclick: () => {
                result = 1;
            }
        })
    }

    if (options.deleteLbl) {
        options.buttons.push({
            label: options.deleteLbl,
            className: "delete red",
            icon: "trash",
            onclick: () => {
                result = 2
            }
        })
    }

    return dialogAsync(options)
        .then(() => result)
}

export function confirmDelete(what: string, cb: () => Promise<void>, multiDelete?: boolean) {
    confirmAsync({
        header: multiDelete ?
            lf("Would you like to delete {0} projects?", what) :
            lf("Would you like to delete '{0}'?", what),
        body: lf("It will be deleted for good. No undo."),
        agreeLbl: lf("Delete"),
        agreeClass: "red",
        agreeIcon: "trash",
    }).then(res => {
        if (res) {
            cb().done()
        }
    }).done()
}

export function promptAsync(options: PromptOptions): Promise<string> {
    options.type = 'prompt';
    if (!options.buttons) options.buttons = []

    let result = options.initialValue || "";
    let cancelled: boolean = false;

    options.onInputChanged = (v: string) => { result = v };

    if (!options.hideAgree) {
        options.buttons.push({
            label: options.agreeLbl || lf("Go ahead!"),
            className: options.agreeClass,
            icon: options.agreeIcon || "checkmark",
            approveButton: true
        })
    }

    if (!options.hideCancel) {
        // Replace the default cancel button with our own
        options.buttons.push({
            label: options.disagreeLbl || lf("Cancel"),
            className: (options.disagreeClass || "cancel"),
            icon: options.disagreeIcon || "cancel",
            onclick: () => {
                cancelled = true;
            }
        });
        options.hideCancel = true;
    }

    return dialogAsync(options)
        .then(() => cancelled ? null : result);
}

///////////////////////////////////////////////////////////
////////////         Accessibility            /////////////
///////////////////////////////////////////////////////////

export let highContrast: boolean;
export const TAB_KEY = 9;
export const ESC_KEY = 27;
export const ENTER_KEY = 13;
export const SPACE_KEY = 32;

export function setHighContrast(on: boolean) {
    highContrast = on;
}

export function resetFocus() {
    let content = document.getElementById('content');
    content.tabIndex = 0;
    content.focus();
    content.blur();
    content.tabIndex = -1;
}

export function keyCodeFromEvent(e: any) {
    return (typeof e.which == "number") ? e.which : e.keyCode;
}

///////////////////////////////////////////////////////////
////////////       Helper functions           /////////////
///////////////////////////////////////////////////////////

export function navigateInWindow(url: string) {
    window.location.href = url;
}

export function findChild(c: React.Component<any, any>, selector: string): Element[] {
    let self = ReactDOM.findDOMNode(c);
    if (!selector) return [self]
    return pxt.Util.toArray(self.querySelectorAll(selector));
}

export function parseQueryString(qs: string) {
    let r: pxt.Map<string> = {}

    qs.replace(/\+/g, " ").replace(/([^#?&=]+)=([^#?&=]*)/g, (f: string, k: string, v: string) => {
        r[decodeURIComponent(k)] = decodeURIComponent(v)
        return ""
    })
    return r
}

export function stringifyQueryString(url: string, qs: any) {
    for (let k of Object.keys(qs)) {
        if (url.indexOf("?") >= 0) {
            url += "&"
        } else {
            url += "?"
        }
        url += encodeURIComponent(k) + "=" + encodeURIComponent(qs[k])
    }
    return url
}

export function handleNetworkError(e: any, ignoredCodes?: number[]) {
    let statusCode = parseInt(e.statusCode);

    if (e.isOffline || statusCode === 0) {
        warningNotification(lf("Network request failed; you appear to be offline"));
    } else if (!isNaN(statusCode) && statusCode !== 200) {
        if (ignoredCodes && ignoredCodes.indexOf(statusCode) !== -1) {
            return e;
        }
        warningNotification(lf("Network request failed"));
    }

    throw e;
}

///////////////////////////////////////////////////////////
////////////         Javascript console       /////////////
///////////////////////////////////////////////////////////

export function apiAsync(path: string, data?: any) {
    return (data ?
        Cloud.privatePostAsync(path, data) :
        Cloud.privateGetAsync(path))
        .then(resp => {
            console.log("*")
            console.log("*******", path, "--->")
            console.log("*")
            console.log(resp)
            console.log("*")
            return resp
        }, err => {
            console.log(err.message)
        })
}
