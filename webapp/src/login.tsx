import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as apicache from "./apicache";
import * as pkg from "./package";
import * as core from "./core";

export interface ILoginBoxProps {
}

export interface ILoginBoxState {
}


function initLogin() {
    let qs = core.parseQueryString((location.hash || "#").slice(1))
    if (qs["access_token"]) {
        let ex = localStorage["oauthState"]
        if (ex && ex == qs["state"]) {
            window.localStorage["access_token"] = qs["access_token"]
            window.localStorage.removeItem("oauthState")
        }
        location.hash = location.hash.replace(/[\#\&\?]*access_token.*/, "")
    }
    Cloud.accessToken = window.localStorage["access_token"] || "";
}

initLogin();

export class LoginBox extends apicache.RestComponent<ILoginBoxProps, ILoginBoxState> {
    constructor(props: ILoginBoxProps) {
        super(props);
        this.state = {
        };
    }

    componentDidMount() {
        this.child(".ui.dropdown").dropdown();
    }

    componentDidUpdate() {
        this.child(".ui.dropdown").dropdown("refresh");
    }

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

        core.showLoading("Signing in...")

        core.navigateInWindow(url);
    }

    signout() {
        core.showLoading("Signing out...")
    }

    options() {

    }

    public render() {
        let settings: Cloud.UserSettings = this.getApi("me/settings?format=nonsensitive") || {}
        let name = Cloud.isLoggedIn() ? (settings.nickname || "Loading...") : "Sign in"
        let buttonAction = () => {
            if (Cloud.isLoggedIn())
                this.child(".ui.dropdown").dropdown("show");
            else
                this.signin();
        }
        return (
            <div id='loginbox'>
                <div className="ui orange buttons">
                    <div className="ui button" onClick={buttonAction}>{name}</div>
                    <div className="ui floating dropdown icon button">
                        <i className="dropdown icon"></i>
                        <div className="menu">
                            {Cloud.isLoggedIn() ?
                                [
                                    <div key="signout" className="item" onClick={() => this.signout() }>
                                        <i className="sign out icon"></i> Sign out
                                    </div>,
                                    <div key="settings" className="item" onClick={() => this.options() }>
                                        <i className="settings icon"></i> Account options
                                    </div>
                                ] : [
                                    <div key="signin" className="item" onClick={() => this.signin() }>
                                        <i className="sign in icon"></i> Sign in
                                    </div>
                                ]}
                        </div>
                    </div>
                </div>


            </div>)
    }
}

/*
                <div className="ui basic modal">
                    <div className="ui icon header">
                        <i className="sign in icon"></i>
                        Signing in...
                    </div>
                    <div className="ui center aligned container description">
                        <p>It will just be a moment.</p>
                    </div>
                </div>
*/

