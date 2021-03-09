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
    onItemSelect?: (id: string, kind: MapNodeKind) => void;
}

export class GraphNode extends React.Component<GraphNodeProps> {
    protected handleClick = () => {
        if (this.props.onItemSelect) this.props.onItemSelect(this.props.activityId, this.props.kind);
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
                        return "\uf101";
                }
        }
    }

    protected getIconClass(status: ActivityStatus, kind: MapNodeKind): string {
        switch (kind) {
            case "reward":
            case "completion":
                return "graph-icon"
            default:
                switch (status) {
                    case "locked":
                        return "graph-icon";
                    default:
                        return "graph-icon-x";
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

        // Used for positioning the corner circle on completed activities so that it isn't
        // perfectly aligned with the node
        const nudgeUnit = width / 50;

        return  <g className={`graph-activity ${selected ? "selected" : ""}`} transform={`translate(${position.x} ${position.y})`} onClick={this.handleClick}>
            { kind !== "activity" ?
                <circle cx={0} cy={0} r={width / 2} fill={fill} stroke={theme.strokeColor} strokeWidth="2" /> :
                <rect x={-width / 2} y={-width / 2} width={width} height={width} rx={width / 10} fill={fill} stroke="#000" strokeWidth="2" />
            }
            { status === "completed" && kind === "activity" &&
                <g transform={`translate(${(width / 2) - (3 * nudgeUnit)} ${(-width / 2) + (3 * nudgeUnit)})`}>
                    <circle cx={0} cy={0} r={(width / 4) - nudgeUnit} stroke={theme.strokeColor} strokeWidth="2" fill={fill}/>
                    <text dy="2"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        fill={foreground}
                        className="graph-status-icon">
                            {"\uf00c"}
                        </text>
                </g>
            }
            <text dy="2"
                textAnchor="middle"
                alignmentBaseline="middle"
                fill={foreground}
                className={this.getIconClass(status, kind)}>
                    {this.getIcon(status, kind)}
                </text>
        </g>
    }
}