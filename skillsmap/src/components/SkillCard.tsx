import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { Item } from './CarouselItem';

import { isActivityCompleted, isActivityUnlocked } from '../lib/skillMapUtils';

import '../styles/skillcard.css'

type SkillCardStatus = "locked" | "notstarted" | "inprogress" | "completed" ;

interface SkillCardProps extends Item {
    mapId: string;
    description?: string;
    tags?: string[];
    status?: SkillCardStatus;
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

    render() {
        const { label, description, status } = this.props;

        return <div className={`skill-card ${status || ''}`}>
            <div className="skill-card-display">
                {status === "locked" && <div className="skill-card-overlay"><i className="icon lock" /></div>}
                <div className="skill-card-title">{label}</div>
            </div>
            <div className="skill-card-info">
                <div className="skill-card-title">{label}</div>
                <div className="skill-card-description">{description}</div>
                <div className="spacer"></div>
                <div className="skill-card-action">{this.getSkillCardActionText()}</div>
            </div>
        </div>
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    let status: SkillCardStatus = "locked";
    if (state.user && state.maps?.[ownProps.mapId] && isActivityUnlocked(state.user, state.maps[ownProps.mapId], ownProps.id)) {
        if (isActivityCompleted(state.user, ownProps.mapId, ownProps.id)) {
            status = "completed";
        } else {
            status = "notstarted";
        }
    }

    return {
        status
    };
}

export const SkillCard = connect(mapStateToProps)(SkillCardImpl);