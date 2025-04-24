import css from "./HeaderBar.module.scss";
import * as React from "react";
import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { MenuBar } from "react-common/components/controls/MenuBar";
import { AppStateContext } from "@/state/Context";
import { Strings, Ticks } from "../constants";
import { MenuDropdown, MenuItem } from "react-common/components/controls/MenuDropdown";
import { showModal } from "../transforms/showModal";
import * as authClient from "../services/authClient";
import { classList } from "react-common/components/util";

const betaTag = () => {
    return <div className={css["beta-tag"]}>{lf("Beta")}</div>;
};

interface HeaderBarProps {}

export const HeaderBar: React.FC<HeaderBarProps> = () => {
    const { state } = useContext(AppStateContext);

    const appTheme = pxt.appTarget?.appTheme;

    function onBrandIconClick() {
        pxt.tickEvent(Ticks.BrandLink);
        if (appTheme?.logoUrl) {
            window.open(appTheme.logoUrl);
        }
    }

    function onOrgClick() {
        pxt.tickEvent(Ticks.OrgLink);
        if (appTheme?.organizationUrl) {
            window.open(appTheme.organizationUrl);
        }
    }

    function getOrganizationLogo() {
        return (
            <div className={css["org"]} onClick={onOrgClick}>
                {appTheme.organizationWideLogo || appTheme.organizationLogo ? (
                    <>
                        {appTheme.organizationWideLogo && (
                            <img
                                className={classList(css["logo"], "min-sm")}
                                src={appTheme.organizationWideLogo}
                                alt={lf("{0} Logo", appTheme.organization)}
                            />
                        )}
                        {appTheme.organizationLogo && (
                            <img
                                className={classList(css["logo"], "max-sm")}
                                src={appTheme.organizationLogo}
                                alt={lf("{0} Logo", appTheme.organization)}
                            />
                        )}
                    </>
                ) : (
                    <span className="name">{appTheme.organization}</span>
                )}
            </div>
        );
    }

    function getTargetLogo() {
        return (
            <div
                className={css["brand"]}
                aria-label={lf("{0} Logo", appTheme.boardName)}
                role="menuitem"
                onClick={onBrandIconClick}
            >
                {appTheme.useTextLogo ? (
                    [
                        <span className={css["name"]} key="org-name">
                            {appTheme.organizationText}
                        </span>,
                        <span className={css["name-short"]} key="org-name-short">
                            {appTheme.organizationShortText || appTheme.organizationText}
                        </span>,
                    ]
                ) : appTheme.logo || appTheme.portraitLogo ? (
                    <>
                        {appTheme.logo && (
                            <img
                                className={classList(css["logo"], "min-2sm")}
                                src={appTheme.logo}
                                alt={lf("{0} Logo", appTheme.boardName)}
                            />
                        )}
                        {appTheme.portraitLogo && (
                            <img
                                className={classList(css["logo"], "max-2sm")}
                                src={appTheme.portraitLogo}
                                alt={lf("{0} Logo", appTheme.boardName)}
                            />
                        )}
                    </>
                ) : (
                    <span className={css["name"]}>{appTheme.boardName}</span>
                )}
            </div>
        );
    }

    function encodedAvatarPic(profile: pxt.auth.UserProfile): string | undefined {
        const type = profile?.idp?.picture?.mimeType;
        const encodedImg = profile?.idp?.picture?.encoded;
        return type && encodedImg ? `data:${type};base64,${encodedImg}` : undefined;
    }

    function avatarPicUrl(): string | undefined {
        if (!state.userProfile) return undefined;
        return (
            state.userProfile.idp?.pictureUrl ??
            state.userProfile.idp?.picture?.dataUrl ??
            encodedAvatarPic(state.userProfile)
        );
    }

    async function onLogoutClicked() {
        pxt.tickEvent(Ticks.UserMenuSignout);
        await authClient.logoutAsync(location.hash);
    }

    function getUserMenu() {
        const items: MenuItem[] = [];
        if (state.userProfile) {
            items.push({
                id: "signout",
                title: lf("Sign Out"),
                label: lf("Sign Out"),
                onClick: onLogoutClicked,
            });
        }

        // Google user picture URL must have referrer policy set to no-referrer
        const avatarElem = avatarPicUrl() ? (
            <div className={css["avatar"]}>
                <img src={avatarPicUrl()} alt={lf("Profile Image")} referrerPolicy="no-referrer" aria-hidden="true" />
            </div>
        ) : undefined;

        const initialsElem = state.userProfile ? (
            <span>
                <div className={css["avatar-initials"]} aria-hidden="true">
                    {pxt.auth.userInitials(state.userProfile)}
                </div>
            </span>
        ) : (
            <></>
        );
        return (
            <div className={css["user-menu"]}>
                {state.userProfile ? (
                    <MenuDropdown
                        id="profile-dropdown"
                        items={items}
                        label={avatarElem || initialsElem}
                        title={lf("Profile Settings")}
                    />
                ) : (
                    <Button
                        className={classList("inverted", css["sign-in-button"])}
                        rightIcon="xicon cloud-user"
                        title={lf("Sign In")}
                        label={lf("Sign In")}
                        onClick={() => {
                            pxt.tickEvent(Ticks.UserMenuSignIn);
                            showModal({ type: "sign-in" });
                        }}
                    />
                )}
            </div>
        );
    }

    const privacyUrl = pxt?.appTarget?.appTheme?.privacyUrl;
    const termsOfUseUrl = pxt?.appTarget?.appTheme?.termsOfUseUrl;

    const getSettingItems = () => {
        const items: MenuItem[] = [];

        if (privacyUrl) {
            items.push({
                id: "privacy",
                title: Strings.Privacy,
                label: Strings.Privacy,
                onClick: () => pxt.tickEvent(Ticks.PrivacyStatementClicked),
                href: privacyUrl,
            });
        }

        if (termsOfUseUrl) {
            items.push({
                id: "termsOfUse",
                title: Strings.TermsOfUse,
                label: Strings.TermsOfUse,
                onClick: () => pxt.tickEvent(Ticks.TermsOfUseClicked),
                href: termsOfUseUrl,
            });
        }

        return items;
    };

    const settingItems = getSettingItems();

    return (
        <MenuBar className={css["header"]} ariaLabel={lf("Header")} role="navigation">
            <div className={css["left-menu"]}>
                {getOrganizationLogo()}
                {getTargetLogo()}
            </div>

            <div className={css["centered-panel"]}>
                <div className={classList(css["app-title"], "min-2md")}>
                    {Strings.AppTitle}
                    {betaTag()}
                </div>
                <div className={classList(css["app-title"], "min-xs max-2md")}>
                    {Strings.AppTitleShort}
                    {betaTag()}
                </div>
            </div>

            <div className={css["right-menu"]}>
                <MenuDropdown
                    id="settings-dropdown"
                    items={settingItems}
                    icon="fas fa-cog large"
                    title={Strings.Settings}
                />
                {getUserMenu()}
            </div>
        </MenuBar>
    );
};
