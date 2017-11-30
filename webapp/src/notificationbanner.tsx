/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";
import * as electron from "./electron";

import Cloud = pxt.Cloud;

type ISettingsProps = pxt.editor.ISettingsProps;

export interface GenericBannerProps extends ISettingsProps {
    delayTime?: number; //milliseconds - delay before banner is shown
    displayTime?: number; //milliseconds - duration of banner display
    sleepTime?: number; //seconds - time to hide banner after it is dismissed
    bannerType?: string;
    children?: React.ReactChild;
    ref?: any;
}

export class GenericBanner extends React.Component<GenericBannerProps, {}> {
    delayTime: number;
    doneSleeping: boolean;
    bannerType: string;
    timer: number;

    constructor(props: GenericBannerProps) {
        super(props);
        this.delayTime = this.props.delayTime || 0;
        this.doneSleeping = this.sleepDone();
        this.bannerType = this.props.bannerType || "default";
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
        const now = Util.nowSeconds();
        return (now - lastBannerClosedTime) > this.props.sleepTime;
    }

    show() {
        pxt.tickEvent("notificationBanner.show");
        if (this.props.displayTime) {
            this.timer = setTimeout(() => this.hide("automatic"), this.delayTime + this.props.displayTime);
        }
        this.props.parent.setBanner(true);
        this.render();
    }

    hide(mode: string) {
        pxt.tickEvent("notificationBanner." + mode + "Close");
        pxt.storage.setLocal("lastBannerClosedTime", Util.nowSeconds().toString());
        this.props.parent.setBanner(false);
        this.render();
    }

    render() {
        return (
            (this.props.parent.state.bannerVisible  && this.doneSleeping) ?
            <div id="notificationBanner" className={`ui attached ${this.bannerType} message`}>
                <div className="bannerLeft">
                    <div className="content">
                        {this.props.children}
                    </div>
                </div>
                <div className="close" tabIndex={0} onClick={() => {this.hide("manual"); clearTimeout(this.timer)}}>
                    <sui.Icon icon="close" />
                </div>
            </div> :
            <div></div>
        );
    }
}

export class NotificationBanner extends React.Component<ISettingsProps, {}> {
    render() {
        const targetTheme = pxt.appTarget.appTheme;
        const isApp = electron.isElectron || pxt.winrt.isWinRT();
        const isLocalServe = location.hostname === "localhost";
        const isExperimentalUrlPath = location.pathname !== "/"
            && (targetTheme.appPathNames || []).indexOf(location.pathname) === -1;
        const showExperimentalBanner = !isLocalServe && isApp && isExperimentalUrlPath;
        const isWindows10 = pxt.BrowserUtils.isWindows10();
        const showWindowsStoreBanner = isWindows10 && Cloud.isOnline() && targetTheme.windowsStoreLink && !isApp;

        if (showWindowsStoreBanner) {
            return (
                <GenericBanner parent={this.props.parent} delayTime={10000} displayTime={45000} sleepTime={604800}>
                    <sui.Link class="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={pxt.appTarget.appTheme.windowsStoreLink} onClick={() => pxt.tickEvent("banner.linkClicked")}>
                        <img className="bannerIcon" src={Util.pathJoin(pxt.webConfig.commitCdnUrl, `images/windowsstorebag.png`)}></img>
                    </sui.Link>
                    <sui.Link class="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={pxt.appTarget.appTheme.windowsStoreLink} onClick={() => pxt.tickEvent("banner.linkClicked")}>
                        {lf("Want a faster download? Get the app!")}
                    </sui.Link>
                </GenericBanner>
            );
        }

        if (showExperimentalBanner) {
            const liveUrl = pxt.appTarget.appTheme.homeUrl + location.search + location.hash;
            return (
                <GenericBanner parent={this.props.parent} bannerType={"negative"} >
                    <sui.Icon icon="warning circle" />
                    <div className="header">{lf("You are viewing an experimental version of the editor") }</div>
                    <sui.Link class="link" ariaLabel={lf("Go back to live editor")} href={liveUrl}>{lf("Take me back")}</sui.Link>
                </GenericBanner>
            );
        }

        return <div></div>;
    }
}