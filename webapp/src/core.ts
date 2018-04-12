/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";

import * as coretsx from "./coretsx";

import Cloud = pxt.Cloud;
import Util = pxt.Util;

const lf = Util.lf;

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

export function showLoadingAsync(id: string, msg: string, operation: Promise<any>, delay: number = 700) {
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
    defaultValue: string;
}

export interface DialogOptions {
    hideCancel?: boolean;
    disagreeLbl?: string;
    disagreeClass?: string;
    disagreeIcon?: string;
    logos?: string[];
    header: string;
    body?: string;
    htmlBody?: string;
    input?: string;
    inputValue?: string; // set if input is enabled
    copyable?: string;
    size?: string; // defaults to "small"
    onLoaded?: (_: HTMLElement) => void;
    buttons?: sui.ModalButton[];
    timeout?: number;
    modalContext?: string;
    hasCloseIcon?: boolean;
}

export function dialogAsync(options: DialogOptions): Promise<void> {
    if (!options.hideCancel) {
        if (!options.buttons) options.buttons = [];
        options.buttons.push({
            label: options.disagreeLbl || lf("Cancel"),
            className: (options.disagreeClass || "cancel"),
            icon: options.disagreeIcon || "cancel"
        })
    }

    // let modal = $(html)
    // if (options.copyable) enableCopyable(modal);
    // if (options.input) {
    //     const ip = modal.find('.userinput');
    //     ip.on('change', e => options.inputValue = ip.val() as string)
    // }
    // let done = false
    // let modalContext = options.modalContext || '#root';
    // $(modalContext).append(modal)
    // if (options.onLoaded) options.onLoaded(modal)

    // modal.find('img').on('load', () => {
    //     modal.modal('refresh')
    // });
    // (modal.find(".ui.accordion") as any).accordion()

    return coretsx.renderConfirmDialogAsync(options);

    // return new Promise<void>((resolve, reject) => {
    //     let focusedNodeBeforeOpening = document.activeElement as HTMLElement;
    //     let mo: JQuery;
    //     let timer = options.timeout ? setTimeout(() => {
    //         timer = 0;
    //         mo.modal("hide");
    //     }, options.timeout) : 0;

    //     let onfinish = (elt: JQuery) => {
    //         if (!done) {
    //             done = true
    //             if (timer) clearTimeout(timer);
    //             let id = elt.attr("data-btnid")
    //             if (id) {
    //                 let btn = buttons[+id]
    //                 if (btn.onclick)
    //                     return resolve(btn.onclick())
    //             }
    //             return resolve()
    //         }
    //     }
    //     mo = modal.modal({
    //         observeChanges: true,
    //         closeable: !options.hideCancel,
    //         context: modalContext,
    //         onHidden: () => {
    //             modal.remove();
    //             mo.remove();
    //             if (focusedNodeBeforeOpening != null) {
    //                 focusedNodeBeforeOpening.focus();
    //             }
    //         },
    //         onApprove: onfinish,
    //         onDeny: onfinish,
    //         onHide: () => {
    //             if (!done) {
    //                 done = true
    //                 if (timer) clearTimeout(timer);
    //                 resolve()
    //             }
    //         },
    //         onVisible: () => {
    //             initializeFocusTabIndex(mo.get(0), true);
    //         }
    //     });
    //     mo.modal("show")
    // })
}

export function hideDialog() {
    coretsx.hideDialog();
}

