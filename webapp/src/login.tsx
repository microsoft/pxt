import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";

import Cloud = pxt.Cloud;
import Util = pxt.Util;

export interface ILoginBoxProps {
}

export interface ILoginBoxState {
}


const lf = Util.lf

export function showDeleteAccountDialog() {
    core.confirmAsync({
        header: lf("Would you like to delete your account?"),
        htmlBody: `<div class="ui inverted red segment">${lf("DANGER ZONE")}</div>
        <p>${lf("Your account and all published packages will be deleted from all PXT-based web sites <emph>without the posibility of recovery</emph>.")}</p>
        `,
        agreeLbl: lf("Delete my account"),
        agreeClass: "red",
        agreeIcon: "trash",
    }).then(res => {
        if (res) {
            core.showLoading(lf("deleting your account..."));
            Cloud.privateDeleteAsync("me")
                .then(() => {
                    core.hideLoading();
                    LoginBox.signout();
                }).catch(e => {
                    core.hideLoading();
                    core.errorNotification(lf("Oops, we could not delete your account."));
                })
        }
    }).done()
}

export class LoginBox extends data.Component<ILoginBoxProps, ILoginBoxState> {
    static signingOut = false;

    signin(addParameters = "") {

        let m = /u=\w+/.exec(document.URL);
        if (m)
            addParameters = "&" + m[0];

        let uid = Cloud.getUserId()
        if (uid) addParameters = "&u=" + encodeURIComponent(uid)

        let oauthState = Util.guidGen();
        pxt.storage.setLocal("oauthState", oauthState);

        let hereUrl = window.location.href;
        let url = Cloud.getServiceUrl() + "/oauth/dialog?response_type=token&client_id=" +
            encodeURIComponent("webapp3") +
            "&redirect_uri=" + encodeURIComponent(hereUrl) +
            "&state=" + encodeURIComponent(oauthState) + addParameters;

        core.showLoading(lf("signing in..."))

        core.navigateInWindow(url);
    }

    static signout() {
        core.confirmAsync({
            header: lf("Reset"),
            body: lf("You are about to clear all projects. Are you sure? This operation cannot be undone."),
            agreeLbl: lf("Reset"),
            agreeClass: "red",
            agreeIcon: "sign out",
            disagreeLbl: lf("Cancel")
        }).then(r => {
            if (!r) return;

            LoginBox.signingOut = true;
            core.showLoading(lf("signing out..."))
            workspace.resetAsync()
                .then(() => Cloud.privatePostAsync("logout", {}))
                .catch((e: any) => { })
                .then(() => {
                    window.location.reload()
                })
                .done()
        });
    }

    options() {

    }

    static showUserPropertiesAsync(settings: Cloud.UserSettings) {
        return core.confirmAsync({
            header: lf("{0}: user settings", Util.htmlEscape(settings.nickname)),
            htmlBody:
            `<p>Hi ${Util.htmlEscape(settings.nickname)}, manage your account and assets using the <code>pxt</code> command line.</p>
<ul>
<li>install the <code>pxt</code> command line and login following the on-screen instructions
<pre>
npm install -g pxt
pxt login
</pre>
</li>
<li>delete your account <emph>(NO UNDO!)</emph> and related packages.
<pre>
pxt api me delete
</pre>
</li>
<li>list all your packages
<pre>
pxt api me/pointers
</pre>
</li>
<li>delete a particular package
<pre>
pxt api PACKAGEID delete
</pre>
</li>
</ul>
`,
            agreeLbl: lf("Got it!"),
            disagreeLbl: lf("Sign out"),
            deleteLbl: lf("Delete my account"),
            onLoaded: (_) => {
                _.find("button.delete").click(() => {
                    _.modal('hide');
                    showDeleteAccountDialog();
                })
                _.find("button.cancel").click(() => {
                    LoginBox.signout();
                })
            }
        })
    }

    renderCore() {
        const settings: Cloud.UserSettings = (Cloud.isLoggedIn() ? this.getData("cloud:me/settings?format=nonsensitive") : {}) || {}
        const name = Cloud.isLoggedIn() ? (settings.nickname || lf("Loading...")) : lf("Developer sign in")
        const icon = Cloud.isLoggedIn() ? "user" : "sign in";
        const buttonAction = () => {
            if (Cloud.isLoggedIn())
                LoginBox.showUserPropertiesAsync(settings).done();
            else this.signin();
        }

        return <sui.Item text={name} icon={icon} onClick={buttonAction} />
    }
}

