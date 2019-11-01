/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as cloudsync from "./cloudsync";

import * as codecard from "./codecard";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface SignInDialogProps extends ISettingsProps {
    onComplete?: () => void;
}

export interface SignInDialogState {
    visible?: boolean;
    onComplete?: () => void;
}

export class SignInDialog extends data.Component<SignInDialogProps, SignInDialogState> {
    constructor(props: SignInDialogProps) {
        super(props);
        this.state = {
            visible: false
        }

        this.close = this.close.bind(this);
        this.onLoggedIn = this.onLoggedIn.bind(this);
    }

    hide() {
        this.setState({ visible: false });
    }

    close() {
        this.setState({ visible: false });
    }

    show() {
        this.setState({ visible: true });
    }

    onLoggedIn() {
        const { onComplete } = this.props;
        this.hide();
        if (onComplete) onComplete();
    }

    renderCore() {
        const { visible } = this.state;
        const providers = cloudsync.providers();

        return (
            <sui.Modal isOpen={visible} className="signindialog" size="small"
                onClose={this.close} dimmer={true}
                closeIcon={true} header={lf("Sign In")}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
            >
                <div className="ui header">{lf("Please choose your cloud provider.")}</div>
                <div className="ui grid padded">
                    <div className={"ui cards"}>
                        {providers.map(p => (
                            <SignInProviderButton key={p.name} provider={p} onLoggedIn={this.onLoggedIn} />
                        ))}
                    </div>
                </div>
            </sui.Modal>
        )
    }
}

interface SignInProviderButtonProps {
    provider?: cloudsync.IdentityProvider;
    onLoggedIn?: () => void;
}

class SignInProviderButton extends sui.StatelessUIElement<SignInProviderButtonProps> {
    constructor(props: SignInProviderButtonProps) {
        super(props);
        this.state = {
        }

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        const { provider, onLoggedIn } = this.props;
        provider.loginAsync()
            .then(() => {
                if (onLoggedIn) onLoggedIn();
            });
    }

    renderCore() {
        const { provider, ...rest } = this.props;
        return <codecard.CodeCardView
            ariaLabel={lf("Sign in with {0}.", provider.name)}
            role="button"
            key={'import'}
            icon={`${provider.icon} large`}
            name={provider.friendlyName}
            onClick={this.handleClick}
            {...rest}
        />
    }
}


interface UserMenuProps extends ISettingsProps {
}

export class UserMenu extends data.Component<UserMenuProps, {}> {

    constructor(props: UserMenuProps) {
        super(props);

        this.logout = this.logout.bind(this);
        this.login = this.login.bind(this);
    }

    login() {
        pxt.tickEvent("github.usermenu.signin", undefined, { interactiveConsent: true });
        this.props.parent.cloudSignInDialog();
    }

    logout() {
        pxt.tickEvent("github.usermenu.signout", undefined, { interactiveConsent: true });
        this.props.parent.cloudSignOut();
    }

    renderCore() {
        const user = this.getUser();
        const title = user && user.name ? lf("{0}'s Account", user.name) : lf("Sign in");
        const profile = user && user.profile;
        const userPhoto = user && user.photo;
        const userInitials = user && user.initials;
        const providericon = this.getData("sync:providericon") || "";

        return <sui.DropdownMenu role="menuitem" avatarImage={userPhoto} avatarInitials={userInitials}
            icon={`${providericon} large`}
            title={title}
            className="item icon user-dropdown-menuitem"
            tabIndex={0}>
            {profile ? <a className="ui item" role="menuitem" href={profile} title={lf("Open user profile page")} target="_blank" rel="noopener noreferrer">
                <i className={`ui icon ${providericon}`} />
                {lf("Signed in as {0}", user.userName || user.name)}
            </a> : undefined}
            {user ? <div className="ui divider" /> : undefined}
            {user ? <sui.Item role="menuitem" icon="sign out" text={lf("Sign out")} onClick={this.logout} /> : undefined}
            {!user ? <sui.Item role="menuitem" icon="sign in" text={lf("Sign in")} onClick={this.login} /> : undefined}
        </sui.DropdownMenu>
    }
}