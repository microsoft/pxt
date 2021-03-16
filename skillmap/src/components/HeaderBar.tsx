/// <reference path="../lib/skillMap.d.ts" />
import * as React from "react";

import { connect } from 'react-redux';
import { dispatchSaveAndCloseActivity, dispatchShowResetUserModal } from '../actions/dispatch';
import { SkillMapState } from '../store/reducer';
import { resolvePath, tickEvent } from "../lib/browserUtils";

import { Dropdown, DropdownItem } from "./Dropdown";
import { isActivityCompleted } from "../lib/skillMapUtils";
import { editorUrl } from "./makecodeFrame";

interface HeaderBarProps {
    currentMapId?: string;
    currentActivityId?: string;
    activityOpen: boolean;
    showReportAbuse?: boolean;
    completedHeaderId?: string;
    dispatchSaveAndCloseActivity: () => void;
    dispatchShowResetUserModal: () => void;
}

export class HeaderBarImpl extends React.Component<HeaderBarProps> {
    protected reportAbuseUrl = "https://github.com/contact/report-content";
    protected getSettingItems(): DropdownItem[] {
        const items: DropdownItem[] = [];
        if (this.props.showReportAbuse) {
            items.push({
                id: "report",
                label: lf("Report Abuse"),
                onClick: (id: string) => {
                    tickEvent("skillmap.reportabuse");
                    window.open(this.reportAbuseUrl);
                }
            })
        }

        if (!this.props.activityOpen) {
            items.push({
                id: "reset",
                label: lf("Reset All"),
                onClick: () => {
                    tickEvent("skillmap.reset.warning");
                    this.props.dispatchShowResetUserModal();
                }
            })
        }

        return items;
    }

    render() {
        const { activityOpen, completedHeaderId } = this.props;
        const logoAlt = "MakeCode Logo";
        const organizationLogoAlt = "Microsoft Logo";

        const items = this.getSettingItems();

        return <div className="header">
            <div className="header-left">
                <div className="header-logo">
                    <img src={resolvePath("assets/logo.svg")} alt={logoAlt} />
                </div>
                { activityOpen ?
                    <HeaderBarButton icon="icon arrow left" label={lf("Back")} title={lf("Return to activity selection")} onClick={this.onBackClicked}/> :
                    <HeaderBarButton icon="icon home" label={lf("Home")} title={lf("Return to the editor homepage")} onClick={this.onHomeClicked}/>
                }
            </div>
            <div className="spacer" />
            <div className="header-right">
                {completedHeaderId &&
                    <HeaderBarButton
                        icon="icon external"
                        label={lf("Save to My Projects")}
                        title={lf("Save this to my projects on {0}", pxt.appTarget.appTheme.homeUrl)}
                        onClick={this.onSaveClicked} />
                }
                { items?.length > 0 && <Dropdown icon="setting" className="header-settings" items={items} /> }
                <div className="header-org-logo">
                    <img src={resolvePath("assets/microsoft.png")} alt={organizationLogoAlt} />
                </div>
            </div>
        </div>
    }

    onBackClicked = () => {
        const { currentMapId, currentActivityId } = this.props;
        tickEvent("skillmap.activity.back", { path: currentMapId || "", activity: currentActivityId || "" });
        this.props.dispatchSaveAndCloseActivity();
    }

    onSaveClicked = () => {
        const { completedHeaderId, currentMapId, currentActivityId } = this.props;
        tickEvent("skillmap.export", { path: currentMapId || "", activity: currentActivityId || "" });
        window.open(`${editorUrl}#skillmapimport:${completedHeaderId}`)
    }

    onHomeClicked = () => {
        tickEvent("skillmap.home");
        window.open(pxt.appTarget.appTheme.homeUrl);
    }
}

interface HeaderBarButtonProps {
    icon: string;
    label: string;
    title: string;
    onClick: () => void;
}

const HeaderBarButton = (props: HeaderBarButtonProps) => {
    const { icon, label, title, onClick } = props;

    return <div className="header-button" title={title} role="button" onClick={onClick}>
        <i className={icon} />
        <span className="header-button-label">{label}</span>
    </div>
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    let completedHeaderId: string | undefined;
    if (state.editorView?.currentHeaderId) {
        if (isActivityCompleted(state.user, state.pageSourceUrl, state.editorView.currentMapId, state.editorView.currentActivityId)) {
            completedHeaderId = state.editorView.currentHeaderId;
        }
    }

    const activityOpen = !!state.editorView;

    return {
        activityOpen,
        currentMapId: activityOpen && state.editorView?.currentMapId,
        currentActivityId: activityOpen && state.editorView?.currentActivityId,
        showReportAbuse: state.pageSourceStatus === "unknown",
        completedHeaderId
    }
}


const mapDispatchToProps = {
    dispatchSaveAndCloseActivity,
    dispatchShowResetUserModal
};

export const HeaderBar = connect(mapStateToProps, mapDispatchToProps)(HeaderBarImpl);