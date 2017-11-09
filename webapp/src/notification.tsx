import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;

export class NotificationBanner extends data.Component<ISettingsProps, {}> {
    iconImage: HTMLImageElement;

    renderCore() {
        return (
            <div id="notificationBanner" className="ui attached message">
                <sui.Link class="link" target="_blank" ariaLabel={lf("View app in the Windows store")} href={pxt.appTarget.appTheme.windowsStoreLink} onClick={() => pxt.tickEvent("banner.linkClicked")}>
                    <span>
                        <img className="bannerIcon" ref={e => this.iconImage = e}>
                        </img>
                    </span>
                    {lf("Get the app from the Windows Store")}
                </sui.Link>
                <div className="close" tabIndex={0} onClick={() => {pxt.tickEvent("banner.userClosed"); this.props.parent.hideBanner()}}>
                    <sui.Icon icon="close" />
                </div>
            </div>
        );
    }

    componentDidMount() {
        if (this.iconImage) {
            this.iconImage.setAttribute("src", "https://assets.windowsphone.com/13484911-a6ab-4170-8b7e-795c1e8b4165/English_get_L_InvariantCulture_Default.png");
        }
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