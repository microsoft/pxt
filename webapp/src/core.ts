import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";

let dimmer = `
<div class="ui page dimmer">
  <div class="content">
    <div class="ui text large loader msg">Please wait</div>
  </div>
</div>
`

var lf = Util.lf;

export type Component<S, T> = data.Component<S, T>;

export function showLoading(msg: string) {
    let over = $(dimmer)
    over.find(".msg").text(msg)
    $(document.body).append(over)
    over.dimmer("show")
    return over
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
    var buf = Util.stringToUint8Array(Util.toUTF8(text))
    browserDownloadUInt8Array(buf, name, contentType);
}

export var isMobileBrowser = /mobile/.test(navigator.userAgent);

export function browserDownloadUInt8Array(buf: Uint8Array, name: string, contentType: string = "application/octet-stream") {
    try {
        if ((<any>window).navigator.msSaveOrOpenBlob && !isMobileBrowser) {
            var b = new Blob([buf], { type: contentType })
            var result = (<any>window).navigator.msSaveOrOpenBlob(b, name);
        } else {
            var link = <any>window.document.createElement('a');
            var dataurl = "data:" + contentType + ";base64," + btoa(Util.uint8ArrayToString(buf)) 
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
}

export function handleNetworkError(e:any) {
    let statusCode = <number> e.status
    if (e.isOffline) {
        warningNotification(lf("Network request failed; you appear to be offline"))
    }
}

