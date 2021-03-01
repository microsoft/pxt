import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';

/* tslint:disable:no-import-side-effect */
import '../styles/infopanel.css'
/* tslint:enable:no-import-side-effect */

interface InfoPanelProps {
    selectedItem: string;
}

export class InfoPanelImpl extends React.Component<InfoPanelProps> {
    render() {
        const  { selectedItem } = this.props;
        return <div className="info-panel">
            <h1>Info Panel</h1>
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    return {
        selectedItem: state.selectedItem
    };
}

export const InfoPanel = connect(mapStateToProps)(InfoPanelImpl);