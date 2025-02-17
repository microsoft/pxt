/// <reference path="../lib/skillMap.d.ts" />
/// <reference path="../../../localtypings/react.d.ts" />

import * as React from "react";

import { connect } from 'react-redux';
import { dispatchSaveAndCloseActivity, dispatchShowResetUserModal, dispatchShowLoginModal,
    dispatchShowUserProfile, dispatchSetUserPreferences, dispatchShowSelectLanguage,
    dispatchShowSelectTheme} from '../actions/dispatch';
import { SkillMapState } from '../store/reducer';
import { isLocal, resolvePath, tickEvent } from "../lib/browserUtils";

import { isActivityCompleted } from "../lib/skillMapUtils";
import * as authClient from '../lib/authClient';
import { Button } from "react-common/components/controls/Button";
import { MenuBar } from "react-common/components/controls/MenuBar";
import { MenuDropdown, MenuItem } from "react-common/components/controls/MenuDropdown";


interface HeaderBarProps {
    currentMapId?: string;
    currentActivityId?: string;
    activityOpen: boolean;
    showReportAbuse?: boolean;
    signedIn: boolean;
    profile: pxt.auth.UserProfile;
    preferences: pxt.auth.UserPreferences;
    dispatchSaveAndCloseActivity: () => void;
    dispatchShowResetUserModal: () => void;
    dispatchShowLoginModal: () => void;
    dispatchShowUserProfile: () => void;
    dispatchSetUserPreferences: (preferences?: pxt.auth.UserPreferences) => void;
    dispatchShowSelectLanguage: () => void;
    dispatchShowSelectTheme: () => void;
}

export class HeaderBarImpl extends React.Component<HeaderBarProps> {
    protected reportAbuseUrl = "https://github.com/contact/report-content";
    protected getSettingItems(): MenuItem[] {
        const items: MenuItem[] = [];

        if (this.props.preferences) {
            const highContrast = this.props.preferences?.highContrast;
            items.push({
                id: "highcontrast",
                title: highContrast ? lf("High Contrast Off") : lf("High Contrast On"),
                label: highContrast ? lf("High Contrast Off") : lf("High Contrast On"),
                onClick: () => {
                    const newHighContrastPref = !this.props.preferences.highContrast;
                    tickEvent("skillmap.highcontrast", { on: newHighContrastPref ? 1 : 0});
                    authClient.setHighContrastPrefAsync(newHighContrastPref);
                    this.props.dispatchSetUserPreferences({
                        ...this.props.preferences,
                        highContrast: newHighContrastPref
                    })
                }
            })
        }

        items.push({
            id: "theme",
            title: lf("Select Theme"),
            label: lf("Select Theme"),
            onClick: () => {
                tickEvent("skillmap.theme");
                this.props.dispatchShowSelectTheme();
            }
        });

        // We hide the language option when activities are open to avoid
        // reloading the workspace and losing unsaved work.
        if (!this.props.activityOpen) {
            items.push({
                id: "language",
                title: lf("Language"),
                label: lf("Language"),
                onClick: () => {
                    tickEvent("skillmap.language");
                    this.props.dispatchShowSelectLanguage();
                }
            });
        }

        if (this.props.showReportAbuse) {
            items.push({
                id: "report",
                title: lf("Report Abuse"),
                label: lf("Report Abuse"),
                onClick: () => {
                    tickEvent("skillmap.reportabuse");
                    window.open(this.reportAbuseUrl);
                }
            })
        }

        if (!this.props.activityOpen) {
            items.push({
                id: "reset",
                title: lf("Reset All"),
                label: lf("Reset All"),
                onClick: () => {
                    tickEvent("skillmap.reset.warning");
                    this.props.dispatchShowResetUserModal();
                }
            })
        }

        return items;
    }

    protected getOrganizationLogo(targetTheme: pxt.AppTheme) {
        const logoUrl = targetTheme.organizationWideLogo;
        return <div className="header-logo">
            {logoUrl
                ? <img src={isLocal() ? `./assets/${logoUrl}`: logoUrl} alt={lf("{0} Logo", targetTheme.organization)}/>
                : <span className="name">{targetTheme.organization}</span>}
        </div>
    }

