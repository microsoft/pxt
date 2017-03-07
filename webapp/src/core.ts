/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";

import Cloud = pxt.Cloud;
import Util = pxt.Util;

const lf = Util.lf;

export type Component<S, T> = data.Component<S, T>;

export function hideLoading() {
    $('.ui.page.dimmer .loadingcontent').remove();
    $('body.main').dimmer('hide');
}

export function showLoading(msg: string) {
    $('body.main').dimmer({
        closable: false
    });
    $('body.main').dimmer('show');
    $('.ui.page.dimmer').html(`
  <div class="content loadingcontent">
    <div class="ui text large loader msg">{lf("Please wait")}</div>
  </div>
`)
    $('.ui.page.dimmer .msg').text(msg)
}

let asyncLoadingTimeout: number;

export function showLoadingAsync(msg: string, operation: Promise<any>, delay: number = 700) {
    clearTimeout(asyncLoadingTimeout);
    asyncLoadingTimeout = setTimeout(function () {
        showLoading(msg);
    }, delay);

    return operation.finally(() => {
        cancelAsyncLoading();
    });
}

export function cancelAsyncLoading() {
    clearTimeout(asyncLoadingTimeout);
    hideLoading();
}

export function navigateInWindow(url: string) {
    window.location.href = url;
}

export function findChild(c: React.Component<any, any>, selector: string) {
    let self = $(ReactDOM.findDOMNode(c))
    if (!selector) return self
    return self.find(selector)
}

export function parseQueryString(qs: string) {
    let r: pxt.Map<string> = {}
    qs.replace(/\+/g, " ").replace(/([^&=]+)=?([^&]*)/g, (f: string, k: string, v: string) => {
        r[decodeURIComponent(k)] = decodeURIComponent(v)
        return ""
    })
    return r
}

let lastTime: any = {}

function htmlmsg(kind: string, msg: string) {
    let now = Date.now()
    let prev = lastTime[kind] || 0
    if (now - prev < 100)
        $('#' + kind + 'msg').text(msg);
    else {
        lastTime[kind] = now
        $('#' + kind + 'msg').finish().text(msg).fadeIn('fast').delay(3000).fadeOut('slow');
    }
}

export function errorNotification(msg: string) {
    pxt.tickEvent("notification.error", { message: msg })
    htmlmsg("err", msg)
}

export function warningNotification(msg: string) {
    pxt.log("warning: " + msg)
    htmlmsg("warn", msg)
}

export function infoNotification(msg: string) {
    pxt.debug(msg)
    htmlmsg("info", msg)
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

export interface ButtonConfig {
    label: string;
    icon?: string; // defaults to "checkmark"
    class?: string; // defaults "positive"
    onclick?: () => (Promise<void> | void);
    url?: string;
    fileName?: string;
}

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
    copyable?: string;
    size?: string; // defaults to "small"
    onLoaded?: (_: JQuery) => void;
    buttons?: ButtonConfig[];
    timeout?: number;
}

export function dialogAsync(options: DialogOptions): Promise<void> {
    const buttons = options.buttons ? options.buttons.filter(b => !!b) : undefined;

    let logos = (options.logos || [])
        .filter(logo => !!logo)
        .map(logo => `<img class="ui logo" src="${Util.toDataUri(logo)}" />`)
        .join(' ');
    let html = `
  <div class="ui ${options.size || "small"} modal">
    <div class="header">
        ${Util.htmlEscape(options.header)}
    </div>
    <div class="content">
      ${options.body ? "<p>" + Util.htmlEscape(options.body) + "</p>" : ""}
      ${options.htmlBody || ""}
      ${options.copyable ? `<div class="ui fluid action input">
         <input class="linkinput" readonly spellcheck="false" type="text" value="${Util.htmlEscape(options.copyable)}">
         <button class="ui teal right labeled icon button copybtn" data-content="${lf("Copied!")}">
            ${lf("Copy")}
            <i class="copy icon"></i>
         </button>
      </div>` : ``}
    </div>`
    html += `<div class="actions">`
    html += logos;

    if (!options.hideCancel) {
        buttons.push({
            label: options.disagreeLbl || lf("Cancel"),
            class: options.disagreeClass || "cancel",
            icon: options.disagreeIcon || "cancel"
        })
    }

    let btnno = 0
    for (let b of buttons) {
        html += `
      <${b.url ? "a" : "button"} class="ui right labeled icon button approve ${b.class || "positive"}" data-btnid="${btnno++}" ${b.url ? `href="${b.url}"` : ""} ${b.fileName ? `download="${Util.htmlEscape(b.fileName)}"` : ''} target="_blank">
        ${Util.htmlEscape(b.label)}
        <i class="${b.icon || "checkmark"} icon"></i>
      </${b.url ? "a" : "button"}>`
    }

    html += `</div>`
    html += `</div>`

    let modal = $(html)
    if (options.copyable) enableCopyable(modal);
    let done = false
    $('#root').append(modal)
    if (options.onLoaded) options.onLoaded(modal)

    modal.find('img').on('load', () => {
        modal.modal('refresh')
    });
    (modal.find(".ui.accordion") as any).accordion()

    return new Promise<void>((resolve, reject) => {
        let mo: JQuery;
        let timer = options.timeout ? setTimeout(() => {
            timer = 0;
            mo.modal("hide");
        }, options.timeout) : 0;

        let onfinish = (elt: JQuery) => {
            if (!done) {
                done = true
                if (timer) clearTimeout(timer);
                let id = elt.attr("data-btnid")
                if (id) {
                    let btn = buttons[+id]
                    if (btn.onclick)
                        return resolve(btn.onclick())
                }
                return resolve()
            }
        }
        mo = modal.modal({
            observeChanges: true,
            closeable: !options.hideCancel,
            context: "#root",
            onHidden: () => {
                modal.remove();
                mo.remove();
            },
            onApprove: onfinish,
            onDeny: onfinish,
            onHide: () => {
                if (!done) {
                    done = true
                    if (timer) clearTimeout(timer);
                    resolve()
                }
            },
        });
        mo.modal("show")
    })
}

