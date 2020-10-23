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

export class LoginDialog extends data.Component<LoginDialogProps, LoginDialogState> {

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

        this.hide = this.hide.bind(this);
        this.handleRememberMeChanged = this.handleRememberMeChanged.bind(this);
        this.handleUsernameChanged = this.handleUsernameChanged.bind(this);
        this.handleUsernameRef = this.handleUsernameRef.bind(this);
        this.handleProfileSetupOkClicked = this.handleProfileSetupOkClicked.bind(this);
        this.onLoggedIn = this.onLoggedIn.bind(this);
    }

    private handleRememberMeChanged(v: boolean) {
        this.setState({ rememberMe: v });
    }

    public show(continuationHash: string) {
        this.setState({ visible: true, continuationHash });
    }

    public hide() {
        if (auth.profileNeedsSetup()) {
            auth.logout();
        }
        this.setState({ visible: false });
    }

    private onLoggedIn() {
        const { onComplete } = this.props;
        this.hide();
        if (onComplete) onComplete();
    }

    handleUsernameChanged(v: string) {
        this.setState({ username: v });
    }

    handleUsernameRef(ref: any) {
    }

    async handleProfileSetupOkClicked() {
        await auth.updateUserProfile({
            username: this.state.username,
            avatarUrl: this.state.avatarUrl
        });
        this.hide();
    }

    componentDidUpdate(prevProps: Readonly<LoginDialogProps>) {
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

    renderSetup() {
        return (
            <>
                <div className="ui header">{lf("Create your Profile")}</div>
                <div className={`ui form`}>
                    <div className="ui ten wide field">
                        <sui.Input ref={this.handleUsernameRef} placeholder={lf("Name")} autoFocus={!pxt.BrowserUtils.isMobile()} id={"usernameInput"}
                            ariaLabel={lf("Set your username")} autoComplete={false}
                            value={this.state.username} onChange={this.handleUsernameChanged} />
                    </div>
                    <label></label>
                    <sui.Button ariaLabel="ok" className="large green" text={lf("Ok")} onClick={this.handleProfileSetupOkClicked} />
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
        const { provider, onLoggedIn } = this.props;
        await auth.loginAsync(this.props.provider.id, this.props.rememberMe, {
            hash: this.props.continuationHash
        });
        if (onLoggedIn) onLoggedIn();
    }

    renderCore() {
        const { provider, ...rest } = this.props;
        return (<codecard.CodeCardView
            ariaLabel={lf("Sign in with {0}.", provider.name)}
            role="button"
            key={provider.name}
            imageUrl={provider.icon}
            name={provider.name}
            onClick={this.handleClick}
            {...rest}
        />);
    }
}

export type UserMenuProps = ISettingsProps & {
    continuationHash?: string;
};

type UserMenuState = {

}

export class UserMenu extends data.Component<UserMenuProps, UserMenuState> {
    constructor(props: UserMenuProps) {
        super(props);
        this.state = {
        }
    }

    handleLoginClick = () => {
        this.props.parent.showLoginDialog(this.props.continuationHash);
    }

    handleLogoutClick = () => {
        auth.logout();
    }

    handleProfileClick = () => {
    }

    handleDropdownClick = (): boolean => {
        if (!this.getLoggedIn()) {
            this.props.parent.showLoginDialog(this.props.continuationHash);
            return false;
        }
        return true;
    }

    getLoggedIn(): boolean {
        return this.getData<boolean>(auth.LOGGED_IN);
    }

    getUser(): auth.UserProfile {
        return this.getData<auth.UserProfile>(auth.USER);
    }

    renderCore() {
        const loggedIn = this.getLoggedIn();
        const user = this.getUser();
        const icon = "user large"; // TODO: Show user's avatar pic
        const title = user && user.username ? user.username : lf("Sign in");

        return (
            <sui.DropdownMenu role="menuitem"
                icon={icon}
                title={title}
                text={title}
                textClass="widedesktop only"
                className="item icon user-dropdown-menuitem"
                onClick={this.handleDropdownClick}
            >
                {loggedIn ? <sui.Item role="menuitem" text={lf("My Account")} /> : undefined}
                {loggedIn ? <sui.Item role="menuitem" text={lf("My Profile")} /> : undefined}
                {loggedIn ? <div className="ui divider"></div> : undefined}
                {loggedIn ? <sui.Item role="menuitem" text={lf("Sign out")} onClick={this.handleLogoutClick} /> : undefined}
            </sui.DropdownMenu>
        );
    }
}

export class Provider extends cloudsync.ProviderBase implements cloudsync.Provider {

    constructor() {
        super("mkcd", lf("MakeCode"), "xicon makecode", "https://www.makecode.com");
    }

    listAsync(): Promise<cloudsync.FileInfo[]> {
        throw new Error("Method not implemented.");
    }
    downloadAsync(id: string): Promise<cloudsync.FileInfo> {
        throw new Error("Method not implemented.");
    }
    uploadAsync(id: string, baseVersion: string, files: pxt.Map<string>): Promise<cloudsync.FileInfo> {
        throw new Error("Method not implemented.");
    }
    deleteAsync(id: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    updateAsync(id: string, newName: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getUserInfoAsync(): Promise<pxt.editor.UserInfo> {
        throw new Error("Method not implemented.");
    }
}
