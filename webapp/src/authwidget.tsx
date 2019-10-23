import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as dialogs from "./dialogs";

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
    }

    renderCore() {
        const authority = pxt.github.token ? "github" : this.getData("sync:provider");

        // not signed in
        if (!authority)
            return <sui.Button
                className={"authwidget anonymous"}
                onClick={this.handleSignInClick}
                text={lf("Sign in")}
            />;

        // signed in, display bubbled head
        // TODO: display face
        return <sui.Button
            className={`circular authwidget ui icon ${authority}`}
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