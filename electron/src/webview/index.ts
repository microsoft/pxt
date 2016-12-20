"use strict";

import { ipcRenderer } from "electron";
import { WebviewStartMessage } from "../typings/interfaces";

function start(event: Electron.IpcRendererEvent, message: WebviewStartMessage) {
    if (message.devtools) {
        webview.addEventListener("did-stop-loading", () => {
            webview.openDevTools();
        });
    }

    webview.src = `http://localhost:3232/#local_token=${message.localtoken}&electron=1`;
}

const webview: Electron.WebViewElement = <any>document.getElementById("webview");

ipcRenderer.addListener("start", start);