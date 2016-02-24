import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";

var lf = Util.lf;

export type Component<S, T> = data.Component<S, T>;

export function hideLoading() {
    $('.ui.page.dimmer .loadingcontent').remove();
    $('body').dimmer('hide');
}

export function showLoading(msg: string) {
    $('body').dimmer('show');
    $('.ui.page.dimmer').html(`
  <div class="content loadingcontent">
    <div class="ui text large loader msg">{lf("Please wait")}</div>
  </div>
`)
    $('.ui.page.dimmer .msg').text(msg)
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
    let r: Util.StringMap<string> = {}
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
    console.log("ERROR", msg)
    htmlmsg("err", msg)
}

export function warningNotification(msg: string) {
    console.log("WARNING", msg)
    htmlmsg("warn", msg)
}

export function infoNotification(msg: string) {
    console.log("INFO", msg)
    htmlmsg("info", msg)
}

export function browserDownloadText(text: string, name: string, contentType: string = "application/octet-stream") {
    console.log('trigger download')
    var buf = Util.stringToUint8Array(Util.toUTF8(text))
    var uri = browserDownloadUInt8Array(buf, name, contentType);
}

export var isMobileBrowser = /mobile/.test(navigator.userAgent);

function browserDownloadUInt8Array(buf: Uint8Array, name: string, contentType: string = "application/octet-stream"): string {
    var dataurl = "data:" + contentType + ";base64," + btoa(Util.uint8ArrayToString(buf))
    try {
        if ((<any>window).navigator.msSaveOrOpenBlob && !isMobileBrowser) {
            var b = new Blob([buf], { type: contentType })
            var result = (<any>window).navigator.msSaveOrOpenBlob(b, name);
        } else {
            var link = <any>window.document.createElement('a');
            if (typeof link.download == "string") {
                link.href = dataurl;
                link.download = name;
                document.body.appendChild(link); // for FF
                link.click();
                document.body.removeChild(link);
            } else {
                document.location.href = dataurl;
            }
        }
    } catch (e) {
        errorNotification(lf("saving file failed..."))
    }
    return dataurl;
}

export function handleNetworkError(e: any) {
    let statusCode = <number>e.status
    if (e.isOffline) {
        warningNotification(lf("Network request failed; you appear to be offline"))
    } else {
        throw e;
    }
}

export interface ConfirmOptions {
    header: string;
    body?: string;
    htmlBody?:string;
    agreeLbl?: string;
    disagreeLbl?: string;
    agreeIcon?: string;
    agreeClass?: string;
}

export function confirmAsync(options: ConfirmOptions) {
    let html = `
  <div class="ui small modal">
    <div class="header">
        ${Util.htmlEscape(options.header)}      
    </div>
    <div class="content">
      <p>${Util.htmlEscape(options.body || "")}</p>
      ${options.htmlBody || ""}
    </div>
    <div class="actions">
      <div class="ui right labeled icon button">
        ${Util.htmlEscape(options.disagreeLbl || lf("Cancel"))}
        <i class="cancel icon"></i>
      </div>
      <div class="ui approve right labeled icon button ${options.agreeClass || "positive"}">
        ${Util.htmlEscape(options.agreeLbl || lf("Go ahead!"))}
        <i class="${options.agreeIcon || "checkmark"} icon"></i>
      </div>
    </div>
  </div>
  `
    let modal = $(html)
    let done = false
    $('#root').append(modal)

    return new Promise((resolve, reject) =>
        modal.modal({
            onHidden: () => {
                modal.remove()
            },
            onApprove: () => {
                if (!done) {
                    done = true
                    resolve(true)
                }
            },
            onHide: () => {
                if (!done) {
                    done = true
                    resolve(false)
                }
            },
        }).modal("show"))
}

export function confirmDelete(what: string, cb: () => Promise<void>) {
    confirmAsync({
        header: lf("Are you sure to delete '{0}'?", what),
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
         <input class="linkinput" type="text" value="${Util.htmlEscape(options.link)}">
         <button class="ui teal right labeled icon button copybtn" data-content="${lf("Copied!")}">
            ${lf("Copy")}
            <i class="copy icon"></i>
         </button>
      </div>
    </div>
    <div class="actions">
      <div class="ui approve right labeled icon button ${options.okClass || "teal"}">
        ${Util.htmlEscape(options.okLabel || lf("OK"))}
        <i class="${options.okIcon || "checkmark"} icon"></i>
      </div>
    </div>
  </div>
  `
    let modal = $(html)
    let btn = modal.find('.copybtn')
    btn.click(() => {
        let inp = modal.find('.linkinput');
        (inp[0] as HTMLInputElement).setSelectionRange(0, inp.val().length);
        try {
            document.execCommand("copy");
            btn.popup({
                on: "manual",
                inline: true
            })
            btn.popup("show")
        } catch (e) {
        }
    })
    let done = false
    $('body').append(modal)

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