export function hideDialog() {
    $('.modal').modal("hide");
}

export function confirmAsync(options: ConfirmOptions): Promise<number> {
    if (!options.buttons) options.buttons = []

    let result = 0

    if (!options.hideAgree) {
        options.buttons.push({
            label: options.agreeLbl || lf("Go ahead!"),
            class: options.agreeClass,
            icon: options.agreeIcon,
            onclick: () => {
                result = 1
            }
        })
    }

    if (options.deleteLbl) {
        options.buttons.push({
            label: options.deleteLbl,
            class: "delete red",
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

    let result = options.defaultValue;

    if (!options.hideAgree) {
        options.buttons.push({
            label: options.agreeLbl || lf("Go ahead!"),
            class: options.agreeClass,
            icon: options.agreeIcon,
            onclick: () => {
                let dialogInput = document.getElementById('promptDialogInput') as HTMLInputElement;
                result = dialogInput.value;
            }
        })
    }

    options.htmlBody = `<div class="ui fluid icon input">
                            <input type="text" id="promptDialogInput" placeholder="${options.defaultValue}">
                        </div>`;

    options.onLoaded = () => {
        let dialogInput = document.getElementById('promptDialogInput') as HTMLInputElement;
        if (dialogInput) {
            dialogInput.focus();
        }
    };

    return dialogAsync(options)
        .then(() => result)
}

export interface ShareOptions {
    header: string;
    body?: string;
    link: string;
    okClass?: string;
    okIcon?: string;
    okLabel?: string;
}

export function shareLinkAsync(options: ShareOptions) {
    let html = `
  <div class="ui small modal">
    <div class="header">
        ${Util.htmlEscape(options.header)}
    </div>
    <div class="content">
      <p>${Util.htmlEscape(options.body || "")}</p>
      <div class="ui fluid action input">
         <input class="linkinput" readonly spellcheck="false" type="text" value="${Util.htmlEscape(options.link)}">
         <button class="ui teal right labeled icon button copybtn" data-content="${lf("Copied!")}">
            ${lf("Copy")}
            <i class="copy icon"></i>
         </button>
      </div>
    </div>
    <div class="actions">
      <div class="ui approve right labeled icon button ${options.okClass || "teal"}">
        ${Util.htmlEscape(options.okLabel || lf("Ok"))}
        <i class="${options.okIcon || "checkmark"} icon"></i>
      </div>
    </div>
  </div>
  `
    let modal = $(html)
    enableCopyable(modal);
    let done = false
    $('body.main').append(modal)

    return new Promise((resolve, reject) =>
        modal.modal({
            onHidden: () => {
                modal.remove()
            },
            onHide: () => {
                if (!done) {
                    done = true
                    resolve(false)
                }
            },
        }).modal("show"))
}

function enableCopyable(modal: JQuery) {
    let btn = modal.find('.copybtn')
    btn.click(() => {
        try {
            let inp = modal.find('.linkinput')[0] as HTMLInputElement;
            inp.focus();
            inp.setSelectionRange(0, inp.value.length);
            document.execCommand("copy");
            btn.popup({
                on: "manual",
                inline: true
            })
            btn.popup("show")
        } catch (e) {
        }
    })
}

export function scrollIntoView(item: JQuery, margin = 0) {
    if (!item.length) return;

    let parent = item.offsetParent();

    let itemTop = Math.max(item.position().top - margin, 0);
    let itemBottom = item.position().top + item.outerHeight(true) + margin;
    let selfTop = $(parent).scrollTop();
    let selfH = $(parent).height();
    let newTop = selfTop;

    if (itemTop < selfTop) {
        newTop = itemTop;
    } else if (itemBottom > selfTop + selfH) {
        newTop = itemBottom - selfH;
    }

    if (newTop != selfTop) {
        parent.scrollTop(newTop)
        //parent.animate({ 'scrollTop': newTop }, 'fast');
    }
}

// for JavaScript console
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
