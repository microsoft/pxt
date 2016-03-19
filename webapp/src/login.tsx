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


function initLogin() {
    let qs = core.parseQueryString((location.hash || "#").slice(1).replace(/%23access_token/, "access_token"))
    if (qs["access_token"]) {
        let ex = localStorage["oauthState"]
        if (ex && ex == qs["state"]) {
            window.localStorage["access_token"] = qs["access_token"]
            window.localStorage.removeItem("oauthState")
        }
        location.hash = location.hash.replace(/(%23)?[\#\&\?]*access_token.*/, "")
    }
    Cloud.accessToken = window.localStorage["access_token"] || "";
}

initLogin();

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
        let isOffline = !this.getData("cloud-online:api")
        let goOnline = () => {
            data.setOnline(true)
            workspace.syncAsync().done();
        }

        return (
            <div id='loginbox'>
                <div className="ui buttons">
                    <sui.Button textClass="ui landscape only" text={name} icon={icon} onClick={buttonAction} />
                    <sui.DropdownMenu class='floating icon button' icon='dropdown'>
                        {!Cloud.isLoggedIn() ? <sui.Item onClick={() => this.signin() } icon='sign in' text={lf("Sign in") } /> : null}
                        {Cloud.isLoggedIn() ? <sui.Item onClick={() => this.signout() } icon='sign out' text={lf("Sign out") } /> : null}
                        {isOffline ?
                            <sui.Item icon='plane' text={lf("Go online") } onClick={goOnline} />
                            : <sui.Item onClick={() => data.setOnline(false) } icon='plane' text={lf("Go offline") } /> }                        
                        <sui.Item onClick={() => { window.location.href = "https://crowdin.com/project/KindScript" } } icon='translate' text={lf("Help translate KindScript!") } />
                    </sui.DropdownMenu>
                </div>
            </div>)
    }
}

