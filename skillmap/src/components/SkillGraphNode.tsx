import * as React from "react";

import { GraphCoord } from './SkillGraph';
import { ActivityStatus } from '../lib/skillMapUtils';

/* tslint:disable:no-import-side-effect */
import '../styles/skillnode.css'
/* tslint:enable:no-import-side-effect */

interface SkillGraphNodeProps {
    activityId: string;
    width: number;
    offset: GraphCoord;
    status: ActivityStatus;
    selected?: boolean;
    onItemSelect?: (id: string) => void;
}

export class SkillGraphNode extends React.Component<SkillGraphNodeProps> {
    protected handleClick = () => {
        if (this.props.onItemSelect) this.props.onItemSelect(this.props.activityId);
    }

    protected getIcon(status: ActivityStatus): string {
        switch (status) {
            case "locked":
                return "\uf023";
            default:
                return "\uf11b";
        }
    }

    render() {
        const  { width, offset, selected, status } = this.props;
        return  <g className={`graph-activity ${selected ? "selected" : ""}`} transform={`translate(${offset.x} ${offset.y})`} onClick={this.handleClick}>
            <rect x={-width/2} y={-width/2} width={width} height={width} rx={width/10} fill={`${status === "locked" ? "lightgrey" : "var(--tertiary-color)"}`} stroke="#000" strokeWidth="2" />
            <text textAnchor="middle" alignmentBaseline="middle" className="graph-icon">{this.getIcon(status)}</text>
        </g>
    }
}