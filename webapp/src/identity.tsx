import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as coretsx from "./coretsx";
import * as pkg from "./package";
import * as auth from "./auth";

import Cloud = pxt.Cloud;
import Util = pxt.Util;
import { loadGifEncoderAsync } from "./screenshot";

type IdpInfo = {
    displayName: string;
};

type IdpInfos = {
    [id in pxt.IdentityProviderId]: IdpInfo;
};

const idpInfos: IdpInfos = {
    "makecode": {
        displayName: lf("MakeCode")
    },
    "microsoft": {
        displayName: lf("Microsoft")
    },
    "google": {
        displayName: lf("Google")
    },
    "github": {
        displayName: lf("GitHub")
    }
};

export function showLoginDialogAsync(projectView: pxt.editor.IProjectView, callbackHash: string) {
    const targetTheme = pxt.appTarget.appTheme;

    const buttons: sui.ModalButton[] = [];

    const login = (idp: pxt.IdentityProviderId, rememberMe: boolean) => auth.startLogin(idp, rememberMe, callbackHash);

    // TODO: Add "Remember Me" checkbox
    pxt.targetConfigAsync()
        .then(config => {
            return core.confirmAsync({
                header: lf("Login"),
                hasCloseIcon: true,
                agreeLbl: lf("Cancel"),
                agreeClass: "cancel",
                buttons,
                jsxd: () => {
                    return (<div>
                        Login with:
                        {pxt.appTarget.auth.providers.map(id => {
                            const idpInfo = idpInfos[id];
                            if (!idpInfo) return null;
                            return (
                                <>
                                    <br></br>
                                    <a onClick={() => login(id, false)}>{idpInfo.displayName}</a>
                                </>
                            );
                        }).filter(item => !!item)}
                    </div>)
                }
            });
        }).done();
}