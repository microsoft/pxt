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
        if (this.profileNeedsSetup()) {
            // User canceled setting up essential profile info.
            auth.logout();
        }
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

    handleSuggestClicked = async () => {
        const username = await auth.suggestUsername();
        if (username) {
            this.setState({ username });
        }
    }

    async componentDidUpdate(prevProps: Readonly<LoginDialogProps>) {
        if (this.props.initialVisibility !== prevProps.initialVisibility) {
            let username = this.state.username;
            if (!username || !username.length) {
                username = await auth.suggestUsername();
            }
            this.setState({ username, visible: this.props.initialVisibility });
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

    renderSetup() {
        return (
            <>
                <div className="ui header">{lf("Create your Profile")}</div>
                <div className={`ui form`}>
                    <div className="ui ten wide field">
                        <sui.Input placeholder={lf("Name")} autoFocus={!pxt.BrowserUtils.isMobile()} id={"usernameInput"}
                            ariaLabel={lf("Set your username")} autoComplete={false}
                            value={this.state.username} onChange={this.handleUsernameChanged} />
                        <sui.Button ariaLabel={lf("Suggest username")} className="" text={lf("Suggest")} onClick={this.handleSuggestClicked} />
                    </div>
                    <label></label>
                    <sui.Button ariaLabel="ok" className="green" text={lf("Ok")} onClick={this.handleProfileSetupOkClicked} />
                </div>
            </>
        );
    }

    renderCore() {
        const { visible } = this.state;
        const showLogin = !auth.loggedIn();
        const showSetup = !showLogin && auth.profileNeedsSetup();

        return (
            <sui.Modal isOpen={visible} className="signindialog" size="small"
                onClose={this.hide} dimmer={true}
                closeIcon={true} header={lf("Sign In")}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape>
                { showLogin ? this.renderLogin() : undefined}
                { showSetup ? this.renderSetup() : undefined}
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

    handleLogoutClicked = () => {
        auth.logout();
    }

    handleProfileClicked = () => {
        this.props.parent.showProfileDialog();
    }

    handleDropdownClicked = (): boolean => {
        if (!this.isLoggedIn()) {
            this.props.parent.showLoginDialog(this.props.continuationHash);
            return false;
        }
        return true;
    }

    getInitials(username: string): string {
        if (!username) return "?";
        // Parse the user name for user initials
        const initials = username.match(/\b\w/g) || [];
        return ((initials.shift() || '') + (initials.pop() || ''));
    }

    renderCore() {
        const loggedIn = this.isLoggedIn();
        const user = this.getUser();
        const icon = "user large"; // TODO: Show user's avatar pic if logged in
        const name = user && user.username ? user.username : lf("Sign in");
        const initials = user && user.username ? this.getInitials(user.username) : "";

        const initialsElem = sui.genericContent({
            icon,
            text: initials,
            textClass: "portrait only",
            iconClass: "ui portrait only"
        });

        const usernameElem = sui.genericContent({
            icon,
            text: name,
            textClass: "portrait hide",
            iconClass: "ui portrait hide"
        });

        const titleContent = <>{initialsElem}{usernameElem}</>;

        return (
            <sui.DropdownMenu role="menuitem"
                title={lf("User Menu")}
                className="item icon user-dropdown-menuitem"
                titleContent={titleContent}
                onClick={this.handleDropdownClicked}
            >
                {loggedIn ? <sui.Item role="menuitem" text={lf("My Profile")} onClick={this.handleProfileClicked} /> : undefined}
                {loggedIn ? <div className="ui divider"></div> : undefined}
                {loggedIn ? <sui.Item role="menuitem" text={lf("Sign out")} onClick={this.handleLogoutClicked} /> : undefined}
            </sui.DropdownMenu>
        );
    }
}
