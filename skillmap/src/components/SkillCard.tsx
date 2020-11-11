import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { Item } from './CarouselItem';

import { dispatchOpenActivity, dispatchShowRestartActivityWarning } from '../actions/dispatch';

import { isActivityUnlocked, lookupActivityProgress, } from '../lib/skillMapUtils';

import '../styles/skillcard.css'

type SkillCardStatus = "locked" | "notstarted" | "inprogress" | "completed" ;

interface SkillCardProps extends Item {
    mapId: string;
    description?: string;
    imageUrl?: string;
    tags?: string[];
    status?: SkillCardStatus;
    currentStep?: number;
    maxSteps?: number
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchShowRestartActivityWarning: (mapId: string, activityId: string) => void;
}

export class SkillCardImpl extends React.Component<SkillCardProps> {
    protected getSkillCardActionText(): string {
        switch (this.props.status) {
            case "locked":
                return "LOCKED"
            case "completed":
                return "VIEW CODE"
            case "inprogress":
                return "CONTINUE"
            case "notstarted":
            default:
                return "START"
        }
    }

    protected handleActionButtonClick = () => {
        const { status, mapId, id, dispatchOpenActivity } = this.props;

        switch (status) {
            case "locked":
                break;
            case "completed":
            case "inprogress":
            case "notstarted":
            default:
                return dispatchOpenActivity(mapId, id);
        }
    }

    protected handleRestartButtonClick = () => {
        const { mapId, id, dispatchShowRestartActivityWarning } = this.props;
        dispatchShowRestartActivityWarning(mapId, id);
    }

    render() {
        const { label, description, imageUrl, tags, status, currentStep, maxSteps} = this.props;

        return <div className={`skill-card ${status || ''}`}>
            <div className="skill-card-display">
                <div className="skill-card-image">
                    {imageUrl ? <img src={imageUrl} alt={`Preview of activity content`} /> : <i className={`icon ${status !== "locked" ? "game" : ""}`} />}
                </div>
                <div className="skill-card-label">
                    <div className="skill-card-title">
                        {status === "completed" && <i className={`icon check circle`} />}
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
                {status === "locked" && <div className="skill-card-overlay"><i className="icon lock" /></div>}
            </div>
            <div className="skill-card-info">
                <div className="skill-card-title">{label}</div>
                <div className="skill-card-description">{description}</div>
                <div className="spacer"></div>
                <div className="skill-card-action">
                    {status === "completed" &&
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
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const isUnlocked = state.user && state.maps?.[ownProps.mapId] && isActivityUnlocked(state.user, state.maps[ownProps.mapId], ownProps.id);

    let status: SkillCardStatus = isUnlocked ? "notstarted" : "locked";
    let currentStep: number | undefined;
    let maxSteps: number | undefined;

    if (state.user) {
        const progress = lookupActivityProgress(state.user, ownProps.mapId, ownProps.id);

        if (progress) {
            if (progress.isCompleted) {
                status = "completed";
            }
            else if (progress.headerId) {
                status = "inprogress";
                currentStep = progress?.currentStep;
                maxSteps = progress?.maxSteps;
            }
        }
    }

    return {
        status,
        currentStep,
        maxSteps
    };
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchShowRestartActivityWarning
}

export const SkillCard = connect(mapStateToProps, mapDispatchToProps)(SkillCardImpl);