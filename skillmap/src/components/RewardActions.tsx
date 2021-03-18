import * as React from "react";
import { connect } from 'react-redux';

import { dispatchOpenActivity, dispatchShowCompletionModal } from '../actions/dispatch';

import { ActivityStatus } from '../lib/skillMapUtils';
import { tickEvent } from "../lib/browserUtils";

interface OwnProps {
    mapId: string;
    activityId: string;
    status?: ActivityStatus;
    type?: MapRewardType;
}

interface DispatchProps {
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchShowCompletionModal: (mapId: string, activityId: string) => void;
}

type RewardActionsProps = OwnProps & DispatchProps;

export class RewardActionsImpl extends React.Component<RewardActionsProps> {
    protected getRewardActionText(): string {
        switch (this.props.type) {
            case "certificate":
                return lf("Claim Certificate");
            default:
                return lf("Claim Reward");
        }
    }

    protected handleActionButtonClick = () => {
        const { status, mapId, activityId, dispatchShowCompletionModal } = this.props;
        switch (status) {
            case "locked":
                break;
            default:
                tickEvent("skillmap.sidebar.reward", { path: mapId, activity: activityId })
                return dispatchShowCompletionModal(mapId, activityId)
        }
    }

    render() {
        const { status } = this.props;
        if (status === "locked") return <div />

        return <div className="actions">
            <div className="action-button" role="button" onClick={this.handleActionButtonClick}>
                {this.getRewardActionText()}
            </div>
        </div>
    }
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchShowCompletionModal
}

export const RewardActions = connect<{}, DispatchProps, OwnProps>(null, mapDispatchToProps)(RewardActionsImpl);