/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="../../localtypings/mscc.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

import Cloud = pxt.Cloud;

type ISettingsProps = pxt.editor.ISettingsProps;

export interface GenericBannerProps extends ISettingsProps {
    id: string;
    delayTime?: number; //milliseconds - delay before banner is shown
    displayTime?: number; //milliseconds - duration of banner display
    sleepTime?: number; //seconds - time to hide banner after it is dismissed
    bannerType?: string;
    children?: React.ReactChild;
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
        this.props.parent.setBanner(true);
        this.render();
    }

    hide(mode: string) {
        pxt.tickEvent(`notificationBanner.${this.props.id}.` + mode + "Close");
        pxt.storage.setLocal("lastBannerClosedTime", pxt.Util.nowSeconds().toString());
        this.props.parent.setBanner(false);
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
    }

    handleBannerClick() {
        pxt.tickEvent("banner.linkClicked", undefined, { interactiveConsent: true });
    }

    renderCore() {
        if (pxt.analytics.isCookieBannerVisible()) {
            // don't show any banner while cookie banner is up
            return <div></div>;
        }

        const delayTime =  300 * 1000; // 5 minutes
        const displayTime = 30 * 1000; // 30 seconds
        const sleepTime = 24 * 2 * 3600; // 2 days

        const targetConfig = this.getData("target-config:") as pxt.TargetConfig;
        const isApp = pxt.winrt.isWinRT();
        const targetTheme = pxt.appTarget.appTheme;                

        if ( Cloud.isOnline() && !isApp && !pxt.shell.isSandboxMode()) {

            const showNewEditorLinkBanner = targetConfig && targetConfig.newEditorLink;
            if (showNewEditorLinkBanner) {
                return (
                    <GenericBanner id="beta" parent={this.props.parent} delayTime={delayTime} displayTime={displayTime} sleepTime={sleepTime}>
                        <sui.Link class="link" target="_blank" ariaLabel={lf("Open beta url")} href={targetConfig.newEditorLink} onClick={this.handleBannerClick}>
                            <img className="bannerIcon" src={pxt.Util.pathJoin(pxt.webConfig.commitCdnUrl, `images/logo.svg`)} alt={lf("MakeCode logo")}></img>
                            
                        </sui.Link>
                        <sui.Link class="link" target="_blank" ariaLabel={lf("Open beta url")} href={targetConfig.newEditorLink} onClick={this.handleBannerClick}>
                            {lf("Try the beta!")}
                        </sui.Link> 
                    </GenericBanner>
                );
            }

            const isWindows10 = pxt.BrowserUtils.isWindows10();
            const showWindowsStoreBanner = targetConfig && targetConfig.windowsStoreLink && isWindows10;
            if (showWindowsStoreBanner) {
                return (
                    <GenericBanner id="uwp" parent={this.props.parent} delayTime={delayTime} displayTime={displayTime} sleepTime={sleepTime}>
                        <sui.Link class="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={targetConfig.windowsStoreLink} onClick={this.handleBannerClick}>
                            <img className="bannerIcon" src={pxt.Util.pathJoin(pxt.webConfig.commitCdnUrl, `images/windowsstorebag.png`)} alt={lf("Windows store logo")}></img>
                        </sui.Link>
                        <sui.Link class="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={targetConfig.windowsStoreLink} onClick={this.handleBannerClick}>
                            {lf("Want a faster download? Get the app!")}
                        </sui.Link>
                    </GenericBanner>
                );
            }
        }

        const isLocalServe = location.hostname === "localhost";
        const isExperimentalUrlPath = location.pathname !== "/"
            && (targetTheme.appPathNames || []).indexOf(location.pathname) === -1;

        const showExperimentalBanner = !isLocalServe && isApp && isExperimentalUrlPath;
        if (showExperimentalBanner) {
            const liveUrl = pxt.appTarget.appTheme.homeUrl + location.search + location.hash;
            return (
                <GenericBanner id="experimental" parent={this.props.parent} bannerType={"negative"} >
                    <sui.Icon icon="warning circle" />
                    <div className="header">{lf("You are viewing an experimental version of the editor")}</div>
                    <sui.Link class="link" ariaLabel={lf("Go back to live editor")} href={liveUrl}>{lf("Take me back")}</sui.Link>
                </GenericBanner>
            );
        }

        return <div></div>;
    }
}