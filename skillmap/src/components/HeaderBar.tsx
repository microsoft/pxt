/// <reference path="../lib/skillMap.d.ts" />
import * as React from "react";

import { connect } from 'react-redux';
import { dispatchSaveAndCloseActivity } from '../actions/dispatch';
import { SkillMapState } from '../store/reducer';

import logo from '../assets/logo.svg';
import organization from '../assets/microsoft.png';

interface HeaderBarProps {
    activityOpen: boolean;
    dispatchSaveAndCloseActivity: () => void;
}

export class HeaderBarImpl extends React.Component<HeaderBarProps> {
    render() {
        const { activityOpen } = this.props;
        const logoAlt = "MakeCode Logo";
        const organizationLogoAlt = "Microsoft Logo";

        return <div className="header">
            <div className="header-left">
                <div className="header-logo">
                    <img src={logo} alt={logoAlt} />
                </div>
                { activityOpen && <i className="icon arrow left" role="button" onClick={this.onBackClicked}/> }
            </div>
            <div className="spacer" />
            <div className="header-right">
                <div className="header-org-logo">
                    <img src={organization} alt={organizationLogoAlt} />
                </div>
            </div>
        </div>
    }

    onBackClicked = () => {
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
    dispatchSaveAndCloseActivity
};

export const HeaderBar = connect(mapStateToProps, mapDispatchToProps)(HeaderBarImpl);