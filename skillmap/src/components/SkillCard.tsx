import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { Item } from './CarouselItem';

import { dispatchOpenActivity, dispatchShowRestartActivityWarning } from '../actions/dispatch';

import { ActivityStatus, isActivityUnlocked, isMapUnlocked, lookupActivityProgress, } from '../lib/skillMapUtils';
import { tickEvent } from '../lib/browserUtils';

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/skillcard.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

interface SkillCardProps extends Item {
    mapId: string;
    description?: string;
    imageUrl?: string;
    tags?: string[];
    status?: ActivityStatus;
    currentStep?: number;
    maxSteps?: number
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchShowRestartActivityWarning: (mapId: string, activityId: string) => void;
}

export class SkillCardImpl extends React.Component<SkillCardProps> {
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
        const { label, description, imageUrl, tags, status, currentStep, maxSteps} = this.props;
        const completed = this.isCompleted(status || "notstarted");
        const showRestart = status !== "locked" && status !== "notstarted";

        return <div className="skill-card-container">
            <div className={`skill-card ${status || ''}`}>
                <div className="skill-card-display">
                    <div className="skill-card-image">
                        {imageUrl ? <img src={imageUrl} alt={lf("Preview of activity content")} /> : <i className={status !== "locked" ? "fas fa-gamepad" : ""} />}
                    </div>
                    <div className="skill-card-label">
                        <div className="skill-card-title">
                            {completed && <i className="fas fa-check-circle" />}
                            {status === "inprogress" && maxSteps &&
                                <span className="circular-label">{`${currentStep}/${maxSteps}`}</span>
                            }
                            <span>{label}</span>
                        </div>
                        <div className="skill-card-tags">
                            {tags?.map((t, i) => {
                                return <div key={i}>{t}</div>
                            })}
                        </div>
                    </div>
                    {status === "locked" && <div className="skill-card-overlay"><i className="fas fa-lock" /></div>}
                </div>
                <div className="skill-card-info">
                    <div className="skill-card-title">{label}</div>
                    <div className="skill-card-description">{description}</div>
                    <div className="spacer"></div>
                    <div className="skill-card-action">
                        {showRestart &&
                            <div className="skill-card-button-icon" role="button" onClick={this.handleRestartButtonClick}>
                                <i className="xicon redo"></i>
                            </div>
                        }
                        <div className="skill-card-button" role="button" onClick={this.handleActionButtonClick}>
                            {this.getSkillCardActionText()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const map = state.maps?.[ownProps.mapId];
    const isUnlocked = state.user && map && isActivityUnlocked(state.user, state.pageSourceUrl, map, ownProps.id);

    let status: ActivityStatus = isUnlocked ? "notstarted" : "locked";
    let currentStep: number | undefined;
    let maxSteps: number | undefined;

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
                    currentStep = progress?.currentStep;
                    maxSteps = progress?.maxSteps;
                }
            }
        }
    }

    return {
        status,
        currentStep,
        maxSteps,
    };
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchShowRestartActivityWarning
}

export const SkillCard = connect(mapStateToProps, mapDispatchToProps)(SkillCardImpl);