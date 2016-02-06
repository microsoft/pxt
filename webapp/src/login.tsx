import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";

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
        workspace.resetAsync()
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
        let buttonAction = () => {
            if (Cloud.isLoggedIn())
                this.child(".ui.dropdown").dropdown("show");
            else
                this.signin();
        }
        return (
            <div id='loginbox'>
                <div className="ui buttons">
                    <sui.Button text={name} onClick={buttonAction} />
                    <sui.Dropdown menu={true} class='floating icon button'>
                        {Cloud.isLoggedIn() ? <sui.Item onClick={() => this.signout() } icon='sign out' text={lf("Sign out")} /> : null}
                        {Cloud.isLoggedIn() ? <sui.Item onClick={() => this.options() } icon='settings' text={lf("Account options")} /> : null}
                        {!Cloud.isLoggedIn() ? <sui.Item onClick={() => this.signin() } icon='sign in' text={lf("Sign in")} /> : null}
                        <sui.Item onClick={() => data.setOnline(false) } icon='plane' text={lf("Go offline")} />
                    </sui.Dropdown>
                </div>
            </div>)
    }
}

