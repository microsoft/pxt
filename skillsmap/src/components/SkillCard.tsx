import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { Item } from './CarouselItem';

import { isActivityUnlocked } from '../lib/skillMapUtils';

import '../styles/skillcard.css'

interface SkillCardProps extends Item {
    mapId: string;
    tags?: string[];
    locked?: boolean;
}

export class SkillCardImpl extends React.Component<SkillCardProps> {
    render() {
        const { label, locked } = this.props;

        return <div className={`skill-card ${locked ? 'locked' : ''}`}>
            {locked && <div className="skill-card-overlay"><i className="icon lock" /></div>}
            <span>{label}</span>
        </div>
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    return {
        locked: state.user && state.maps?.[ownProps.mapId] && !isActivityUnlocked(state.user, state.maps[ownProps.mapId], ownProps.id)
    };
}

export const SkillCard = connect(mapStateToProps)(SkillCardImpl);