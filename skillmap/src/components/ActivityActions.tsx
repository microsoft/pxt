import * as React from "react";
import { connect } from 'react-redux';

import { dispatchOpenActivity, dispatchShowRestartActivityWarning, dispatchShowShareModal, dispatchRestartActivity, dispatchShowLoginModal } from '../actions/dispatch';

import { ActivityStatus, isCodeCarryoverEnabled, lookupPreviousCompletedActivityState } from '../lib/skillMapUtils';
import { tickEvent } from '../lib/browserUtils';
import { editorUrl } from "./makecodeFrame";
import { SkillMapState } from "../store/reducer";

import { Button } from "react-common/components/controls/Button";

interface OwnProps {
    mapId: string;
    activityId: string;
    status?: ActivityStatus;
    completedHeaderId?: string;
    previousHeaderId?: string;
    showCodeCarryoverModal?: boolean;
    signedIn?: boolean;
}

interface DispatchProps {
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchShowRestartActivityWarning: (mapId: string, activityId: string) => void;
    dispatchShowShareModal: (mapId: string, activityId: string) => void;
    dispatchRestartActivity: (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => void;
    dispatchShowLoginModal: () => void;
}

type ActivityActionsProps = OwnProps & DispatchProps;

export class ActivityActionsImpl extends React.Component<ActivityActionsProps> {
    protected getActivityActionText(): string {
        switch (this.props.status) {
            case "locked":
                return lf("Locked");
            case "completed":
                return lf("View Code");
            case "inprogress":
            case "restarted":
                return lf("Continue");
            case "notstarted":
            default:
                return lf("Start");
        }
    }

    protected isCompleted(status: ActivityStatus): boolean {
        return status === "completed" || status === "restarted";
    }

    protected handleActionButtonClick = () => {
        const { status, mapId, activityId, previousHeaderId,
            dispatchOpenActivity, dispatchRestartActivity, showCodeCarryoverModal } = this.props;

        if (status === "locked") return;

        tickEvent("skillmap.activity.open", { path: mapId, activity: activityId, status: status || "" });
        switch (status) {
            case "notstarted":
                if (showCodeCarryoverModal) {
                    dispatchRestartActivity(mapId, activityId, previousHeaderId, !!previousHeaderId);
                } else {
                    dispatchOpenActivity(mapId, activityId);
                }
                break;
            case "completed":
            case "inprogress":
            case "restarted":
            default:
                dispatchOpenActivity(mapId, activityId);
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

    protected handleSaveToProjectsClick = () => {
        const { completedHeaderId, mapId, activityId } = this.props;
        tickEvent("skillmap.export", { path: mapId || "", activity: activityId || "" });
        window.open(`${editorUrl}#skillmapimport:${completedHeaderId}`)
    }

    render() {
        const { status, completedHeaderId, signedIn, dispatchShowLoginModal } = this.props;
        const activityStarted = (status && status !== "notstarted" && status !== "locked");

        if (status === "locked") return <div />
        const showSignIn = pxt.auth.hasIdentity() && !signedIn;

        let numberOfActions = 1;
        if (activityStarted) numberOfActions += 2;
        if (completedHeaderId) numberOfActions += 1;
        if (showSignIn) numberOfActions += 1;

        // Apply "grid" class when there are four actions (for a completed activity)
        return <div className={`actions ${completedHeaderId ? "grid" : ""}`}>
            <Button
                className="tertiary"
                tabIndex={-1}
                ariaPosInSet={1}
                ariaSetSize={numberOfActions}
                title={this.getActivityActionText()}
                label={this.getActivityActionText()}
                onClick={this.handleActionButtonClick}
            />
            {activityStarted && <>
                <Button
                    className="primary inverted"
                    tabIndex={-1}
                    ariaPosInSet={2}
                    ariaSetSize={numberOfActions}
                    title={lf("Restart")}
                    label={lf("Restart")}
                    onClick={this.handleRestartButtonClick}
                />
                <Button
                    className="primary inverted"
                    tabIndex={-1}
                    ariaPosInSet={3}
                    ariaSetSize={numberOfActions}
                    title={lf("Share")}
                    label={lf("Share")}
                    onClick={this.handleShareButtonClick}
                />
            </>}
            {completedHeaderId &&
                <Button
                    tabIndex={-1}
                    ariaPosInSet={activityStarted ? 4 : 2}
                    ariaSetSize={numberOfActions}
                    className="primary inverted"
                    title={lf("Save to My Projects")}
                    label={lf("Save to My Projects")}
                    onClick={this.handleSaveToProjectsClick}
                />
            }
            {showSignIn &&
                <Button
                    tabIndex={-1}
                    ariaPosInSet={numberOfActions}
                    ariaSetSize={numberOfActions}
                    className="primary inverted"
                    onClick={dispatchShowLoginModal}
                    label={lf("Sign in to Save")}
                    title={lf("Sign in to Save")}
                />
            }
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    const props = ownProps as OwnProps;
    const map = state.maps[props.mapId];
    const activity = map.activities[props.activityId] as MapActivity;
    const previousState = lookupPreviousCompletedActivityState(state.user, state.pageSourceUrl, map, props.activityId);

    return {
        previousHeaderId: previousState?.headerId,
        showCodeCarryoverModal: isCodeCarryoverEnabled(state.user, state.pageSourceUrl, map, activity),
        signedIn: state.auth.signedIn
    };
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchShowRestartActivityWarning,
    dispatchShowShareModal,
    dispatchRestartActivity,
    dispatchShowLoginModal
}

export const ActivityActions = connect(mapStateToProps, mapDispatchToProps)(ActivityActionsImpl);
