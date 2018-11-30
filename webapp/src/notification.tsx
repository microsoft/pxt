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
        const showWindowsStoreBanner = isWindows10 && Cloud.isOnline() && targetConfig && targetConfig.windowsStoreLink
            && !isApp
            && !pxt.shell.isSandboxMode();

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

        if (showWindowsStoreBanner) {
            const delayTime = 300 * 1000; // 5 minutes
            const displayTime = 20 * 1000; // 20 seconds
            const sleepTime = 24 * 7 * 3600; // 1 week
            return (
                <GenericBanner id="uwp" parent={this.props.parent} delayTime={delayTime} displayTime={displayTime} sleepTime={sleepTime}>
                    <sui.Link className="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={targetConfig.windowsStoreLink} onClick={this.handleBannerClick}>
                        <img className="bannerIcon" src={pxt.Util.pathJoin(pxt.webConfig.commitCdnUrl, `images/windowsstorebag.png`)} alt={lf("Windows store logo")}></img>
                    </sui.Link>
                    <sui.Link className="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={targetConfig.windowsStoreLink} onClick={this.handleBannerClick}>
                        {lf("Want a faster download? Get the app!")}
                    </sui.Link>
                </GenericBanner>
            );
        }

        return <div></div>;
    }
}