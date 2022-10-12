/// <reference path="../../../localtypings/react.d.ts" />

// TODO thsparks : Reduce duplication with skillmap HeaderBar.tsx

import * as React from "react";
import { connect } from 'react-redux';
import { Button } from "../../../react-common/components/controls/Button";
import { MenuBar } from "../../../react-common/components/controls/MenuBar";
import { MenuDropdown, MenuItem } from "../../../react-common/components/controls/MenuDropdown";

interface HeaderBarProps {
    showReportAbuse?: boolean; // TODO thsparks
    signedIn: boolean;
    profile: pxt.auth.UserProfile | undefined;
    // preferences: pxt.auth.UserPreferences;
    // dispatchSaveAndCloseActivity: () => void;
    // dispatchShowResetUserModal: () => void;
    // dispatchSetUserPreferences: (preferences?: pxt.auth.UserPreferences) => void;
    handleSignIn: () => Promise<void>;
    handleSignOut: () => Promise<void>;
}

export default function Render(props: HeaderBarProps) {

    const hasIdentity = pxt.auth.hasIdentity();
    const appTheme = pxt.appTarget?.appTheme;
    const reportAbuseUrl = ""; // TODO thsparks, how will this work?
    const helpUrl = ""; // TODO thsparks

    const getOrganizationLogo = (targetTheme: pxt.AppTheme) => {
        const logoUrl = targetTheme.organizationWideLogo;
        return <div className="flex">
            {logoUrl
                ? <img className="h-6 mx-0 my-1" src={logoUrl} alt={lf("{0} Logo", targetTheme.organization)}/>
                : <span className="h-6 mx-0 my-1">{targetTheme.organization}</span>}
        </div>
    }

    const getTargetLogo = (targetTheme: pxt.AppTheme) => {
        return <div className={"flex pt-[2px] ml-3 before:relative before:h- before:border-l-white before:border-l-[2px] before:border-solid cursor-pointer"} onClick={onHomeClicked}>
            {targetTheme.useTextLogo
                ? [<span className="ml-3" key="org-name" onClick={onHomeClicked}>{targetTheme.organizationText}</span>,
                   /*<span className="hidden md:block" key="org-name-short" onClick={onHomeClicked}>{targetTheme.organizationShortText || targetTheme.organizationText}</span>*/]
                : (targetTheme.logo || targetTheme.portraitLogo
                    ? <img className="logo" src={targetTheme.logo || targetTheme.portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)}/>
                    : <span className="name"> {targetTheme.boardName}</span>)
            }
        </div>
    }

    const avatarPicUrl = (): string | undefined => {
        const { profile } = props;
        return profile?.idp?.pictureUrl ?? profile?.idp?.picture?.dataUrl;
    }

    const getUserMenu = () => {
        const { signedIn, profile } = props;
        const items: MenuItem[] = [];

        if (signedIn) {
            items.push({
                id: "signout",
                title: lf("Sign Out"),
                label: lf("Sign Out"),
                onClick: onLogoutClicked
            });
        }

        // Google user picture URL must have referrer policy set to no-referrer
        const avatarElem = avatarPicUrl()
            ? <div className="flex align-middle justify-center items-center h-full">
                <img src={avatarPicUrl()} className="border-solid border-2 border-white rounded-[100%] w-10 h-10" alt={lf("Profile Image")} referrerPolicy="no-referrer" aria-hidden="true" />
            </div>
            : undefined;

        const initialsElem = <span><div className="h-10 w-10 rounded-[100%] border-solid border-2 border-white bg-[#028B9B] flex items-center justify-center text-base" aria-hidden="true">{ profile ? pxt.auth.userInitials(profile) : "" }</div></span>

        // div here is user-menu css class in skillmap header bar
        return <div className="h-full">
            {signedIn ?
                <MenuDropdown id="profile-dropdown" items={items} label={avatarElem || initialsElem} title={lf("Profile Settings")}/> :
                <Button className="p-[0.6rem] h-4/5  m-2 mr-4 flex-row-reverse font-segoueUI font-medium align-middle" rightIcon="xicon cloud-user" title={lf("Sign In")} label={lf("Sign In")} onClick={props.handleSignIn}/>}
        </div>;
    }

    const getSettingItems = () => {
        const items: MenuItem[] = [];

        items.push({
            id: "help",
            title: lf("Help"),
            label: lf("Help"),
            onClick: () => {
                window.open(helpUrl);
            }
        })

        items.push({
            id: "report",
            title: lf("Report Abuse"),
            label: lf("Report Abuse"),
            onClick: () => {
                // tickEvent("skillmap.reportabuse");
                window.open(reportAbuseUrl);
            }
        })

        return items;
    }

    const onHomeClicked = () => {
        // tickEvent("skillmap.home");

        // relprefix looks like "/beta---", need to chop off the hyphens and slash
        let rel = pxt.webConfig?.relprefix.substr(0, pxt.webConfig.relprefix.length - 3);
        if (pxt.appTarget.appTheme.homeUrl && rel) {
            if (pxt.appTarget.appTheme.homeUrl?.lastIndexOf("/") === pxt.appTarget.appTheme.homeUrl?.length - 1) {
                rel = rel.substr(1);
            }
            window.open(pxt.appTarget.appTheme.homeUrl + rel, "_self");
        }
        else {
            window.open(pxt.appTarget.appTheme.homeUrl, "_self");
        }

    }

    const onLogoutClicked = async () => {
        // pxt.tickEvent(`skillmap.usermenu.signout`);
        props.handleSignOut();
    }

    const settingItems = getSettingItems();
    return <MenuBar className="h-[var(--header-height)] bg-tertiary-color text-white flex flex-grow-0 flex-shrink-0 align-middle justify-center items-center z-[var(--above-frame-zindex)] text-[2.2rem]" ariaLabel={lf("Header")}>
        <div className="select-none text-lg font-bold font-segoueUI flex align-middle p-[var(--header-padding-top)]">
            {getOrganizationLogo(appTheme)}
            {getTargetLogo(appTheme)}
        </div>
        <div className="select-none flex-grow" />
        <div className="select-none text-lg font-bold font-segoueUI flex items-center pr-[var(--header-padding-top)] h-full">
            { settingItems?.length > 0 && <MenuDropdown className="h-full" id="settings-help" title={lf("Settings menu")} icon="fas fa-cog large" items={settingItems}/>}
            { hasIdentity && getUserMenu() }
        </div>
    </MenuBar>
}