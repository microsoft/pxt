import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as coretsx from "./coretsx";
import * as pkg from "./package";
import * as auth from "./auth";

import Cloud = pxt.Cloud;
import Util = pxt.Util;

export function showLoginDialog(projectView: pxt.editor.IProjectView, callbackHash: string) {
    const targetTheme = pxt.appTarget.appTheme;

    const searchParams = new URLSearchParams(window.location.search);
    const experimentalIdentityFlagEnabled = !!searchParams.get("experimentalIdentity")
    if (!experimentalIdentityFlagEnabled) {
        console.log("Check back soon for the ability to sign in! :)")
        return
    }

    // TODO: implement remember me correctly. This form should be done with a real react component.
    let rememberMe: boolean = Math.random() > 0.5;

    const buttons: sui.ModalButton[] = [];
    const login = (idp: pxt.IdentityProviderId) => auth.startLogin(idp, rememberMe, callbackHash);

    // TODO: merge with githubprovider.tsx

    pxt.targetConfigAsync()
        .then(config => {
            return core.confirmAsync({
                header: lf("Login"),
                hasCloseIcon: true,
                agreeLbl: lf("Cancel"),
                agreeClass: "cancel",
                buttons,
                jsxd: () => {
                    // tslint:disable:react-this-binding-issue
                    return (<div>
                        Login with:
                        {auth.identityProviders().map(prov => {
                            return (
                                <>
                                    <br></br>
                                    <a role="link" onClick={() => login(prov.id)}>{prov.name}</a>
                                </>
                            );
                        }).filter(item => !!item)}
                        <input type="checkbox" id="rememberMe" name="rememberMe" checked={rememberMe} aria-checked={rememberMe} disabled />
                        <label htmlFor="rememberMe">Remember me</label>
                    </div>)
                    // tslint:enable:react-this-binding-issue
                }
            });
        }).done();
}