    protected getTargetLogo(targetTheme: pxt.AppTheme) {
        const { activityOpen } = this.props;
        return <div className={`ui item logo brand ${!activityOpen ? "noclick" : ""}`}>
            {targetTheme.useTextLogo
                ? [<span className="name" key="org-name" onClick={this.onBackClicked}>{targetTheme.organizationText}</span>,
                   <span className="name-short" key="org-name-short" onClick={this.onBackClicked}>{targetTheme.organizationShortText || targetTheme.organizationText}</span>]
                : (targetTheme.logo || targetTheme.portraitLogo
                    ? <img className="logo" src={targetTheme.logo || targetTheme.portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)}/>
                    : <span className="name"> {targetTheme.boardName}</span>)
            }
        </div>
    }

    protected getHelpItems(): MenuItem[] {
        const items: MenuItem[] = [];
        if (this.props.activityOpen) {
            items.push({
                id: "feedback",
                title: lf("Feedback"),
                label: lf("Feedback"),
                onClick: this.onBugClicked
            });
        }
        return items;
    }

    avatarPicUrl = (): string | undefined => {
        const { profile } = this.props;
        return profile?.idp?.pictureUrl ?? profile?.idp?.picture?.dataUrl;
    }

    protected getUserMenu() {
        const { signedIn, profile } = this.props;
        const items: MenuItem[] = [];

        if (signedIn) {
            items.push({
                id: "profile",
                title: lf("My Profile"),
                label: lf("My Profile"),
                onClick: this.onProfileClicked
            });
            items.push({
                id: "signout",
                title: lf("Sign Out"),
                label: lf("Sign Out"),
                onClick: this.onLogoutClicked
            });
        }

        // Google user picture URL must have referrer policy set to no-referrer
        const avatarElem = this.avatarPicUrl()
            ? <div className="avatar">
                <img src={this.avatarPicUrl()} alt={lf("Profile Image")} referrerPolicy="no-referrer" aria-hidden="true" />
            </div>
            : undefined;

        const initialsElem = <span><div className="avatar-initials" aria-hidden="true">{pxt.auth.userInitials(profile)}</div></span>

        return <div className="user-menu">
            {signedIn
            ?  <MenuDropdown id="profile-dropdown" items={items} label={avatarElem || initialsElem} title={lf("Profile Settings")}/>
             : <Button className="menu-button inverted" rightIcon="xicon cloud-user" title={lf("Sign In")} label={lf("Sign In")} onClick={ () => {
                pxt.tickEvent(`skillmap.usermenu.signin`);
                this.props.dispatchShowLoginModal();
            }}/>}
        </div>;
    }

    render() {
        const { activityOpen } = this.props;
        const hasIdentity = pxt.auth.hasIdentity();

        const appTheme = pxt.appTarget?.appTheme;
        const settingItems = this.getSettingItems();
        const helpItems = this.getHelpItems();

        return <MenuBar className="header" ariaLabel={lf("Header")}>
            <div className="header-left">
                {this.getOrganizationLogo(appTheme)}
                {this.getTargetLogo(appTheme)}
            </div>

            <div className="spacer" />
            <div className="header-right">
                { activityOpen && <Button className="menu-button" leftIcon="fas fa-arrow-left large" title={lf("Return to activity selection")} onClick={this.onBackClicked}/> }
                <Button className="menu-button" leftIcon="fas fa-home large" title={lf("Return to the editor homepage")} onClick={this.onHomeClicked}/>
                { helpItems?.length > 0 && <MenuDropdown id="skillmap-help" title={lf("Help menu")} icon="fas fa-question-circle large" items={helpItems}  />}
                { settingItems?.length > 0 && <MenuDropdown id="settings-help" title={lf("Settings menu")} icon="fas fa-cog large" items={settingItems}  />}
                { hasIdentity && this.getUserMenu() }
            </div>
        </MenuBar>
    }

    onBackClicked = () => {
        const { currentMapId, currentActivityId } = this.props;
        tickEvent("skillmap.activity.back", { path: currentMapId || "", activity: currentActivityId || "" });
        this.props.dispatchSaveAndCloseActivity();
    }

    onHomeClicked = () => {
        tickEvent("skillmap.home");

        const homeUrl = pxt.U.getHomeUrl();
        if (homeUrl) {
            window.open(homeUrl);
        }
    }

    onBugClicked = () => {
        tickEvent("skillmap.bugreport");
        (window as any).usabilla_live?.("click");
    }

    onLogoutClicked = async () => {
        pxt.tickEvent(`skillmap.usermenu.signout`);
        await authClient.logoutAsync(location.hash);
    }

    onProfileClicked = () => {
        pxt.tickEvent(`skillmap.profile`)
        this.props.dispatchShowUserProfile();
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    let completedHeaderId: string | undefined;
    if (state.editorView?.currentHeaderId) {
        if (isActivityCompleted(state.user, state.pageSourceUrl, state.editorView.currentMapId, state.editorView.currentActivityId)) {
            completedHeaderId = state.editorView.currentHeaderId;
        }
    }

    const activityOpen = !!state.editorView;

    if (state.editorView?.currentActivityId) {
        const activity = state.maps[state.editorView.currentMapId]?.activities[state.editorView.currentActivityId];
    }

    return {
        activityOpen,
        currentMapId: activityOpen && state.editorView?.currentMapId,
        currentActivityId: activityOpen && state.editorView?.currentActivityId,
        showReportAbuse: state.pageSourceStatus === "unknown",
        signedIn: state.auth.signedIn,
        profile: state.auth.profile,
        preferences: state.auth.preferences
    } as HeaderBarProps
}


const mapDispatchToProps = {
    dispatchSaveAndCloseActivity,
    dispatchShowResetUserModal,
    dispatchShowLoginModal,
    dispatchShowUserProfile,
    dispatchSetUserPreferences,
    dispatchShowSelectLanguage,
    dispatchShowSelectTheme
};

export const HeaderBar = connect(mapStateToProps, mapDispatchToProps)(HeaderBarImpl);
