import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { Item } from './CarouselItem';

import { dispatchOpenActivity, dispatchShowRestartActivityWarning } from '../actions/dispatch';

import { isActivityUnlocked, isMapUnlocked, lookupActivityProgress, } from '../lib/skillMapUtils';
import { tickEvent } from '../lib/browserUtils';

/* tslint:disable:no-import-side-effect */
import '../styles/skillcard.css'
/* tslint:enable:no-import-side-effect */

type SkillCardStatus = "locked" | "notstarted" | "inprogress" | "completed" | "restarted";

interface SkillCardActionButtonProps {
    mapId: string;
    id: string;
    status?: SkillCardStatus;
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchShowRestartActivityWarning: (mapId: string, activityId: string) => void;
}

export class SkillCardActionButtonImpl extends React.Component<SkillCardActionButtonProps> {
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

    protected isCompleted(status: SkillCardStatus): boolean {
        return status === "completed" || status === "restarted";
    }

    protected handleActionButtonClick = () => {
        const { status, mapId, id, dispatchOpenActivity } = this.props;

        switch (status) {
            case "locked":
                break;
            case "completed":
            case "inprogress":
            case "notstarted":
            case "restarted":
            default:
                tickEvent("skillmap.activity.open", { path: mapId, activity: id, status: status || "" });
                return dispatchOpenActivity(mapId, id);
        }
    }

    protected handleRestartButtonClick = () => {
        const { mapId, id, dispatchShowRestartActivityWarning } = this.props;
        dispatchShowRestartActivityWarning(mapId, id);
    }

    render() {
        return <div className="skill-card-button" role="button" onClick={this.handleActionButtonClick}>
            {this.getSkillCardActionText()}
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const map = state.maps?.[ownProps.mapId];
    const isUnlocked = state.user && map && isActivityUnlocked(state.user, state.pageSourceUrl, map, ownProps.id);

    let status: SkillCardStatus = isUnlocked ? "notstarted" : "locked";

    // TODO move status calc into utils
    if (state.user) {
        if (map && state.pageSourceUrl && !isMapUnlocked(state.user, map, state.pageSourceUrl)) {
            status = "locked";
        }
        else {
            const progress = lookupActivityProgress(state.user, state.pageSourceUrl, ownProps.mapId, ownProps.id);

            if (progress) {
                if (progress.isCompleted) {
                    status = (progress.currentStep && progress.maxSteps && progress.currentStep < progress.maxSteps) ?
                        "restarted" : "completed";
                }
                else if (progress.headerId) {
                    status = "inprogress";
                }
            }
        }
    }

    return {
        status
    };
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchShowRestartActivityWarning
}

export const SkillCardActionButton = connect(mapStateToProps, mapDispatchToProps)(SkillCardActionButtonImpl);