/// <reference path="../../../localtypings/react.d.ts" />

// TODO multiplayer : Reduce duplication with skillmap HeaderBar.tsx (may require enabling tailwind css there or removing it here?)

import { useContext } from "react";
import { Button } from "../../../react-common/components/controls/Button";
import { MenuBar } from "../../../react-common/components/controls/MenuBar";
import { MenuDropdown, MenuItem } from "../../../react-common/components/controls/MenuDropdown";
import { signOutAsync } from "../epics";
import { showModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import { useAuthDialogMessages } from "../hooks/useAuthDialogMessages";
import { resourceUrl } from "../util";

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext);
    const { authStatus, profile, gameState, targetConfig } = state;
    const { gameId: shareCode } = gameState ?? {};

    const hasIdentity = pxt.auth.hasIdentity();
    const appTheme = pxt.appTarget?.appTheme;

    const privacyUrl = pxt?.appTarget?.appTheme?.privacyUrl;
    const termsOfUseUrl = pxt?.appTarget?.appTheme?.termsOfUseUrl;
    const safetyUrl = "/multiplayer#safety";

    const dialogMessages = useAuthDialogMessages();

    const onReportAbuseClicked = () => {
        pxt.tickEvent("mp.settingsmenu.reportabuse");
        dispatch(showModal("report-abuse"));
    };

    const onPrivacyClicked = () => {
        pxt.tickEvent("mp.settingsmenu.privacy");
        window.open(privacyUrl);
    };

    const onTermsofUseClicked = () => {
        pxt.tickEvent("mp.settingsmenu.termsofuse");
        window.open(termsOfUseUrl);
    };

    const onOnlineSafetyClicked = () => {
        pxt.tickEvent("mp.settingsmenu.onlinesafety");
        window.open(safetyUrl);
    };

    const onHomeClicked = () => {
        pxt.tickEvent("mp.home");

        const homeUrl = pxt.U.getHomeUrl();
        if (homeUrl) {
            window.open(homeUrl, "_self");
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

    const getOrganizationLogo = (targetTheme: pxt.AppTheme) => {
        const logoWideUrl = targetTheme.organizationWideLogo;
        const logoUrl = targetTheme.organizationLogo;
        return (
            <div className="tw-flex">
                {logoWideUrl && logoUrl ? (
                    <>
                        <img
                            className="tw-h-6 tw-mx-0 tw-my-1 tw-hidden sm:tw-block"
                            src={resourceUrl(logoWideUrl)}
                            alt={lf("{0} Logo", targetTheme.organization)}
                        />
                        <img
                            className="tw-h-6 tw-mx-0 tw-my-1 tw-object-contain tw-block sm:tw-hidden"
                            src={resourceUrl(logoUrl)}
                            alt={lf("{0} Logo", targetTheme.organization)}
                        />
                    </>
                ) : (
                    <span className="tw-h-6 tw-mx-0 tw-my-1">{targetTheme.organization}</span>
                )}
            </div>
        );
    };

    const getTargetLogo = (targetTheme: pxt.AppTheme) => {
        return (
            <div className={"tw-flex tw-pt-[2px] tw-ml-3 tw-cursor-pointer"} onClick={onHomeClicked}>
                {targetTheme.useTextLogo ? (
                    [
                        <span className="tw-ml-3 tw-hidden sm:tw-flex" key="org-name" onClick={onHomeClicked}>
                            {targetTheme.organizationText}
                        </span>,
                        <span className="tw-ml-3 tw-flex sm:tw-hidden" key="org-name-short" onClick={onHomeClicked}>
                            {targetTheme.organizationShortText || targetTheme.organizationText}
                        </span>,
                    ]
                ) : targetTheme.logo || targetTheme.portraitLogo ? (
                    <img
                        className="logo"
                        src={resourceUrl(targetTheme.logo || targetTheme.portraitLogo)}
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
                        className="tw-p-[0.6rem] tw-h-4/5 tw-m-2 tw-mr-4 tw-flex-row-reverse tw-font-medium tw-align-middle"
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

        if (privacyUrl) {
            items.push({
                id: "privacy",
                title: lf("Privacy"),
                label: lf("Privacy"),
                onClick: onPrivacyClicked,
            });
        }

        if (termsOfUseUrl) {
            items.push({
                id: "termsOfUse",
                title: lf("Terms of Use"),
                label: lf("Terms of Use"),
                onClick: onTermsofUseClicked,
            });
        }

        items.push({
            id: "safety",
            title: lf("Online Safety"),
            label: lf("Online Safety"),
            onClick: onOnlineSafetyClicked,
        });

        const approvedLinks = targetConfig?.shareLinks?.approved || [];

        if (shareCode && approvedLinks.indexOf(shareCode) < 0) {
            items.push({
                id: "report",
                title: lf("Report Abuse"),
                label: lf("Report Abuse"),
                onClick: onReportAbuseClicked,
            });
        }

        return items;
    };

    const settingItems = getSettingItems();
    return (
        <MenuBar
            className={`tw-h-[var(--header-height)] tw-text-white
            tw-flex tw-flex-grow-0 tw-flex-shrink-0 tw-align-middle tw-justify-center
            tw-items-center tw-z-[50] tw-text-[2.2rem]
            tw-drop-shadow-xl
            `}
            ariaLabel={lf("Header")}
        >
            <div className="tw-select-none tw-text-lg tw-font-bold tw-flex tw-align-middle tw-p-[var(--header-padding-top)] tw-flex-none">
                {getOrganizationLogo(appTheme)}
                {getTargetLogo(appTheme)}
            </div>
            <div className="tw-select-none tw-grow" />
            <div className="tw-select-none tw-text-lg tw-font-bold tw-flex tw-items-center tw-h-full tw-flex-none">
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
