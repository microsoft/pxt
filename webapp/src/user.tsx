import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as auth from "./auth";

type ISettingsProps = pxt.editor.ISettingsProps;

export type ProfileTab = 'settings' | 'privacy' | 'my-stuff';


export type ProfileDialogProps = ISettingsProps & {
};

type ProfileDialogState = {
    visible?: boolean;
    location?: ProfileTab;
};

export class ProfileDialog extends auth.Component<ProfileDialogProps, ProfileDialogState> {
    constructor(props: ProfileDialogProps) {
        super(props);
        this.state = {
            visible: props.visible,
            location: 'my-stuff'
        };
    }

    show(location?: string) {
        location = location ?? 'my-stuff';
        this.setState({
            visible: true,
            location: location as ProfileTab
        });
    }

    hide = () => {
        this.setState({ visible: false });
    }

    handleTabClick = (id: ProfileTab) => {
        this.setState({ location: id });
    }

    renderCore() {
        const isLoggedIn = this.isLoggedIn();
        if (!isLoggedIn) return null;

        const tabs: { id: ProfileTab, label: string }[] = [
            { id: 'my-stuff', label: lf("My Stuff") },
            { id: 'settings', label: lf("Settings") },
            { id: 'privacy', label: lf("Privacy") },
        ];

        const user = this.getUser();
        return (
            <sui.Modal isOpen={this.state.visible} className="ui profiledialog" size="fullscreen"
                onClose={this.hide} dimmer={true}
                closeIcon={true} header={user?.username}
                closeOnDimmerClick={false}
                closeOnDocumentClick={false}
                closeOnEscape={false}
            >
                <sui.Menu pointing secondary>
                    {tabs.map((tab, index) => <ProfileTabItem id={tab.id} active={this.state.location === tab.id} label={tab.label} index={index} onClick={this.handleTabClick} />)}
                </sui.Menu>
                {this.state.location === 'settings' ? <SettingsPanel parent={this} /> : undefined}
                {this.state.location === 'privacy' ? <PrivacyPanel parent={this} /> : undefined}
                {this.state.location === 'my-stuff' ? <MyStuffPanel parent={this} /> : undefined}
            </sui.Modal>
        );
    }
}

type ProfileTabItemProps = {
    id: ProfileTab;
    active: boolean;
    label: string;
    index: number;
    onClick: (id: ProfileTab) => void;
};

class ProfileTabItem extends sui.StatelessUIElement<ProfileTabItemProps> {
    handleClick = () => {
        this.props.onClick(this.props.id);
    }

    renderCore() {
        const { id, active, label, index } = this.props;
        return <sui.MenuItem id={id} key={index} active={active} name={label} tabIndex={index} onClick={this.handleClick} />
    }
}

type SettingsPanelProps = {
    parent: ProfileDialog;
}

class SettingsPanel extends sui.UIElement<SettingsPanelProps, {}> {
    editAccountInfoDialog: EditAccountInfoDialog;

    handleEditAccountInfoClick = () => {
        this.editAccountInfoDialog.show();
    }

    handleEditAvatarClick = () => {
    }

    handleEditAccountInfoDialogRef = (r: EditAccountInfoDialog) => {
        this.editAccountInfoDialog = r;
    }

    renderCore(): JSX.Element {
        const user = this.getData<auth.UserProfile>(auth.USER);

        const editAccountInfoBtn = <sui.Button key="edit" icon="edit outline" className="icon"
            text={lf("Edit")} textClass="landscape only" title={lf("Edit Account Info")} onClick={this.handleEditAccountInfoClick} />;
        const editAvatarBtn = <sui.Button key="edit" icon="edit outline" className="icon"
            text={lf("Edit")} textClass="landscape only" title={lf("Edit Avatar")} onClick={this.handleEditAvatarClick} />;

        return (
            <div className="ui padded grid settings-panel">
                <div className="equal width row">
                    <ContentBox key={0} title={lf("Account Info")} headerControls={editAccountInfoBtn} classes="column account-info">
                        <div className="centered two column row">
                            <span>{lf("Name:")}</span>
                            <span style={{ paddingLeft: "20px" }}>{user.username}</span>
                        </div>
                    </ContentBox>
                    <span style={{ width: "20px" }} />
                    <ContentBox key={1} title={lf("Avatar")} headerControls={editAvatarBtn} classes="column avatar-info">
                        <div>Show avatar here</div>
                    </ContentBox>
                </div>
                {<EditAccountInfoDialog parent={this.props.parent.props.parent} ref={this.handleEditAccountInfoDialogRef} />}
            </div>
        );
    }
}

type PrivacyPanelProps = {
    parent: ProfileDialog;
}

class PrivacyPanel extends sui.UIElement<PrivacyPanelProps, {}> {

