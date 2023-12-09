import * as React from "react";

import { Button } from "react-common/components/controls/Button";
import { MenuBar } from "react-common/components/controls/MenuBar";

interface HeaderBarProps {
}

export class HeaderBar extends React.Component<HeaderBarProps> {
    protected reportAbuseUrl = "https://github.com/contact/report-content";

    protected getOrganizationLogo(targetTheme: pxt.AppTheme) {
        const logoUrl = targetTheme.organizationWideLogo;
        return <div className="header-logo">
            {logoUrl
                ? <img src={logoUrl} alt={lf("{0} Logo", targetTheme.organization)}/>
                : <span className="name">{targetTheme.organization}</span>}
        </div>
    }

    protected getTargetLogo(targetTheme: pxt.AppTheme) {
        return <div className={`ui item logo brand noclick}`}>
            {targetTheme.useTextLogo
                ? [<span className="name" key="org-name" onClick={this.onHomeClicked}>{targetTheme.organizationText}</span>,
                   <span className="name-short" key="org-name-short" onClick={this.onHomeClicked}>{targetTheme.organizationShortText || targetTheme.organizationText}</span>]
                : (targetTheme.logo || targetTheme.portraitLogo
                    ? <img className="logo" src={targetTheme.logo || targetTheme.portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)}/>
                    : <span className="name"> {targetTheme.boardName}</span>)
            }
        </div>
    }

    onHomeClicked = () => {
        pxt.tickEvent("teacherTool.home");

        // relprefix looks like "/beta---", need to chop off the hyphens and slash
        let rel = pxt.webConfig?.relprefix.substr(0, pxt.webConfig.relprefix.length - 3);
        if (pxt.appTarget.appTheme.homeUrl && rel) {
            if (pxt.appTarget.appTheme.homeUrl?.lastIndexOf("/") === pxt.appTarget.appTheme.homeUrl?.length - 1) {
                rel = rel.substr(1);
            }
            window.open(pxt.appTarget.appTheme.homeUrl + rel);
        }
        else {
            window.open(pxt.appTarget.appTheme.homeUrl);
        }
    }

    render() {
        const hasIdentity = pxt.auth.hasIdentity();

        const appTheme = pxt.appTarget?.appTheme;

        return <MenuBar className="header" ariaLabel={lf("Header")}>
            <div className="header-left">
                {this.getOrganizationLogo(appTheme)}
                {this.getTargetLogo(appTheme)}
            </div>

            <div className="spacer" />

            <div className="header-right">
                <Button className="menu-button" leftIcon="fas fa-home large" title={lf("Return to the editor homepage")} onClick={this.onHomeClicked}/>
            </div>
        </MenuBar>
    }
}

export default HeaderBar;