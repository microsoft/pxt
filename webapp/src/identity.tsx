import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as auth from "./auth";
import * as data from "./data";
import * as codecard from "./codecard";
import * as cloudsync from "./cloudsync";

type ISettingsProps = pxt.editor.ISettingsProps;

export type LoginDialogProps = ISettingsProps & {
    initialVisibility?: boolean;
    onComplete?: () => void;
};

export type LoginDialogState = {
    visible?: boolean;
    onComplete?: () => void;
    rememberMe?: boolean;
    continuationHash?: string;
    username?: string;
    avatarUrl?: string;
};

export class LoginDialog extends auth.Component<LoginDialogProps, LoginDialogState> {

    constructor(props: any) {
        super(props);

        this.state = {
            visible: this.props.initialVisibility,
            onComplete: this.props.onComplete,
            rememberMe: false,
            continuationHash: "",
            username: "",
            avatarUrl: ""
        };
    }

    private handleRememberMeChanged = (v: boolean) => {
        this.setState({ rememberMe: v });
    }

    public async show(continuationHash?: string) {
        const state: LoginDialogState = { visible: true, continuationHash };
        this.setState(state);
    }

    public hide = () => {
        this.setState({ visible: false });
    }

    private onLoggedIn = () => {
        const { onComplete } = this.props;
        this.hide();
        if (onComplete) onComplete();
    }

    handleUsernameChanged = (v: string) => {
        this.setState({ username: v });
    }

    handleProfileSetupOkClicked = async () => {
        await auth.updateUserProfile({
            username: this.state.username,
            avatarUrl: this.state.avatarUrl
        });
        this.hide();
    }

    async componentDidUpdate(prevProps: Readonly<LoginDialogProps>) {
        if (this.props.initialVisibility !== prevProps.initialVisibility) {
            this.setState({ visible: this.props.initialVisibility });
        }
    }

    renderLogin() {
        const providers = auth.identityProviders();
        return (
            <>
                <div className="ui header">{lf("Sign in with:")}</div>
                <div className="ui grid padded">
                    <div className={"ui cards"}>
                        {providers.map(p => (
                            <ProviderButton
                                key={p.name}
                                provider={p}
                                rememberMe={this.state.rememberMe}
                                continuationHash={this.state.continuationHash}
                                onLoggedIn={this.onLoggedIn} />
                        ))}
                    </div>
                    <div className={`ui form padded`}>
                        <p>&nbsp;</p>
                        <sui.PlainCheckbox label={lf("Remember me")} onChange={this.handleRememberMeChanged} />
                    </div>
                </div>
            </>
        );
    }

    renderCore() {
        const { visible } = this.state;

        return (
            <sui.Modal isOpen={visible} className="signindialog" size="small"
                onClose={this.hide} dimmer={true}
                closeIcon={true} header={lf("Sign In")}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape>
                {this.renderLogin()}
            </sui.Modal>
        );
    }
}

type ProviderButtonProps = {
    provider: pxt.AppCloudProvider;
    rememberMe: boolean;
    continuationHash: string;
    onLoggedIn?: () => void;
};

class ProviderButton extends data.PureComponent<ProviderButtonProps, {}> {
    constructor(props: any) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    private async handleClick() {
        const { provider, rememberMe, onLoggedIn } = this.props;
        await auth.loginAsync(provider.id, rememberMe, {
            hash: this.props.continuationHash
        });
        if (onLoggedIn) onLoggedIn();
    }

    renderCore() {
        const { provider, ...rest } = this.props;
        return (
            <codecard.CodeCardView
                ariaLabel={lf("Sign in with {0}.", provider.name)}
                role="button"
                key={provider.name}
                imageUrl={encodeURI(provider.icon)}
                name={provider.name}
                onClick={this.handleClick}
                {...rest}
            />
        );
    }
}

export type UserMenuProps = ISettingsProps & {
    continuationHash?: string;
};

type UserMenuState = {
};

export class UserMenu extends auth.Component<UserMenuProps, UserMenuState> {
    constructor(props: UserMenuProps) {
        super(props);
        this.state = {
        };
    }

    handleLoginClicked = () => {
        this.props.parent.showLoginDialog(this.props.continuationHash);
    }

    handleLogoutClicked = () => {
        auth.logout();
    }

    handleProfileClicked = () => {
        this.props.parent.showProfileDialog();
    }

    renderCore() {
        const loggedIn = this.isLoggedIn();
        const user = this.getUser();
        const icon = "user large";
        const title = lf("User Menu");

        const signedOutElem = sui.genericContent({
            icon
        });
        const avatarElem = (
            <div className="avatar">
                <img src={user?.idp?.picture?.dataUrl} alt={lf("User Menu")} />
            </div>
        );
        const initialsElem = (
            <div className="avatar">
                <span>{cloudsync.userInitials(user?.idp?.displayName)}</span>
            </div>
        );
        const signedInElem = user?.idp?.picture?.dataUrl ? avatarElem : initialsElem;

        let pictureElem: React.ReactNode;
        if (user?.idp?.picture?.dataUrl) {
            pictureElem = (
                <div className="avatar">
                    <img src={user.idp.picture.dataUrl} alt={title} />
                </div>
            );
        }

        return (
            <sui.DropdownMenu role="menuitem"
                title={title}
                className="item icon user-dropdown-menuitem"
                titleContent={loggedIn ? signedInElem : signedOutElem}
            >
                {!loggedIn ? <sui.Item role="menuitem" text={lf("Sign in")} onClick={this.handleLoginClicked} /> : undefined}
                {loggedIn ? <sui.Item role="menuitem" text={lf("My Profile")} onClick={this.handleProfileClicked} /> : undefined}
                {loggedIn ? <div className="ui divider"></div> : undefined}
                {loggedIn ? <sui.Item role="menuitem" text={lf("Sign out")} onClick={this.handleLogoutClicked} /> : undefined}
            </sui.DropdownMenu>
        );
    }
}
