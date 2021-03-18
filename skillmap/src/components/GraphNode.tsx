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

interface GraphNodeState {
    hover: boolean;
}

export class GraphNode extends React.Component<GraphNodeProps, GraphNodeState> {
    constructor(props: GraphNodeProps) {
        super(props);
        this.state = { hover: false }
    }
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
                    case "completed":
                        return "\uf058";
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
                    case "completed":
                        return "graph-icon";
                    default:
                        return "graph-icon-x";
                }
        }
    }

    protected getNodeMarker(status: string, width: number, theme: SkillGraphTheme): JSX.Element {
        // Used for positioning the corner circle on completed activities so that it isn't
        // perfectly aligned with the node
        const nudgeUnit = width / 50;

        switch (status) {
            // case "completed":
            //     return <g transform={`translate(${(width / 2) - (3 * nudgeUnit)} ${(-width / 2) + (3 * nudgeUnit)})`}>
            //         <circle cx={0} cy={0} r={(width / 4) - nudgeUnit} stroke={theme.strokeColor} strokeWidth="2" fill={theme.lockedNodeColor}/>
            //         <text dy="2"
            //             textAnchor="middle"
            //             alignmentBaseline="middle"
            //             fill={theme.lockedNodeForeground}
            //             className="graph-status-icon">
            //                 {"\uf00c"}
            //             </text>
            //     </g>
            case "notstarted":
                return <g transform={`translate(${(width / 2) - (3 * nudgeUnit)} ${(-width / 2) + (3 * nudgeUnit)})`}>
                    <circle cx={0} cy={0} r={(width / 4) - nudgeUnit} stroke={theme.strokeColor} strokeWidth="2" fill={theme.selectedStrokeColor}/>
                    <text dy="2"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        fill={theme.strokeColor}
                        className="graph-status-icon">
                            {"\uf12a"}
                        </text>
                </g>
            default:
                return <g />
        }
    }

    render() {
        const { hover } = this.state;
        const  { width, position, selected, status, kind, theme } = this.props;
        let foreground = hover ? theme.unlockedNodeColor : theme.unlockedNodeForeground;
        let background = hover ? theme.unlockedNodeForeground : theme.unlockedNodeColor;

        if (status === "locked") {
            background = hover ? theme.lockedNodeForeground : theme.lockedNodeColor;
            foreground = hover ? theme.lockedNodeColor : theme.lockedNodeForeground;
        }
        else if (kind !== "activity") {
            background = hover ? theme.rewardNodeForeground : theme.rewardNodeColor;
            foreground = hover ? theme.rewardNodeColor : theme.rewardNodeForeground;
        }

        const selectedUnit = width / 8;

        return  <g className={`graph-activity ${selected ? "selected" : ""} ${hover ? "hover" : ""}`} transform={`translate(${position.x} ${position.y})`} onClick={this.handleClick} ref={this.handleRef}>
            { selected &&
                (kind !== "activity" ?
                    <circle className="highlight" cx={0} cy={0} r={width / 2 + selectedUnit} stroke={theme.selectedStrokeColor} /> :
                    <rect className="highlight" x={-width / 2 - selectedUnit} y={-width / 2 - selectedUnit} width={width + 2 * selectedUnit} height={width + 2 * selectedUnit} rx={width / 6} stroke={theme.selectedStrokeColor} />)
            }
            { kind !== "activity" ?
                <circle cx={0} cy={0} r={width / 2} fill={background} stroke={foreground} strokeWidth="2" /> :
                <rect x={-width / 2} y={-width / 2} width={width} height={width} rx={width / 10} fill={background} stroke={foreground} strokeWidth="2" />
            }
            { kind === "activity" && this.getNodeMarker(status, width, theme) }
            <text dy="4"
                textAnchor="middle"
                alignmentBaseline="middle"
                fill={foreground}
                className={this.getIconClass(status, kind)}>
                    {this.getIcon(status, kind)}
                </text>
        </g>
    }

    protected handleRef = (g: SVGGElement) => {
        if (g) {
            g.addEventListener("mouseenter", () => {
                this.setState({ hover: true });
            });
            g.addEventListener("mouseleave", () => {
                this.setState({ hover: false });
            });
        }
    }
}