export function confirmAsync(options: ConfirmOptions): Promise<number> {
    if (!options.buttons) options.buttons = []

    let result = 0

    if (!options.hideAgree) {
        options.buttons.push({
            label: options.agreeLbl || lf("Go ahead!"),
            className: options.agreeClass,
            icon: options.agreeIcon || "checkmark",
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

export function confirmDelete(what: string, cb: () => Promise<void>) {
    confirmAsync({
        header: lf("Would you like to delete '{0}'?", what),
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
    if (!options.buttons) options.buttons = []

    let result = "";

    if (!options.hideAgree) {
        options.buttons.push({
            label: options.agreeLbl || lf("Go ahead!"),
            className: options.agreeClass,
            icon: options.agreeIcon || "checkmark",
            onclick: () => {
                let dialogInput = document.getElementById('promptDialogInput') as HTMLInputElement;
                result = dialogInput.value;
            }
        })
    }

    options.htmlBody = `<div class="ui fluid icon input">
                            <input class="focused" type="text" id="promptDialogInput" value="${options.defaultValue}">
                        </div>`;

    options.onLoaded = (ref: HTMLElement) => {
        let dialogInput = document.getElementById('promptDialogInput') as HTMLInputElement;
        if (dialogInput) {
            dialogInput.setSelectionRange(0, 9999);
            dialogInput.onkeyup = (e: KeyboardEvent) => {
                let charCode = (typeof e.which == "number") ? e.which : e.keyCode
                if (charCode === ENTER_KEY) {
                    e.preventDefault();
                    const firstButton = ref.getElementsByClassName("approve positive").item(0) as HTMLElement;
                    if (firstButton) firstButton.click();
                }
            }
        }
    };

    return dialogAsync(options)
        .then(() => result)
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

interface FocusDataEventInfo {
    firstTag: HTMLElement;
    lastTag: HTMLElement;
    targetArea: any;
    giveFocusToLastTagBinding: (e: UIEvent) => any;
    giveFocusToFirstTagBinding: (e: UIEvent) => any;
    noKeyboardNavigation: (e: UIEvent) => any;
}

function unregisterFocusTracking(data: FocusDataEventInfo): void {
    if (!data) {
        return;
    }

    data.firstTag.removeEventListener('keydown', data.targetArea.focusDataInfo.giveFocusToLastTagBinding);
    data.lastTag.removeEventListener('keydown', data.targetArea.focusDataInfo.giveFocusToFirstTagBinding);
    if (data.firstTag === data.lastTag) {
        data.firstTag.removeEventListener('keydown', data.targetArea.focusDataInfo.giveFocusToFirstTagBinding);
        data.lastTag.removeEventListener('keydown', data.targetArea.focusDataInfo.giveFocusToLastTagBinding);
    }
}

function giveFocusToFirstTag(e: KeyboardEvent) {
    let charCode = (typeof e.which == "number") ? e.which : e.keyCode
    if (charCode === TAB_KEY && !e.shiftKey) {
        e.preventDefault();
        unregisterFocusTracking(this);
        initializeFocusTabIndex(this.targetArea, true);
    } else if (!(e.currentTarget as HTMLElement).classList.contains("focused")) {
        unregisterFocusTracking(this);
        initializeFocusTabIndex(this.targetArea, true, false);
    }
}

function giveFocusToLastTag(e: KeyboardEvent) {
    let charCode = (typeof e.which == "number") ? e.which : e.keyCode
    if (charCode === TAB_KEY && e.shiftKey) {
        e.preventDefault();
        unregisterFocusTracking(this);
        initializeFocusTabIndex(this.targetArea, true, false);
        this.lastTag.focus();
    } else if (!(e.currentTarget as HTMLElement).classList.contains("focused")) {
        unregisterFocusTracking(this);
        initializeFocusTabIndex(this.targetArea, true, false);
    }
}

function noKeyboardNavigation(e: KeyboardEvent) {
    let charCode = (typeof e.which == "number") ? e.which : e.keyCode
    if (charCode === TAB_KEY) {
        e.preventDefault();
    }
}

export function initializeFocusTabIndex(element: Element, allowResetFocus = false, giveFocusToFirstElement = true, unregisterOnly = false) {
    if (!allowResetFocus && element !== document.activeElement && element.contains(document.activeElement)) {
        return;
    }

    unregisterFocusTracking((element as any).focusDataInfo);
    if (unregisterOnly) {
        return;
    }

    const focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    //const focused = element.getElementsByClassName("focused");
    if (focusable.length == 0) {
        return;
    }

    const firstFocusable = focusable[0] as HTMLElement;
    const lastFocusable = focusable.length > 1 ? focusable[focusable.length - 1] as HTMLElement : firstFocusable;

    // const firstTag = focused[0] as HTMLElement;
    // const lastTag = focused.length > 1 ? focused[focused.length - 1] as HTMLElement : firstTag;

    let data = <FocusDataEventInfo>{};
    data.firstTag = firstFocusable;
    data.lastTag = lastFocusable;
    data.targetArea = element;
    data.giveFocusToLastTagBinding = giveFocusToLastTag.bind(data);
    data.giveFocusToFirstTagBinding = giveFocusToFirstTag.bind(data);
    data.noKeyboardNavigation = noKeyboardNavigation.bind(data);
    (element as any).focusDataInfo = data;

    if (firstFocusable !== lastFocusable) {
        firstFocusable.addEventListener('keydown', data.giveFocusToLastTagBinding);
        lastFocusable.addEventListener('keydown', data.giveFocusToFirstTagBinding);
    } else {
        firstFocusable.addEventListener('keydown', data.noKeyboardNavigation);
    }

    if (giveFocusToFirstElement) {
        firstFocusable.focus();
    }
}

///////////////////////////////////////////////////////////
////////////       Helper functions           /////////////
///////////////////////////////////////////////////////////

export function navigateInWindow(url: string) {
    window.location.href = url;
}

export function findChild(c: React.Component<any, any>, selector: string) {
    let self = ReactDOM.findDOMNode(c);
    if (!selector) return self
    return self.querySelectorAll(selector);
}

export function parseQueryString(qs: string) {
    let r: pxt.Map<string> = {}
    qs.replace(/\+/g, " ").replace(/([^&=]+)=?([^&]*)/g, (f: string, k: string, v: string) => {
        r[decodeURIComponent(k)] = decodeURIComponent(v)
        return ""
    })
    return r
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
