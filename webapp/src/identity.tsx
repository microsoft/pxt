import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as coretsx from "./coretsx";
import * as pkg from "./package";
import * as cloudsync from "./cloudsync";

import Cloud = pxt.Cloud;
import Util = pxt.Util;

export function showLoginDialogAsync(projectView: pxt.editor.IProjectView) {
    const targetTheme = pxt.appTarget.appTheme;

    const buttons: sui.ModalButton[] = [];
    let loginUrl = (provider: string) => `${pxt.Cloud.apiRoot}login?provider=${provider}`;

    // TODO: merge with githubprovider.tsx
    pxt.targetConfigAsync()
        .then(config => {
            return core.confirmAsync({
                header: lf("Login"),
                hasCloseIcon: true,
                agreeLbl: lf("Cancel"),
                agreeClass: "cancel",
                buttons,
                jsx: <div>
                    Login with:
                    <br></br>
                    <a target="_blank" rel="noopener noreferrer" href={loginUrl("ms")}>Microsoft</a>
                    <br></br>
                    <a target="_blank" rel="noopener noreferrer" href={loginUrl("github")}>GitHub</a>
                    <br></br>
                    <a target="_blank" rel="noopener noreferrer" href={loginUrl("goog")}>Google</a>
                    <br></br>
                </div>
            })
        }).done();
}