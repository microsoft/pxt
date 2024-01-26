import * as React from "react";

import { Button } from "react-common/components/controls/Button";
import { MenuBar } from "react-common/components/controls/MenuBar";

interface HeaderBarProps {}

const HeaderBar: React.FC<HeaderBarProps> = () => {
    const appTheme = pxt.appTarget?.appTheme;

    const brandIconClick = () => {};

    const getOrganizationLogo = () => {
        return (
            <div className="ui item logo organization">
                {appTheme.organizationWideLogo || appTheme.organizationLogo ? (
                    <img
                        className={`ui logo`}
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
                aria-label={lf("{0} Logo", appTheme.boardName)}
                role="menuitem"
                className={`ui item logo brand mobile hide`}
                onClick={brandIconClick}
            >
                {appTheme.useTextLogo ? (
                    [
                        <span className="name" key="org-name">
                            {appTheme.organizationText}
                        </span>,
                        <span className="name-short" key="org-name-short">
                            {appTheme.organizationShortText || appTheme.organizationText}
                        </span>,
                    ]
                ) : appTheme.logo || appTheme.portraitLogo ? (
                    <img
                        className={`ui ${appTheme.logoWide ? "small" : ""} logo`}
                        src={appTheme.logo || appTheme.portraitLogo}
                        alt={lf("{0} Logo", appTheme.boardName)}
                    />
                ) : (
                    <span className="name">{appTheme.boardName}</span>
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
        <header className="menubar" role="banner">
            <MenuBar className={`ui menu ${appTheme?.invertedMenu ? `inverted` : ""} header`} ariaLabel={lf("Header")}>
                <div className="left menu">
                    {getOrganizationLogo()}
                    {getTargetLogo()}
                </div>

                <div className="spacer" />

                <div className="header-right">
                    <Button
                        className="menu-button"
                        leftIcon="fas fa-home large"
                        title={lf("Return to the editor homepage")}
                        onClick={onHomeClicked}
                    />
                </div>
            </MenuBar>
        </header>
    );
};

export default HeaderBar;
