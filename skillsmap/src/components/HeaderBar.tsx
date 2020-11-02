import * as React from "react";
/// <reference path="../lib/skillMap.d.ts" />

import { connect } from 'react-redux';
import { dispatchChangeSelectedItem } from '../actions/dispatch';
import { SkillsMapState } from '../store/reducer';


interface HeaderBarProps {
    selectedItem?: string;
    dispatchChangeSelectedItem: (id: string) => void;
}

export class HeaderBarImpl extends React.Component<HeaderBarProps> {
    render() {
        const { selectedItem } = this.props;

        return <div className="header">
            <div className="header-left">
                <i className="icon game" />
                { selectedItem && <i className="icon arrow left" role="button" onClick={this.onBackClicked}/> }

            </div>
            <div className="spacer" />
            <div className="header-right"><i className="icon square" />MICROSOFT</div>
        </div>
    }

    onBackClicked = () => {
        this.props.dispatchChangeSelectedItem("");
    }
}


function mapStateToProps(state: SkillsMapState, ownProps: any) {
    if (!state) return {};
    return {
        selectedItem: state.selectedItem
    }
}


const mapDispatchToProps = {
    dispatchChangeSelectedItem
};

export const HeaderBar = connect(mapStateToProps, mapDispatchToProps)(HeaderBarImpl);