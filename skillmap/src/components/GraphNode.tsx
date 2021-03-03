import * as React from "react";

import { SvgCoord } from '../lib/skillGraphUtils';
import { ActivityStatus } from '../lib/skillMapUtils';

/* tslint:disable:no-import-side-effect */
import '../styles/graphnode.css'
/* tslint:enable:no-import-side-effect */

interface GraphNodeProps {
    activityId: string;
    kind: MapNodeKind;
    width: number;
    position: SvgCoord;
    status: ActivityStatus;
    selected?: boolean;
    onItemSelect?: (id: string) => void;
}

export class GraphNode extends React.Component<GraphNodeProps> {
    protected handleClick = () => {
        if (this.props.onItemSelect) this.props.onItemSelect(this.props.activityId);
    }

    protected getIcon(status: ActivityStatus, kind: MapNodeKind): string {
        switch (kind) {
            case "reward":
                return "\uf059"
            case "completion":
                return "\uf091";
            default:
                switch (status) {
                    case "locked":
                        return "\uf023";
                    default:
                        return "\uf11b";
                }
        }
    }

    render() {
        const  { width, position, selected, status, kind} = this.props;
        return  <g className={`graph-activity ${selected ? "selected" : ""}`} transform={`translate(${position.x} ${position.y})`} onClick={this.handleClick}>
            { kind !== "activity" ?
                <circle cx={0} cy={0} r={width / 2} fill={`${status === "locked" ? "lightgrey" : "var(--tertiary-color)"}`} stroke="#000" strokeWidth="2" /> :
                <rect x={-width / 2} y={-width / 2} width={width} height={width} rx={width / 10} fill={`${status === "locked" ? "lightgrey" : "var(--tertiary-color)"}`} stroke="#000" strokeWidth="2" />
            }
            <text textAnchor="middle" alignmentBaseline="middle" className="graph-icon" dy="2">{this.getIcon(status, kind)}</text>
        </g>
    }
}