import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as auth from "./auth";
import * as data from "./data";
import * as codecard from "./codecard";

type ISettingsProps = pxt.editor.ISettingsProps;

export type LoginDialogProps = ISettingsProps & {
    onComplete?: () => void;
};

export type LoginDialogState = {
    visible?: boolean;
    onComplete?: () => void;
    rememberMe?: boolean;
    continuationState?: string;
    username?: string;
    avatarUrl?: string;
};

export class LoginDialog extends data.PureComponent<LoginDialogProps, LoginDialogState> {

    constructor(props: any) {
        super(props);

        this.state = {
            visible: false,
            onComplete: this.props.onComplete,
            rememberMe: false,
            continuationState: "",
            username: "",
            avatarUrl: ""
        };

        this.hide = this.hide.bind(this);
        this.handleRememberMeChanged = this.handleRememberMeChanged.bind(this);
        this.handleUsernameChanged = this.handleUsernameChanged.bind(this);
        this.handleUsernameRef = this.handleUsernameRef.bind(this);
        this.handleProfileSetupOkClicked = this.handleProfileSetupOkClicked.bind(this);
    }

    private handleRememberMeChanged(v: boolean) {
        this.setState({ rememberMe: v });
    }

    public show(continuationState: string) {
        this.setState({ visible: true, continuationState });
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
                                continuationState={this.state.continuationState}
                                onLoggedIn={this.onLoggedIn} />
                        ))}
                    </div>
                    <label></label>
                    <sui.PlainCheckbox label={lf("Remember me")} onChange={this.handleRememberMeChanged} />
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
                    <sui.Button ariaLabel="ok" className="large green inverted" text={lf("Ok")} onClick={this.handleProfileSetupOkClicked} />
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
    continuationState: string;
    onLoggedIn?: () => void;
};

class ProviderButton extends data.PureComponent<ProviderButtonProps, {}> {
    constructor(props: any) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    private async handleClick() {
        const { provider, onLoggedIn } = this.props;
        await auth.loginAsync(this.props.provider.id, this.props.rememberMe, this.props.continuationState);
        if (onLoggedIn) onLoggedIn();
    }

    renderCore() {
        const { provider, ...rest } = this.props;
        return (<codecard.CodeCardView
            ariaLabel={lf("Sign in with {0}.", provider.name)}
            role="button"
            key={'import'}
            icon={`${provider.icon} large`}
            name={provider.name}
            onClick={this.handleClick}
            {...rest}
        />);
    }
}
