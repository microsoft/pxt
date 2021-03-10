import * as React from "react";
import { connect } from 'react-redux';

import { dispatchShowResetUserModal } from '../actions/dispatch';

import { tickEvent } from '../lib/browserUtils';

interface DispatchProps {
    dispatchShowResetUserModal: () => void;
}

type MapActionsProps = DispatchProps;

export class MapActionsImpl extends React.Component<MapActionsProps> {
    protected handleResetButtonClick = () => {
        const { dispatchShowResetUserModal } = this.props;
        tickEvent("skillmap.reset.warning");
        dispatchShowResetUserModal();
    }

    render() {
        return <div className="actions">
            <div className="action-button" role="button" onClick={this.handleResetButtonClick}>
                {lf("Reset Progress")}
            </div>
        </div>
    }
}

const mapDispatchToProps = {
    dispatchShowResetUserModal
}

export const MapActions = connect<{}, DispatchProps, {}>(null, mapDispatchToProps)(MapActionsImpl);