/// <reference path="../lib/skillMap.d.ts" />
import * as React from "react";

import { connect } from 'react-redux';
import { dispatchSaveAndCloseActivity, dispatchShowResetUserModal } from '../actions/dispatch';
import { SkillMapState } from '../store/reducer';
import { isLocal, resolvePath, tickEvent } from "../lib/browserUtils";

import { Dropdown, DropdownItem } from "./Dropdown";
import { isActivityCompleted } from "../lib/skillMapUtils";

interface HeaderBarProps {
    currentMapId?: string;
    currentActivityId?: string;
    activityOpen: boolean;
    showReportAbuse?: boolean;
    currentActivityDisplayName?: string;
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

    protected getHelpItems(): DropdownItem[] {
        const items: DropdownItem[] = [];
        if (this.props.activityOpen) {
            items.push({
                id: "feedback",
                label: lf("Feedback"),
                onClick: this.onBugClicked
            });
        }
        return items;
    }

    render() {
        const { activityOpen, currentActivityDisplayName } = this.props;
        const logoAlt = "MakeCode Logo";
        const organizationLogoAlt = "Microsoft Logo";
        const logoSrc = (isLocal() || !pxt.appTarget?.appTheme?.logoUrl ) ? resolvePath("assets/logo.svg") : pxt.appTarget?.appTheme?.logo;

        const settingItems = this.getSettingItems();
        const helpItems = this.getHelpItems();

        return <div className="header">
            <div className="header-left">
                <div className="header-logo">
                    <img src={logoSrc} alt={logoAlt} />
                </div>
                { activityOpen ?
                    <HeaderBarButton icon="icon arrow left" label={lf("Back")} title={lf("Return to activity selection")} onClick={this.onBackClicked}/> :
                    <HeaderBarButton icon="icon home" label={lf("Home")} title={lf("Return to the editor homepage")} onClick={this.onHomeClicked}/>
                }
            </div>
            { currentActivityDisplayName &&
                <div className="header-activity-display-name" title={currentActivityDisplayName}>
                    {currentActivityDisplayName}
                </div>
            }
            <div className="spacer" />
            <div className="header-right">
                { helpItems?.length > 0 && <Dropdown icon="help circle" className="header-dropdown" items={helpItems} /> }
                { settingItems?.length > 0 && <Dropdown icon="setting" className="header-dropdown" items={settingItems} /> }
                <div className="header-org-logo">
                    <img className="header-org-logo-large" src={resolvePath("assets/microsoft.png")} alt={organizationLogoAlt} />
                    <img className="header-org-logo-small" src={resolvePath("assets/microsoft-square.png")} alt={organizationLogoAlt} />
                </div>
            </div>
        </div>
    }

    onBackClicked = () => {
        const { currentMapId, currentActivityId } = this.props;
        tickEvent("skillmap.activity.back", { path: currentMapId || "", activity: currentActivityId || "" });
        this.props.dispatchSaveAndCloseActivity();
    }

    onHomeClicked = () => {
        tickEvent("skillmap.home");
        window.open(pxt.appTarget.appTheme.homeUrl);
    }

    onBugClicked = () => {
        tickEvent("skillmap.bugreport");
        (window as any).usabilla_live?.("click");
    }
}

interface HeaderBarButtonProps {
    icon: string;
    label?: string;
    title: string;
    onClick: () => void;
}

const HeaderBarButton = (props: HeaderBarButtonProps) => {
    const { icon, label, title, onClick } = props;

    return <div className={`header-button ${!label ? "icon-only" : ""}`} title={title} role="button" onClick={onClick}>
        <i className={icon} />
        {label && <span className="header-button-label">{label}</span>}
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
    let currentActivityDisplayName: string | undefined;

    if (state.editorView?.currentActivityId) {
        const activity = state.maps[state.editorView.currentMapId].activities[state.editorView.currentActivityId];
        if (activity) {
            currentActivityDisplayName = activity.displayName;
        }
    }

    return {
        activityOpen,
        currentMapId: activityOpen && state.editorView?.currentMapId,
        currentActivityId: activityOpen && state.editorView?.currentActivityId,
        showReportAbuse: state.pageSourceStatus === "unknown",
        currentActivityDisplayName
    }
}


const mapDispatchToProps = {
    dispatchSaveAndCloseActivity,
    dispatchShowResetUserModal
};

export const HeaderBar = connect(mapStateToProps, mapDispatchToProps)(HeaderBarImpl);