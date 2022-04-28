import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as auth from "./auth";
import * as cloudsync from "./cloudsync";
import { Profile } from "../../react-common/components/profile/Profile";
import { CheckboxStatus } from "../../react-common/components/util";

type ISettingsProps = pxt.editor.ISettingsProps;

export type ProfileTab = 'settings' | 'privacy' | 'my-stuff';


export type ProfileDialogProps = ISettingsProps & {
};

type ProfileDialogState = {
    visible?: boolean;
    location?: ProfileTab;
    notification?: pxt.ProfileNotification;
    emailSelected: CheckboxStatus;
};

export class ProfileDialog extends auth.Component<ProfileDialogProps, ProfileDialogState> {
    constructor(props: ProfileDialogProps) {
        super(props);
        const pref = auth.userPreferences();
        this.state = {
            visible: props.visible,
            location: 'my-stuff',
            emailSelected: pref?.email ? CheckboxStatus.Selected : CheckboxStatus.Unselected
        };

        pxt.targetConfigAsync().then(config => {
            this.setState({
                notification: config.profileNotification
            });
        })
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

    onLogoutClicked = () => {
        pxt.tickEvent("pxt.profile.signout")
        auth.logoutAsync();
    }

    onDeleteProfileClicked = () => {
        pxt.tickEvent("pxt.profile.delete")
        this.deleteProfileAsync();
    }

    onEmailCheckClicked = (isSelected: boolean ) => {
        this.setState({ emailSelected: CheckboxStatus.Waiting })
        auth.setEmailPrefAsync(isSelected).then(setResult => {
            if (setResult.success) {
                core.infoNotification(lf("Settings saved"))
                this.setState({ emailSelected: setResult.res?.email ? CheckboxStatus.Selected : CheckboxStatus.Unselected })
            } else {
                core.errorNotification(lf("Oops, something went wrong"))
                this.setState({ emailSelected: !isSelected ? CheckboxStatus.Selected : CheckboxStatus.Unselected })
            }
        })
    }

    deleteProfileAsync = async () => {
        const profile = this.getData<pxt.auth.UserProfile>(auth.USER_PROFILE)
        const result = await core.confirmAsync({
            header: lf("Delete Profile"),
            body: lf("Are you sure? This cannot be reversed! Your cloud-saved projects will be converted to local projects on this device."),
            agreeClass: "red",
            agreeIcon: "trash",
            agreeLbl: lf("Confirm"),
            disagreeLbl: lf("Back to safety"),
            disagreeIcon: "arrow right",
            confirmationCheckbox: lf("I understand this is permanent. No undo.")
        });
        if (result) {
            await auth.deleteProfileAsync();
            // Exit out of the profile screen.
            this.hide();
            core.infoNotification(lf("Profile deleted!"));
        }
    }

    avatarPicUrl(): string {
        const user = this.getUserProfile();
        return user?.idp?.pictureUrl ?? user?.idp?.picture?.dataUrl;
    }

    renderCore() {
        const isLoggedIn = this.isLoggedIn();
        if (!isLoggedIn) return null;

        const profile = this.getUserProfile();
        const preferences = this.getUserPreferences();

        const github = cloudsync.githubProvider();
        const ghUser = github.user();

        const { emailSelected } = this.state;

        return (
            <sui.Modal isOpen={this.state.visible} className="ui profiledialog" size="fullscreen"
                onClose={this.hide} dimmer={true}
                closeIcon={true} header={profile?.idp?.displayName}
                closeOnDimmerClick={false}
                closeOnDocumentClick={false}
                closeOnEscape={false}
            >
                <Profile
                    user={{profile, preferences}}
                    signOut={this.onLogoutClicked}
                    deleteProfile={this.onDeleteProfileClicked}
                    notification={this.state.notification}
                    showModalAsync={core.dialogAsync}
                    onClickedEmail={this.onEmailCheckClicked}
                    checkedEmail={emailSelected} />
            </sui.Modal>
        );
    }
}
