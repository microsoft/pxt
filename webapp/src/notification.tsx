import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface NotificationBannerProps extends ISettingsProps {
    hide?: () => void;
    show?: () => void;
    visible?: boolean;
    delayTime?: number;
    displayTime?: number;
    hibernationTime?: number;
    bannerTheme?: string;
    iconUrl?: string;
}

export class NotificationBanner extends data.Component<NotificationBannerProps, {}> {
    delayTime: number;
    displayTime: number;
    hibernationDone: boolean;
    bannerTheme: string;

    hibernationIsDone() {
        const lastBannerClosedTime = parseInt(pxt.storage.getLocal("lastBannerClosedTime") || "0");
        const now = Util.nowSeconds();
        //604800 = seconds in a week
        //TODO
        //return (now - lastBannerClosedTime) > 604800;
        return (now - lastBannerClosedTime) > 10;
    }

    show() {
        pxt.tickEvent("notificationBanner.show");
        this.props.show()
    }

    hide(mode: string) {
        pxt.tickEvent("notificationBanner." + mode + "Close");
        pxt.storage.setLocal("lastBannerClosedTime", Util.nowSeconds().toString());
        this.props.hide();
    }

    //TODO need shouldComponentUpdate?

    constructor(props: NotificationBannerProps) {
        super(props);
        this.delayTime = this.props.delayTime || 0;
        this.displayTime = this.props.displayTime;
        this.hibernationDone = this.hibernationIsDone();
        this.bannerTheme = this.props.bannerTheme || "default";

        setTimeout(() => this.show(), this.delayTime);
        if (this.displayTime) {
            setTimeout(() => this.hide("automatic"), this.delayTime + this.displayTime);
        }
    }

    renderCore() {
        return (
            (this.props.visible  && this.hibernationDone) ?
            <div id="notificationBanner" className={`ui attached ${this.bannerTheme} message`}>
                <sui.Link class="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={pxt.appTarget.appTheme.windowsStoreLink} onClick={() => pxt.tickEvent("banner.linkClicked")}>
                    <span>
                        <img className="bannerIcon" src="https://assets.windowsphone.com/13484911-a6ab-4170-8b7e-795c1e8b4165/English_get_L_InvariantCulture_Default.png">
                        </img>
                    </span>
                    {lf("Get the app from the Windows Store")}
                </sui.Link>
                <div className="close" tabIndex={0} onClick={() => this.hide("manual")}>
                    <sui.Icon icon="close" />
                </div>
            </div> :
            <div></div>
        );
    }
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export class ExperimentalBannerState {
    hideExperimentalBanner: boolean;
}

export class ExperimentalBanner extends data.Component<ISettingsProps, ExperimentalBannerState> {

    hideBanner() {
        this.setState({ hideExperimentalBanner: true });
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ExperimentalBannerState, nextContext: any): boolean {
        return this.state.hideExperimentalBanner != nextState.hideExperimentalBanner;
    }

    renderCore() {
        const {hideExperimentalBanner} = this.state;
        if (hideExperimentalBanner) return <div />;
        const liveUrl = pxt.appTarget.appTheme.homeUrl + location.search + location.hash;

        return <div id="experimentalBanner" className="ui icon top attached fixed negative mini message">
            <sui.Icon icon="warning circle" />
            <sui.Icon icon="close" onClick={() => this.hideBanner() } />
            <div className="content">
                <div className="header">{lf("You are viewing an experimental version of the editor") }</div>
                <a href={liveUrl}>{lf("Take me back") }</a>
            </div>
        </div>;
    }
}