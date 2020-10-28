import * as React from "react";
import { Item } from './CarouselItem';

import '../styles/skillcard.css'

interface SkillCardProps extends Item {
    tags?: string[];
    locked?: boolean;
}

export class SkillCard extends React.Component<SkillCardProps> {
    render() {
        const { label, locked } = this.props;

        return <div className={`skill-card ${locked ? 'locked' : ''}`}>
            {locked && <div className="skill-card-overlay"><i className="icon lock" /></div>}
            <span>{`CARD ${label}`}</span>
        </div>
    }
}