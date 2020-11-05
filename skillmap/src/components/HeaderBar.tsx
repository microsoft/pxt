/// <reference path="../lib/skillMap.d.ts" />
import * as React from "react";

import { connect } from 'react-redux';
import { dispatchSaveAndCloseActivity } from '../actions/dispatch';
import { SkillMapState } from '../store/reducer';


interface HeaderBarProps {
    activityOpen: boolean;
    dispatchSaveAndCloseActivity: () => void;
}

export class HeaderBarImpl extends React.Component<HeaderBarProps> {
    render() {
        const { activityOpen } = this.props;

        return <div className="header">
            <div className="header-left">
                <i className="icon game" />
                { activityOpen && <i className="icon arrow left" role="button" onClick={this.onBackClicked}/> }
            </div>
            <div className="spacer" />
            <div className="header-right"><i className="icon square" />MICROSOFT</div>
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