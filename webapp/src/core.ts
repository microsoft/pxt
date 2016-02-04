import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as apicache from "./apicache";
import * as pkg from "./package";

let dimmer = `
<div class="ui page dimmer">
  <div class="content">
    <div class="ui text large loader msg">Please wait</div>
  </div>
</div>
`

export function showLoading(msg:string) {
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
    return $(ReactDOM.findDOMNode(c)).find(selector)
}

export class Component<T, S> extends React.Component<T, S> {
    constructor(props: T) {
        super(props);
    }
    
    child(selector:string) {
        return findChild(this, selector)
    }
}

export function parseQueryString(qs: string) {
    let r: Util.StringMap<string> = {}
    qs.replace(/\+/g, " ").replace(/([^&=]+)=?([^&]*)/g, (f: string, k: string, v: string) => {
        r[decodeURIComponent(k)] = decodeURIComponent(v)
        return ""
    })
    return r
}

function htmlmsg(kind:string, msg:string) {
    $('#' + kind + 'msg').finish().text(msg).fadeIn('fast').delay(3000).fadeOut('slow');
}

export function errorNotification(msg:string) {
    console.log("ERROR", msg)
    htmlmsg("err", msg)    
}

export function warningNotification(msg:string) {
    console.log("WARNING", msg)
    htmlmsg("warn", msg)    
}

export function infoNotification(msg:string) {
    console.log("INFO", msg)
    htmlmsg("info", msg)    
}

