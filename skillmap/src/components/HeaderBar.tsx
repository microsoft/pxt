/// <reference path="../lib/skillMap.d.ts" />
import * as React from "react";

import { connect } from 'react-redux';
import { dispatchSaveAndCloseActivity, dispatchShowReportAbuseModal } from '../actions/dispatch';
import { SkillMapState } from '../store/reducer';
import { resolvePath, tickEvent } from "../lib/browserUtils";

import { Dropdown } from "./Dropdown";

interface HeaderBarProps {
    activityOpen: boolean;
    dispatchSaveAndCloseActivity: () => void;
    dispatchShowReportAbuseModal: () => void;
}

export class HeaderBarImpl extends React.Component<HeaderBarProps> {
    render() {
        const { activityOpen, dispatchShowReportAbuseModal } = this.props;
        const logoAlt = "MakeCode Logo";
        const organizationLogoAlt = "Microsoft Logo";

        const reportAbuseOption = {
            id: "report",
            label: "Report Abuse",
            onClick: (id: string) => dispatchShowReportAbuseModal() };

        return <div className="header">
            <div className="header-left">
                { activityOpen
                    ? <i className="icon arrow left" role="button" onClick={this.onBackClicked} />
                    : <div className="header-logo">
                        <img src={resolvePath("assets/logo.svg")} alt={logoAlt} />
                    </div>
                }
            </div>
            <div className="spacer" />
            <div className="header-right">
                <Dropdown icon="setting" className="header-settings" items={[reportAbuseOption]} />
                <div className="header-org-logo">
                    <img src={resolvePath("assets/microsoft.png")} alt={organizationLogoAlt} />
                </div>
            </div>
        </div>
    }

    onBackClicked = () => {
        tickEvent("skillmap.activity.back");
        this.props.dispatchSaveAndCloseActivity();
    }
}


function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    return {
        activityOpen: !!state.editorView
    }
}


const mapDispatchToProps = {
    dispatchSaveAndCloseActivity,
    dispatchShowReportAbuseModal
};

export const HeaderBar = connect(mapStateToProps, mapDispatchToProps)(HeaderBarImpl);