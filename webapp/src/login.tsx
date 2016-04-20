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

    static signout() {
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
        let settings: Cloud.UserSettings = (Cloud.isLoggedIn() ? this.getData("cloud:me/settings?format=nonsensitive") : {}) || {}
        let name = Cloud.isLoggedIn() ? (settings.nickname || lf("Loading...")) : lf("Developer sign in")
        let icon = Cloud.isLoggedIn() ? "user" : "sign in";
        let buttonAction = () => {
            if (Cloud.isLoggedIn()) {
                core.confirmAsync({
                    header: lf("User properties"),
                    htmlBody:
                    `<p>Manage your account and assets using the <code>pxt</code> command line.</p>
<ul>
<li>install the <code>pxt</code> command line and login following the on-screen instructions
<pre>
npm install -g pxt
pxt login
</pre>
</li>
<li>delete your account (NO UNDO!) and related packages.
<pre>
pxt delete me
</pre>
</li>
<li>list all your packages
<pre>
pxt list me
</pre>
</li>
<li>delete a particular package
<pre>
pxt delete PACKAGEID
</pre>
</li>
</ul>
`,
                    agreeLbl: lf("Got it!"),
                    hideCancel: true
                }).done();
            } else this.signin();
        }

        return <sui.Item text={name} icon={icon} onClick={buttonAction} />
    }
}

