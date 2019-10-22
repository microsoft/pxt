/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="../../localtypings/mscc.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as electron from "./electron";

import Cloud = pxt.Cloud;

type ISettingsProps = pxt.editor.ISettingsProps;

export interface GenericBannerProps extends ISettingsProps {
    id: string;
    delayTime?: number; //milliseconds - delay before banner is shown
    displayTime?: number; //milliseconds - duration of banner display
    sleepTime?: number; //seconds - time to hide banner after it is dismissed
    bannerType?: string;
    ref?: any;
}

export class GenericBanner extends data.Component<GenericBannerProps, {}> {
    delayTime: number;
    doneSleeping: boolean;
    bannerType: string;
    timer: number;

    constructor(props: GenericBannerProps) {
        super(props);
        this.delayTime = this.props.delayTime || 0;
        this.doneSleeping = this.sleepDone();
        this.bannerType = this.props.bannerType || "default";

        this.handleClick = this.handleClick.bind(this);
    }

    componentDidMount() {
        if (this.doneSleeping) {
            this.timer = setTimeout(() => this.show(), this.delayTime);
        }
    }

    componentWillUnmount() {
        clearTimeout(this.timer);
    }

    sleepDone() {
        if (!this.props.sleepTime) {
            return true;
        }
        const lastBannerClosedTime = parseInt(pxt.storage.getLocal("lastBannerClosedTime") || "0");
        const now = pxt.Util.nowSeconds();
        return (now - lastBannerClosedTime) > this.props.sleepTime;
    }

    show() {
        pxt.tickEvent(`notificationBanner.${this.props.id}.show`);
        if (this.props.displayTime) {
            this.timer = setTimeout(() => this.hide("automatic"), this.delayTime + this.props.displayTime);
        }
        this.props.parent.setBannerVisible(true);
        this.render();
    }

    hide(mode: string) {
        pxt.tickEvent(`notificationBanner.${this.props.id}.` + mode + "Close");
        pxt.storage.setLocal("lastBannerClosedTime", pxt.Util.nowSeconds().toString());
        this.props.parent.setBannerVisible(false);
        this.render();
    }

    handleClick() {
        this.hide("manual");
        clearTimeout(this.timer);
    }

    renderCore() {
        return (
            (this.props.parent.state.bannerVisible && this.doneSleeping) ?
                <div id="notificationBanner" className={`ui attached ${this.bannerType} message`}>
                    <div className="bannerLeft">
                        <div className="content">
                            {this.props.children}
                        </div>
                    </div>
                    <div className="bannerRight">
                        <sui.Icon icon="close" tabIndex={0} onClick={this.handleClick} />
                    </div>
                </div> :
                <div></div>
        );
    }
}

export class NotificationBanner extends data.Component<ISettingsProps, {}> {

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
        }

        this.handleBannerClick = this.handleBannerClick.bind(this);
        this.clearExperiments = this.clearExperiments.bind(this);
    }

    handleBannerClick() {
        pxt.tickEvent("banner.linkClicked", undefined, { interactiveConsent: true });
    }

    clearExperiments() {
        pxt.tickEvent("banner.experiments", undefined, { interactiveConsent: true });
        pxt.editor.experiments.clear();
        this.props.parent.reloadEditor();
    }

    renderCore() {
        if (pxt.analytics.isCookieBannerVisible()) {
            // don't show any banner while cookie banner is up
            return <div></div>;
        }

        const targetTheme = pxt.appTarget.appTheme;
        const isApp = pxt.winrt.isWinRT() || pxt.BrowserUtils.isElectron();
        const isLocalServe = location.hostname === "localhost";
        const isExperimentalUrlPath = location.pathname !== "/"
            && (targetTheme.appPathNames || []).indexOf(location.pathname) === -1;
        const showExperimentalBanner = !isLocalServe && isApp && isExperimentalUrlPath;
        const isWindows10 = pxt.BrowserUtils.isWindows10();
        const targetConfig = this.getData("target-config:") as pxt.TargetConfig;
        const showExperiments = pxt.editor.experiments.someEnabled();

        if (showExperiments) {
            const displayTime = 20 * 1000; // 20 seconds
            return <GenericBanner id="experimentsbanner" parent={this.props.parent} bannerType={"negative"} displayTime={displayTime} >
                <sui.Icon icon="information circle" />
                <div className="header">{lf("Experiments enabled.")}</div>
                <sui.Link className="link" ariaLabel={lf("Clear")} onClick={this.clearExperiments} >{lf("Clear")}</sui.Link>
            </GenericBanner>
        }

        if (showExperimentalBanner) {
            const liveUrl = pxt.appTarget.appTheme.homeUrl + location.search + location.hash;
            return (
                <GenericBanner id="experimental" parent={this.props.parent} bannerType={"negative"} >
                    <sui.Icon icon="warning circle" />
                    <div className="header">{lf("You are viewing an experimental version of the editor")}</div>
                    <sui.Link className="link" ariaLabel={lf("Go back to live editor")} href={liveUrl}>{lf("Take me back")}</sui.Link>
                </GenericBanner>
            );
        }

        const showGenericBanner = !isApp && !pxt.shell.isSandboxMode() && targetConfig && targetConfig.banner;
        if (showGenericBanner) {
            //TODO (abchatra): Warning this is not localized.
            let banner = targetConfig.banner;
            let link = banner.link; //ms-windows-store://pdp/?ProductId=9PGZHWSK0PGD
            let text = banner.text; //lf("Want a faster download? Get the app!")
            let icon = banner.icon; //`images/windowsstorebag.png`
            
            if (link && text && icon) {
                const delayTime = 300 * 1000; // 5 minutes
                const displayTime = 20 * 1000; // 20 seconds
                const sleepTime = 24 * 7 * 3600; // 1 week

                return (
                    <GenericBanner id="banner" parent={this.props.parent} delayTime={delayTime} displayTime={displayTime} sleepTime={sleepTime}>
                        <sui.Link className="link" target="_blank" ariaLabel={lf("Link to the banner page")} href={banner.link} onClick={this.handleBannerClick}>
                            <img className="bannerIcon" src={pxt.Util.pathJoin(pxt.webConfig.commitCdnUrl, banner.icon)} alt={lf("logo")}></img>
                        </sui.Link>
                        <sui.Link className="link" target="_blank" ariaLabel={lf("Link to the banner page")} href={link} onClick={this.handleBannerClick}>
                            {text}
                        </sui.Link>
                    </GenericBanner>
                );
            }
        }

        return <div></div>;
    }
}