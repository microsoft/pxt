import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as dialogs from "./dialogs";
import * as cloudsync from "./cloudsync";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface AuthWidgetProps extends ISettingsProps {
}

export interface AuthWidgetState {
}

export class AuthWidget extends data.Component<AuthWidgetProps, AuthWidgetState> {
    constructor(props: AuthWidgetProps) {
        super(props);
        this.handleSignInClick = this.handleSignInClick.bind(this);
        this.handleHeadClick = this.handleHeadClick.bind(this);
    }

    handleSignInClick() {
        pxt.tickEvent('auth.signin', undefined, { interactiveConsent: true });
        dialogs.showCloudSignInDialog();
    }

    handleHeadClick() {
        pxt.tickEvent('auth.head', undefined, { interactiveConsent: true });
        // do something...
    }

    renderCore() {
        // no cloud
        const hasCloud = this.getData("sync:hascloud");
        if (!hasCloud)
            return <div/>;

        // signed in?
        const provider = this.getData("sync:provider") as cloudsync.ProviderInfo;
        if (!provider)
            return <sui.Button
                className={"authwidget anonymous"}
                onClick={this.handleSignInClick}
                text={lf("Sign in")}
            />;

        const username = this.getData("sync:username");
        const descr = lf("Signed in as {0} with {1}", username, provider.friendlyName);
        return <sui.Button
            className={`circular authwidget ${provider.name}`}
            title={descr}
            tooltip={descr}
            icon={provider.icon}
            onClick={this.handleHeadClick}>
        </sui.Button>
    }

    // move from the projects.tsx
    /*
    this.cloudSignIn = this.cloudSignIn.bind(this);
    cloudSignIn() {
        pxt.tickEvent("projects.signin", undefined, { interactiveConsent: true });
        dialogs.showCloudSignInDialog();
    }
    */

    /*
let signIn = ""
let signInIcon = ""
if (this.getData("sync:hascloud")) {
    signInIcon = this.getData("sync:status") == "syncing" ? "cloud download" : "user circle"
    signIn = this.getData("sync:username") || lf("Sign in")
}
*/

}