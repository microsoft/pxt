import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/HeaderBar.module.scss";
import { Button } from "react-common/components/controls/Button";
import { MenuBar } from "react-common/components/controls/MenuBar";

interface HeaderBarProps {}

export const HeaderBar: React.FC<HeaderBarProps> = () => {
    const appTheme = pxt.appTarget?.appTheme;

    const brandIconClick = () => {};

    const getOrganizationLogo = () => {
        return (
            <div className={css["org"]}>
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
                onClick={brandIconClick}
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
        pxt.tickEvent("teacherTool.home");

        // relprefix looks like "/beta---", need to chop off the hyphens and slash
        let rel = pxt.webConfig?.relprefix.substr(0, pxt.webConfig.relprefix.length - 3);
        if (pxt.appTarget.appTheme.homeUrl && rel) {
            if (pxt.appTarget.appTheme.homeUrl?.lastIndexOf("/") === pxt.appTarget.appTheme.homeUrl?.length - 1) {
                rel = rel.substr(1);
            }
            window.open(pxt.appTarget.appTheme.homeUrl + rel);
        } else {
            window.open(pxt.appTarget.appTheme.homeUrl);
        }
    };

    return (
        <MenuBar className={css["header"]} ariaLabel={lf("Header")} role="navigation">
            <div className={css["left-menu"]}>
                {getOrganizationLogo()}
                {getTargetLogo()}
            </div>

            <div className={css["right-menu"]}>
                <Button
                    className="menu-button"
                    leftIcon="fas fa-home large"
                    title={lf("Return to the editor homepage")}
                    onClick={onHomeClicked}
                />
            </div>
        </MenuBar>
    );
};
