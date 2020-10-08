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

    // TODO: implement remember me correctly. This form should be done with a real react component.
    let rememberMe: boolean = Math.random() > 0.5;

    const buttons: sui.ModalButton[] = [];
    let loginUrl = (provider: string) => `${pxt.Cloud.apiRoot}signin?provider=${provider}&rememberMe=${rememberMe}`;

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
                    <a target="_blank" rel="noopener noreferrer" href={loginUrl("microsoft")}>Microsoft</a>
                    <br></br>
                    <a target="_blank" rel="noopener noreferrer" href={loginUrl("github")}>GitHub</a>
                    <br></br>
                    <a target="_blank" rel="noopener noreferrer" href={loginUrl("google")}>Google</a>
                    <br></br>
                    <input type="checkbox" id="rememberMe" name="rememberMe" checked={rememberMe} disabled />
                    <label htmlFor="rememberMe">Remember me?</label>
                </div>
            })
        }).done();
}