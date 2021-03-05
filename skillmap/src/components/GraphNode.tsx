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
    theme: SkillGraphTheme;
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
        const  { width, position, selected, status, kind, theme } = this.props;
        let fill = theme.unlockedNodeColor;
        let foreground = theme.unlockedNodeForeground;

        if (kind !== "activity") {
            fill = theme.rewardNodeColor;
            foreground = theme.rewardNodeForeground;
        }
        else if (status === "locked") {
            fill = theme.lockedNodeColor;
            foreground = theme.lockedNodeForeground;
        }

        return  <g className={`graph-activity ${selected ? "selected" : ""}`} transform={`translate(${position.x} ${position.y})`} onClick={this.handleClick}>
            { kind !== "activity" ?
                <circle cx={0} cy={0} r={width / 2} fill={fill} stroke={theme.strokeColor} strokeWidth="2" /> :
                <rect x={-width / 2} y={-width / 2} width={width} height={width} rx={width / 10} fill={fill} stroke="#000" strokeWidth="2" />
            }
            <text textAnchor="middle" alignmentBaseline="middle" className="graph-icon" dy="2" fill={foreground}>{this.getIcon(status, kind)}</text>
        </g>
    }
}