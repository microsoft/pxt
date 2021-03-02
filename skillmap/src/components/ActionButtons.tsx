import * as React from "react";
import { connect } from 'react-redux';

import { dispatchOpenActivity, dispatchShowRestartActivityWarning } from '../actions/dispatch';

import { ActivityStatus } from '../lib/skillMapUtils';
import { tickEvent } from '../lib/browserUtils';

interface OwnProps {
    mapId: string;
    activityId: string;
    status?: ActivityStatus;
}

interface DispatchProps {
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchShowRestartActivityWarning: (mapId: string, activityId: string) => void;
}

type ActionButtonsProps = OwnProps & DispatchProps;

export class ActionButtonsImpl extends React.Component<ActionButtonsProps> {
    protected getSkillCardActionText(): string {
        switch (this.props.status) {
            case "locked":
                return lf("LOCKED");
            case "completed":
                return lf("VIEW CODE");
            case "inprogress":
            case "restarted":
                return lf("CONTINUE");
            case "notstarted":
            default:
                return lf("START");
        }
    }

    protected isCompleted(status: ActivityStatus): boolean {
        return status === "completed" || status === "restarted";
    }

    protected handleActionButtonClick = () => {
        const { status, mapId, activityId, dispatchOpenActivity } = this.props;

        switch (status) {
            case "locked":
                break;
            case "completed":
            case "inprogress":
            case "notstarted":
            case "restarted":
            default:
                tickEvent("skillmap.activity.open", { path: mapId, activity: activityId, status: status || "" });
                return dispatchOpenActivity(mapId, activityId);
        }
    }

    protected handleRestartButtonClick = () => {
        const { mapId, activityId, dispatchShowRestartActivityWarning } = this.props;
        dispatchShowRestartActivityWarning(mapId, activityId);
    }

    render() {
        const { status } = this.props;
        const completed = this.isCompleted(status || "notstarted");

        if (status === "locked") return <div />

        return <div className="activity-actions">
            <div className="action-button" role="button" onClick={this.handleActionButtonClick}>
                {this.getSkillCardActionText()}
            </div>
            {completed && <div className="action-button" role="button" onClick={this.handleRestartButtonClick}>
                {lf("RESTART")}
            </div>}
        </div>
    }
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchShowRestartActivityWarning
}

export const ActionButtons = connect<{}, DispatchProps, OwnProps>(null, mapDispatchToProps)(ActionButtonsImpl);