import * as React from "react";
import { useContext } from "react";
import css from "./styling/HeaderBar.module.scss";
import { Button } from "react-common/components/controls/Button";
import { MenuBar } from "react-common/components/controls/MenuBar";
import { AppStateContext } from "../state/appStateContext";
import { getSafeChecklistName } from "../state/helpers";
import { Ticks } from "../constants";

interface HeaderBarProps {}

export const HeaderBar: React.FC<HeaderBarProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

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

    const getRubricName = (): JSX.Element | null => {
        const rubricName = getSafeChecklistName(teacherTool);
        return rubricName ? (
            <div className={css["rubric-name"]}>
                <span>{rubricName}</span>
            </div>
        ) : null;
    };

    const onHomeClicked = () => {
        pxt.tickEvent(Ticks.HomeLink);

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
                {getRubricName()}
            </div>

            <div className={css["right-menu"]}>
                <Button
                    className="menu-button"
                    leftIcon="fas fa-home large"
                    title={lf("Open the MakeCode editor")}
                    onClick={onHomeClicked}
                />
            </div>
        </MenuBar>
    );
};
