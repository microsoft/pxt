import * as React from "react";
import css from "./styling/HeaderBar.module.scss";
import { useContext } from "react";
import { MenuBar } from "react-common/components/controls/MenuBar";
import { AppStateContext } from "../state/appStateContext";
import { Ticks } from "../constants";
import { UserAvatarDropdown } from "react-common/components/profile/UserAvatarDropdown";
import { SignInButton } from "react-common/components/profile/SignInButton";
import { logoutAsync } from "../services/authClient";
import { showModal } from "../state/actions";
import { MenuDropdown, MenuItem } from "react-common/components/controls/MenuDropdown";
import { DraggableColorPicker } from "./DraggableColorPicker";
import { setColorOfHighlight } from "../transforms/setColorOfHighlight";

interface HeaderBarProps {}

export const HeaderBar: React.FC<HeaderBarProps> = () => {
    const { state } = useContext(AppStateContext);
    const [showHighlightColorPicker, setShowHighlightColorPicker] = React.useState(false);

    const appTheme = pxt.appTarget?.appTheme;

    const onBrandIconClick = () => {
        pxt.tickEvent(Ticks.BrandLink);
        if (appTheme?.logoUrl) {
            window.open(appTheme.logoUrl);
        }
    };

    const onOrgClick = () => {
        pxt.tickEvent(Ticks.OrgLink);
        if (appTheme?.organizationUrl) {
            window.open(appTheme.organizationUrl);
        }
    };

    const getOrganizationLogo = () => {
        return (
            <div className={css["org"]} onClick={onOrgClick}>
                {appTheme.organizationWideLogo || appTheme.organizationLogo ? (
                    <img
                        className={css["logo"]}
                        src={appTheme.organizationWideLogo || appTheme.organizationLogo}
                        alt={lf("{0} Logo", appTheme.organization)}
                    />
                ) : (
                    <span className="name">{appTheme.organization}</span>
                )}
            </div>
        );
    };

    const getTargetLogo = () => {
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
                    <img
                        className={css["logo"]}
                        src={appTheme.logo || appTheme.portraitLogo}
                        alt={lf("{0} Logo", appTheme.boardName)}
                    />
                ) : (
                    <span className={css["name"]}>{appTheme.boardName}</span>
                )}
            </div>
        );
    };

    const onHomeClicked = () => {
        pxt.tickEvent(Ticks.HomeLink);

        const homeUrl = pxt.U.getHomeUrl();
        if (homeUrl) {
            window.open(homeUrl);
        }
    };

    function handleHighlightColorChanged(color: string) {
        setColorOfHighlight(color);
    }

    function getInitialColorPickerPosition() {
        const rect = document.querySelector(".settings-menu")?.getBoundingClientRect();
        return {
            x: rect ? rect.left - 205 : 0,
            y: rect ? rect.top + 5 : 0,
        };
    }

    const settingsItems: MenuItem[] = [
        {
            id: "set-highlight-color",
            title: lf("Set Highlight Color"),
            label: lf("Set Highlight Color"),
            onClick: () => setShowHighlightColorPicker(!showHighlightColorPicker),
            leftIcon: "fas fa-search",
        },
    ];

    return (
        <MenuBar className={css["header"]} ariaLabel={lf("Header")} role="navigation">
            <div className={css["left-menu"]} onClick={onHomeClicked}>
                {getOrganizationLogo()}
                {getTargetLogo()}
            </div>

            <div className={css["right-menu"]}>
                <MenuDropdown items={settingsItems} title={"Settings"} icon="fas fa-cog" className="settings-menu" />
                <ProfileMenu />
            </div>
            {showHighlightColorPicker && (
                <DraggableColorPicker
                    color={state.highlightBackground}
                    onChange={handleHighlightColorChanged}
                    onClose={() => setShowHighlightColorPicker(false)}
                    initialPosition={getInitialColorPickerPosition()}
                />
            )}
        </MenuBar>
    );
};

const ProfileMenu: React.FC = () => {
    const { state, dispatch } = useContext(AppStateContext);

    return (
        <>
            {state.userProfile && (
                <UserAvatarDropdown
                    userProfile={state.userProfile}
                    title={lf("Your Profile")}
                    onSignOutClick={() => logoutAsync()}
                />
            )}
            {!state.userProfile && <SignInButton onSignInClick={() => dispatch(showModal({ modal: "signin" }))} />}
        </>
    );
};
