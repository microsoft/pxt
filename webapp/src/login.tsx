import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as cloudworkspace from "./cloudworkspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";

import Cloud = ks.Cloud;
import Util = ks.Util;

export interface ILoginBoxProps {
}

export interface ILoginBoxState {
}


var lf = Util.lf

export class LoginBox extends data.Component<ILoginBoxProps, ILoginBoxState> {
    static signingOut = false;

    signin(addParameters = "") {

        var m = /u=\w+/.exec(document.URL);
        if (m)
            addParameters = "&" + m[0];

        var uid = Cloud.getUserId()
        if (uid) addParameters = "&u=" + encodeURIComponent(uid)

        let oauthState = window.localStorage["oauthState"] = Util.guidGen()

        var hereUrl = window.location.href;
        var url = Cloud.getServiceUrl() + "/oauth/dialog?response_type=token&client_id=" +
            encodeURIComponent("webapp3") +
            "&redirect_uri=" + encodeURIComponent(hereUrl) +
            "&state=" + encodeURIComponent(oauthState) + addParameters;

        core.showLoading(lf("Signing in..."))

        core.navigateInWindow(url);
    }

    signout() {
        LoginBox.signingOut = true;
        core.showLoading(lf("Signing out..."))
        cloudworkspace.resetAsync()
            .then(() => Cloud.privatePostAsync("logout", {}))
            .catch((e: any) => { })
            .then(() => {
                window.location.reload()
            })
            .done()
    }

    options() {

    }

    renderCore() {
        let settings: Cloud.UserSettings = this.getData("cloud:me/settings?format=nonsensitive") || {}
        let name = Cloud.isLoggedIn() ? (settings.nickname || lf("Loading...")) : lf("Sign in")
        let icon = Cloud.isLoggedIn() ? "user" : "sign in";
        let buttonAction = () => {
            if (Cloud.isLoggedIn())
                this.child(".ui.dropdown").dropdown("show");
            else
                this.signin();
        }

        return (
            <div id='loginbox' className="ui buttons">
                <sui.Button textClass="ui landscape only" text={name} icon={icon} onClick={buttonAction} />
                <sui.DropdownMenu class='floating icon button' icon='dropdown'>
                    {!Cloud.isLoggedIn() ? <sui.Item onClick={() => this.signin() } icon='sign in' text={lf("Sign in") } /> : null}
                    {Cloud.isLoggedIn() ? <sui.Item onClick={() => this.signout() } icon='sign out' text={lf("Sign out") } /> : null}
                    <sui.Item onClick={() => { window.location.href = "https://crowdin.com/project/KindScript" } } icon='translate' text={lf("Help translate KindScript!") } />
                </sui.DropdownMenu>
            </div>)
    }
}

