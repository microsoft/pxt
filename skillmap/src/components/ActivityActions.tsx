import * as React from "react";
import { connect } from 'react-redux';

import { dispatchOpenActivity, dispatchShowRestartActivityWarning, dispatchShowShareModal } from '../actions/dispatch';

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
    dispatchShowShareModal: (mapId: string, activityId: string) => void;
}

type ActivityActionsProps = OwnProps & DispatchProps;

export class ActivityActionsImpl extends React.Component<ActivityActionsProps> {
    protected getActivityActionText(): string {
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
        const { mapId, activityId, status, dispatchShowRestartActivityWarning } = this.props;
        tickEvent("skillmap.sidebar.restart", { path: mapId, activity: activityId, status: status || "" });
        dispatchShowRestartActivityWarning(mapId, activityId);
    }

    protected handleShareButtonClick = () => {
        const { mapId, activityId, status, dispatchShowShareModal } = this.props;
        tickEvent("skillmap.sidebar.share", { path: mapId, activity: activityId, status: status || "" });
        dispatchShowShareModal(mapId, activityId);
    }

    render() {
        const { status } = this.props;
        const activityStarted = (status && status !== "notstarted" && status !== "locked");

        if (status === "locked") return <div />

        return <div className="actions">
            <div className="action-button" role="button" onClick={this.handleActionButtonClick}>
                {this.getActivityActionText()}
            </div>
            {activityStarted && <div className="action-button" role="button" onClick={this.handleRestartButtonClick}>
                {lf("Restart")}
            </div>}
            {activityStarted && <div className="action-button" role="button" onClick={this.handleShareButtonClick}>
                {lf("Share")}
            </div>}
        </div>
    }
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchShowRestartActivityWarning,
    dispatchShowShareModal
}

export const ActivityActions = connect<{}, DispatchProps, OwnProps>(null, mapDispatchToProps)(ActivityActionsImpl);