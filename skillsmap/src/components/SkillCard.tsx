import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { Item } from './CarouselItem';

import { dispatchOpenActivity } from '../actions/dispatch';

import { isActivityCompleted, isActivityUnlocked, lookupActivityProgress, } from '../lib/skillMapUtils';

import '../styles/skillcard.css'

type SkillCardStatus = "locked" | "notstarted" | "inprogress" | "completed" ;

interface SkillCardProps extends Item {
    mapId: string;
    description?: string;
    tags?: string[];
    status?: SkillCardStatus;
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
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
            case "completed":
                break;
            case "inprogress":
            case "notstarted":
            default:
                return dispatchOpenActivity(mapId, id);
        }
    }

    render() {
        const { label, description, status } = this.props;

        return <div className={`skill-card ${status || ''}`}>
            <div className="skill-card-display">
                {(status === "locked" || status === "completed") && <div className="skill-card-overlay">
                    <i className={`icon ${status === "locked" ? "lock" : "check circle"}`} />
                </div>}
                <div className="skill-card-title">{label}</div>
            </div>
            <div className="skill-card-info">
                <div className="skill-card-title">{label}</div>
                <div className="skill-card-description">{description}</div>
                <div className="spacer"></div>
                <div className="skill-card-action">
                    {status === "completed" && <div className="skill-card-button-icon"><i className="xicon redo"></i></div>}
                    <div className="skill-card-button" role="button" onClick={this.handleActionButtonClick}>{this.getSkillCardActionText()}</div>
                </div>
            </div>
        </div>
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    let status: SkillCardStatus = "locked";
    if (state.user && state.maps?.[ownProps.mapId] && isActivityUnlocked(state.user, state.maps[ownProps.mapId], ownProps.id)) {
        if (isActivityCompleted(state.user, ownProps.mapId, ownProps.id)) {
            status = "completed";
        } else if (lookupActivityProgress(state.user, ownProps.mapId, ownProps.id)?.headerId) {
            status = "inprogress";
        } else {
            status = "notstarted";
        }
    }

    return {
        status
    };
}

const mapDispatchToProps = {
    dispatchOpenActivity
}

export const SkillCard = connect(mapStateToProps, mapDispatchToProps)(SkillCardImpl);