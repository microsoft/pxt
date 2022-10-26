/// <reference path="../../../localtypings/react.d.ts" />

// TODO multiplayer : Reduce duplication with skillmap HeaderBar.tsx (may require enabling tailwind css there or removing it here?)

import { useContext } from "react";
import { Button } from "../../../react-common/components/controls/Button";
import { MenuBar } from "../../../react-common/components/controls/MenuBar";
import {
    MenuDropdown,
    MenuItem,
} from "../../../react-common/components/controls/MenuDropdown";
import { leaveGameAsync, signOutAsync } from "../epics";
import { showModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import { useAuthDialogMessages } from "../hooks/useAuthDialogMessages";

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext);
    const { authStatus, profile, deepLinks } = state;

    const hasIdentity = pxt.auth.hasIdentity();
    const appTheme = pxt.appTarget?.appTheme;
    const helpUrl = ""; // TODO multiplayer

    const dialogMessages = useAuthDialogMessages();

    const onHelpClicked = () => {
        pxt.tickEvent("mp.settingsmenu.help");
        window.open(helpUrl);
    };

    const onReportAbuseClicked = () => {
        pxt.tickEvent("mp.settingsmenu.reportabuse");
        dispatch(showModal("report-abuse"));
    };

    const onHomeClicked = () => {
        pxt.tickEvent("mp.home");

        // relprefix looks like "/beta---", need to chop off the hyphens and slash
        let rel = pxt.webConfig?.relprefix.substr(
            0,
            pxt.webConfig.relprefix.length - 3
        );
        if (pxt.appTarget.appTheme.homeUrl && rel) {
            if (
                pxt.appTarget.appTheme.homeUrl?.lastIndexOf("/") ===
                pxt.appTarget.appTheme.homeUrl?.length - 1
            ) {
                rel = rel.substr(1);
            }
            window.open(pxt.appTarget.appTheme.homeUrl + rel, "_self");
        } else {
            window.open(pxt.appTarget.appTheme.homeUrl, "_self");
        }
    };

    const onSignInClicked = () => {
        pxt.tickEvent(`mp.signin`);
        dispatch(showModal("sign-in", { dialogMessages }));
    };

    const onSignOutClicked = async () => {
        pxt.tickEvent(`mp.usermenu.signout`);
        await signOutAsync();
    };

    const onLeaveGameClick = async () => {
        pxt.tickEvent("mp.leavegame");
        await leaveGameAsync();
    };

    const getOrganizationLogo = (targetTheme: pxt.AppTheme) => {
        const logoUrl = targetTheme.organizationWideLogo;
        return (
            <div className="tw-flex">
                {logoUrl ? (
                    <img
                        className="tw-h-6 tw-mx-0 tw-my-1"
                        src={logoUrl}
                        alt={lf("{0} Logo", targetTheme.organization)}
                    />
                ) : (
                    <span className="tw-h-6 tw-mx-0 tw-my-1">
                        {targetTheme.organization}
                    </span>
                )}
            </div>
        );
    };

    const getTargetLogo = (targetTheme: pxt.AppTheme) => {
        return (
            <div
                className={
                    "tw-flex tw-pt-[2px] tw-ml-3 before:tw-relative before:tw-border-l-white before:tw-border-l-[2px] before:tw-border-solid tw-cursor-pointer"
                }
                onClick={onHomeClicked}
            >
                {targetTheme.useTextLogo ? (
                    [
                        <span
                            className="tw-ml-3 tw-hidden sm:tw-flex"
                            key="org-name"
                            onClick={onHomeClicked}
                        >
                            {targetTheme.organizationText}
                        </span>,
                        <span
                            className="tw-ml-3 tw-flex sm:tw-hidden"
                            key="org-name-short"
                            onClick={onHomeClicked}
                        >
                            {targetTheme.organizationShortText ||
                                targetTheme.organizationText}
                        </span>,
                    ]
                ) : targetTheme.logo || targetTheme.portraitLogo ? (
                    <img
                        className="logo"
                        src={targetTheme.logo || targetTheme.portraitLogo}
                        alt={lf("{0} Logo", targetTheme.boardName)}
                    />
                ) : (
                    <span className="name"> {targetTheme.boardName}</span>
                )}
            </div>
        );
    };

    const avatarPicUrl = (): string | undefined => {
        return profile?.idp?.pictureUrl ?? profile?.idp?.picture?.dataUrl;
    };

    const getUserMenu = () => {
        const items: MenuItem[] = [];

        if (authStatus === "signed-in") {
            items.push({
                id: "signout",
                title: lf("Sign Out"),
                label: lf("Sign Out"),
                onClick: onSignOutClicked,
            });
        }

        // Google user picture URL must have referrer policy set to no-referrer
        const avatarElem = avatarPicUrl() ? (
            <div className="tw-flex tw-align-middle tw-justify-center tw-items-center tw-h-full">
                <img
                    src={avatarPicUrl()}
                    className="tw-border-solid tw-border-2 tw-border-white tw-rounded-[100%] tw-w-10 tw-h-10"
                    alt={lf("Profile Image")}
                    referrerPolicy="no-referrer"
                    aria-hidden="true"
                />
            </div>
        ) : undefined;

        const initialsElem = (
            <span>
                <div
                    className="tw-h-10 tw-w-10 tw-rounded-[100%] tw-border-solid tw-border-2 tw-border-white tw-bg-[#028B9B] tw-flex tw-items-center tw-justify-center tw-text-base"
                    aria-hidden="true"
                >
                    {profile ? pxt.auth.userInitials(profile) : ""}
                </div>
            </span>
        );

        return (
            <div className="tw-h-full">
                {authStatus === "signed-in" && (
                    <MenuDropdown
                        id="profile-dropdown"
                        items={items}
                        label={avatarElem || initialsElem}
                        title={lf("Profile Settings")}
                    />
                )}
                {authStatus === "signed-out" && (
                    <Button
                        className="tw-p-[0.6rem] tw-h-4/5 tw-m-2 tw-mr-4 tw-flex-row-reverse tw-font-segoueUI tw-font-medium tw-align-middle"
                        rightIcon="xicon cloud-user"
                        title={lf("Sign In")}
                        label={lf("Sign In")}
                        onClick={onSignInClicked}
                    />
                )}
            </div>
        );
    };

    const getSettingItems = () => {
        const items: MenuItem[] = [];

        items.push({
            id: "help",
            title: lf("Help"),
            label: lf("Help"),
            onClick: onHelpClicked,
        });

        items.push({
            id: "report",
            title: lf("Report Abuse"),
            label: lf("Report Abuse"),
            onClick: onReportAbuseClicked,
        });

        return items;
    };

    const settingItems = getSettingItems();
    return (
        <MenuBar
            className="tw-h-[var(--header-height)] tw-bg-tertiary-color tw-text-white tw-flex tw-flex-grow-0 tw-flex-shrink-0 tw-align-middle tw-justify-center tw-items-center tw-z-[var(--above-frame-zindex)] tw-text-[2.2rem]"
            ariaLabel={lf("Header")}
        >
            <div className="tw-select-none tw-text-lg tw-font-bold tw-font-segoueUI tw-flex tw-align-middle tw-p-[var(--header-padding-top)]">
                {getOrganizationLogo(appTheme)}
                {getTargetLogo(appTheme)}
            </div>
            <div className="tw-select-none tw-flex-grow" />
            {state.gameState?.gameMode && (
                <div className="tw-select-none tw-flex tw-items-center tw-align-middle tw-h-full hover:tw-bg-black/10">
                    <Button
                        className="tw-bg-transparent tw-text-white tw-text-2xl tw-m-0 tw-p-4"
                        title={lf("Leave Game")}
                        onClick={onLeaveGameClick}
                        leftIcon="fas fa-arrow-left large"
                    />
                </div>
            )}
            <div className="tw-select-none tw-text-lg tw-font-bold tw-font-segoueUI tw-flex tw-items-center tw-pr-[var(--header-padding-top)] tw-h-full">
                {settingItems?.length > 0 && (
                    <MenuDropdown
                        className="h-full"
                        id="settings-help"
                        title={lf("Settings menu")}
                        icon="fas fa-cog large"
                        items={settingItems}
                    />
                )}
                {hasIdentity && getUserMenu()}
            </div>
        </MenuBar>
    );
}
