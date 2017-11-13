/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface NotificationBannerProps extends ISettingsProps {
    delayTime?: number; //milliseconds - delay before banner is shown
    displayTime?: number; //milliseconds - duration of banner display
    sleepTime?: number; //seconds - time to hide banner after it is dismissed
    bannerTheme?: string;
    content?: JSX.Element;
}

export class NotificationBanner extends data.Component<NotificationBannerProps, {}> {
    delayTime: number;
    sleepTime: number;
    doneSleeping: boolean;
    bannerTheme: string;

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
        this.props.parent.showBanner()
    }

    hide(mode: string) {
        pxt.tickEvent("notificationBanner." + mode + "Close");
        pxt.storage.setLocal("lastBannerClosedTime", Util.nowSeconds().toString());
        this.props.parent.hideBanner();
    }

    //TODO need shouldComponentUpdate?

    constructor(props: NotificationBannerProps) {
        super(props);
        this.delayTime = this.props.delayTime || 0;
        this.doneSleeping = this.sleepDone();
        this.bannerTheme = this.props.bannerTheme || "default";

        setTimeout(() => this.show(), this.delayTime);
        if (this.props.displayTime) {
            setTimeout(() => this.hide("automatic"), this.delayTime + this.props.displayTime);
        }
    }

    renderCore() {
        return (
            (this.props.parent.state.notificationBannerVisible  && this.doneSleeping) ?
            <div id="notificationBanner" className={`ui attached ${this.bannerTheme} message`}>
                <div className="bannerLeft">
                    {this.props.content}
                </div>
                <div className="close" tabIndex={0} onClick={() => this.hide("manual")}>
                    <sui.Icon icon="close" />
                </div>
            </div> :
            <div></div>
        );
    }
}

export class WindowsStoreBanner extends data.Component<ISettingsProps, {}> {
    renderCore() {
        return (
            <NotificationBanner
                parent={this.props.parent}
                delayTime={1000}
                //TODO display time
                //TODO sleep time
                sleepTime={10}
                content={<WindowsStoreContent />}
            />)
    }
}

export class WindowsStoreContent extends data.Component<{}, {}> {
    renderCore() {
        return (
            <div className="content">
                <sui.Link class="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={pxt.appTarget.appTheme.windowsStoreLink} onClick={() => pxt.tickEvent("banner.linkClicked")}>
                    <img className="bannerIcon" src={Util.pathJoin(pxt.webConfig.commitCdnUrl, `images/windowsstorebag.png`)}></img>
                </sui.Link>
                <sui.Link class="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={pxt.appTarget.appTheme.windowsStoreLink} onClick={() => pxt.tickEvent("banner.linkClicked")}>
                    {lf("Get the app from the Windows Store")}
                </sui.Link>
            </div>
        );
    }
}

export class ExperimentalBanner extends data.Component<ISettingsProps, {}> {
    renderCore() {
        return (
            <NotificationBanner
                parent={this.props.parent}
                bannerTheme={"negative"}
                content={<ExperimentalContent />}
            />
        )
    }
}

export class ExperimentalContent extends data.Component<{}, {}> {
    renderCore() {
        const liveUrl = pxt.appTarget.appTheme.homeUrl + location.search + location.hash;
        return (
            <div className="content">
                <sui.Icon icon="warning circle" />
                <div className="header">{lf("You are viewing an experimental version of the editor") }</div>
                <sui.Link class="link" ariaLabel={lf("Go back to live editor")} href={liveUrl}>{lf("Take me back")}</sui.Link>
            </div>
        );
    }
}