    handleDeleteAccountClick = async () => {
        const result = await core.confirmAsync({
            header: lf("Delete Account"),
            body: lf("You are about to delete your account. You can't undo this. Are you sure?"),
            agreeClass: "red",
            agreeIcon: "delete",
            agreeLbl: lf("Delete my account"),
        });
        if (result) {
            await auth.deleteAccount();
            // Exit out of the profile screen.
            this.props.parent.hide();
            core.infoNotification(lf("Account deleted!"));
        }
    }

    renderCore(): JSX.Element {
        return (
            <>
                <sui.Button ariaLabel={lf("Delete Account")} className="red" text={lf("Delete Account")} onClick={this.handleDeleteAccountClick} />
            </>
        );
    }
}

type MyStuffPanelProps = {
    parent: ProfileDialog;
}

class MyStuffPanel extends sui.UIElement<MyStuffPanelProps, {}> {

    renderCore(): JSX.Element {
        return (
            <div className="empty-content">
                <h2 className={`ui center aligned header`}>
                    <div className="content">
                        {lf("It's empty in here")}
                        <div className="sub header">{lf("TODO: Show all the best info here")}</div>
                    </div>
                </h2>
            </div>
        );
    }
}

type ContentBoxProps = {
    title: string;
    headerControls?: React.ReactNode;
    classes: string;
};

class ContentBox extends sui.StatelessUIElement<ContentBoxProps> {

    renderCore() {
        return (
            <div className={sui.cx(["ui vertically grid card content-box", this.props.classes])}>
                <div className="equal width row">
                    <div className="column header">
                        <span className="header-title">
                            {this.props.title}
                        </span>
                    </div>
                    <div className="right aligned column">
                        {this.props.headerControls}
                    </div>
                </div>
                <div className="equal width row">
                    <div className="column">
                        {this.props.children}
                    </div>
                </div>
            </div>
        )
    }
}

export type EditAccountInfoDialogProps = ISettingsProps & {

};

type EditAccountInfoDialogState = {
    visible?: boolean;
    username?: string;
    okBtnDisabled?: boolean;
    saving?: boolean;
};

export class EditAccountInfoDialog extends auth.Component<EditAccountInfoDialogProps, EditAccountInfoDialogState> {

    constructor(props: EditAccountInfoDialogProps) {
        super(props);
        this.state = {
        };
    }

    public show() {
        const user = this.getUser();
        this.setState({
            visible: true,
            username: user?.username,
            okBtnDisabled: false,
            saving: false
        });
    }

    public hide = () => {
        if (this.profileNeedsSetup()) {
            // User canceled setting up essential profile info.
            auth.logout();
        }
        this.setState({ visible: false });
    }

    updateUsername(s: string) {
        const trimmed = s.trim();
        this.setState({
            username: s,
            okBtnDisabled: !trimmed || trimmed.length < 2
        });
    }

    handleUsernameChanged = (s: string) => {
        this.updateUsername(s);
        const trimmed = s.trim();
    }

    handleOkClicked = async () => {
        this.setState({ saving: true });
        const success = await auth.updateUserProfile({
            username: this.state.username
        });
        this.hide();
        if (success) {
            core.infoNotification(lf("Profile updated!"));
        } else {
            core.errorNotification(lf("User update failed. Something went wrong."));
        }
    }

    handleSuggestClicked = async () => {
        const username = await auth.suggestUsername();
        if (username) {
            this.updateUsername(username);
        }
    }

    renderCore() {
        const { visible } = this.state;

        return (
            <sui.Modal isOpen={visible} className="signindialog" size="small"
                onClose={this.hide}
                dimmer={true}
                header={lf("Account Info")}
                closeOnDimmerClick={false}
                closeOnDocumentClick={false}
                closeOnEscape={true}
            >
                <div className="ui header">{lf("Name")}</div>
                <div className={`ui form`}>
                    <div className="ui ten wide field">
                        <sui.Input placeholder={lf("Name")} autoFocus={!pxt.BrowserUtils.isMobile()} id={"usernameInput"}
                            ariaLabel={lf("Set your username")} autoComplete={false}
                            value={this.state.username} onChange={this.handleUsernameChanged} />
                        <sui.Button ariaLabel={lf("Suggest username")} className="" text={lf("Suggest")} onClick={this.handleSuggestClicked} />
                    </div>
                    <label></label>
                    <sui.Button ariaLabel="ok" className="green" text={lf("Ok")} onClick={this.handleOkClicked} disabled={this.state.saving || this.state.okBtnDisabled} loading={this.state.saving} />
                    <sui.Button ariaLabel="cancel" className="" text={lf("Cancel")} onClick={this.hide} disabled={this.state.saving} />
                </div>
            </sui.Modal>
        );
    }

}
