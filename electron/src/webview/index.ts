"use strict";

import { ipcRenderer, shell } from "electron";
import { WebviewStartMessage } from "../typings/interfaces";
import * as url from "url";

function start(event: Electron.IpcRendererEvent, message: WebviewStartMessage) {
    if (message.devtools) {
        webview.addEventListener("did-stop-loading", () => {
            webview.openDevTools();
        });
    }

    webview.src = `http://localhost:${message.serverPort}/#ws=${message.wsPort}&local_token=${message.localtoken}&electron=1`;
}

function openInBrowser(event: Electron.WebViewElement.NewWindowEvent | Electron.WebViewElement.WillNavigateEvent): void {
    const currentUrl = url.parse(webview.src);
    const newUrl = url.parse(event.url)

    if (newUrl.host !== currentUrl.host || newUrl.pathname !== currentUrl.pathname) {
        console.log("Opening external URL: " + event.url);
        event.preventDefault();
        shell.openExternal(event.url);
    }
}

const webview: Electron.WebViewElement = <any>document.getElementById("webview");

webview.addEventListener('will-navigate', openInBrowser);
webview.addEventListener('new-window', openInBrowser);
ipcRenderer.addListener("start", start);