import * as React from "react";
import { Button } from "react-common/controls/Button";

import { SvgCoord } from '../lib/skillGraphUtils';
import { ActivityStatus } from '../lib/skillMapUtils';

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/graphnode.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

interface GraphNodeProps {
    node: MapNode;
    kind: MapNodeKind;
    width: number;
    position: SvgCoord;
    status: ActivityStatus;
    theme: SkillGraphTheme;
    selected?: boolean;
    onItemSelect?: (id: string, kind: MapNodeKind) => void;
    onItemDoubleClick?: (id: string, kind: MapNodeKind) => void;
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
        if (this.props.onItemSelect) this.props.onItemSelect(this.props.node.activityId, this.props.kind);
    }

    protected handleDoubleClick = () => {
        if (this.props.onItemDoubleClick) this.props.onItemDoubleClick(this.props.node.activityId, this.props.kind);
    }

    protected handleKeyDown = (e: React.KeyboardEvent) => {
        const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
        if (charCode === 13 /* enter */ || charCode === 32 /* space */) {
            e.preventDefault();
            e.stopPropagation();
            if (this.props.onItemSelect) this.props.onItemSelect(this.props.node.activityId, this.props.kind);
        }
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
                return "fas graph-icon"
            default:
                switch (status) {
                    case "locked":
                    case "completed":
                        return "fas graph-icon";
                    default:
                        return "graph-icon-x";
                }
        }
    }

    protected getAccessibilityStatusText() {
        const { status } = this.props;

        switch (status) {
            case "completed":
                return lf("Completed activity.");
            case "inprogress":
                return lf("Activity in progress.");
            case "locked":
                return lf("This activity is locked. Complete the previous activity to unlock it.");
            case "notstarted":
            case "restarted":
                return lf("Unstarted activity.");
        }
    }

    protected getNodeMarker(status: string, width: number, foreground: string, background: string): JSX.Element {
        // Used for positioning the corner circle on completed activities so that it isn't
        // perfectly aligned with the node
        const nudgeUnit = width / 50;
        const starUnit = width / 576;

        switch (status) {
            case "notstarted":
                return <g transform={`translate(${(width / 2) - (12 * nudgeUnit)} ${(-width / 2) - (9 * nudgeUnit)})`}>
                    <title>{lf("Not Started")}</title>
                    <g transform={`scale(${starUnit / 2})`}>
                        {fontAwesomeStar(foreground, background)}
                    </g>
                </g>
            default:
                return <g />
        }
    }

    render() {
        const { hover } = this.state;
        const  { width, position, selected, status, kind, theme, node } = this.props;
        let foreground = hover ? theme.unlockedNodeColor : theme.unlockedNodeForeground;
        let background = hover ? theme.unlockedNodeForeground : theme.unlockedNodeColor;

        if (status === "locked") {
            background = hover ? theme.lockedNodeForeground : theme.lockedNodeColor;
            foreground = hover ? theme.lockedNodeColor : theme.lockedNodeForeground;
        } else if (kind !== "activity") {
            background = hover ? theme.rewardNodeForeground : theme.rewardNodeColor;
            foreground = hover ? theme.rewardNodeColor : theme.rewardNodeForeground;
        } else if (status === "completed") {
            background = hover ? theme.completedNodeForeground : theme.completedNodeColor;
            foreground = hover ? theme.completedNodeColor : theme.completedNodeForeground;
        }

        const selectedUnit = width / 8;
        const yOffset = width / 12.5;

        const descriptionId = "graph-node-" + node.activityId;
        let description: string | undefined;

        switch (node.kind) {
            case "activity":
                description = node.description || node.displayName
                break;
            case "completion":
                description = lf("A reward for completing this skillmap.");
                break;
        }

        return (
            <g ref={this.handleRef}
                className={`graph-activity ${selected ? "selected" : ""} ${hover ? "hover" : ""}`}
                transform={`translate(${position.x} ${position.y})`}
                onKeyDown={this.handleKeyDown}
                onClick={this.handleClick}
                onDoubleClick={this.handleDoubleClick}
                data-activity={node.activityId}>
                    <foreignObject
                        width={width}
                        height={width}
                        x={-width / 2}
                        y={-width / 2}>
                        <Button
                            className="graph-node-button"
                            title={node.displayName}
                            onClick={this.handleClick}
                            onKeydown={this.handleKeyDown}
                            role="menuitem"
                            ariaHasPopup={status !== "locked" ? "true" : "false"}
                            ariaExpanded={selected}
                            ariaControls={selected ? "info-panel-actions" : undefined}
                            ariaDescribedBy={descriptionId}
                        />

                        {/**
                         * Hidden accessibility text; ideally this would be visible in the DOM,
                         * but we only show the description when a node has been clicked; not when it
                         * is focused
                         * */}
                        <div id={descriptionId} style={{ display: "none" }}>
                            <p>
                                {this.getAccessibilityStatusText()}
                            </p>
                            {description &&
                                <p>
                                    {description}
                                </p>
                            }
                        </div>
                    </foreignObject>
                { selected &&
                    (kind !== "activity" ?
                        <circle className="highlight" cx={0} cy={0} r={width / 2 + selectedUnit} stroke={theme.selectedStrokeColor} /> :
                        <rect className="highlight" x={-width / 2 - selectedUnit} y={-width / 2 - selectedUnit} width={width + 2 * selectedUnit} height={width + 2 * selectedUnit} rx={width / 6} stroke={theme.selectedStrokeColor} />)
                }
                { kind !== "activity" ?
                    <circle className="focus-outline" cx={0} cy={0} r={width / 2 + selectedUnit * 2} stroke="none" fill="none" /> :
                    <rect className="focus-outline" x={-width / 2 - selectedUnit * 2} y={-width / 2 - selectedUnit * 2} width={width + 4 * selectedUnit} height={width + 4 * selectedUnit} rx={width / 6} stroke="none" fill="none" />

                }
                { kind !== "activity" ?
                    <circle cx={0} cy={0} r={width / 2} fill={background} stroke={foreground} strokeWidth="2" /> :
                    <rect x={-width / 2} y={-width / 2} width={width} height={width} rx={width / 10} fill={background} stroke={foreground} strokeWidth="2" />
                }
                { kind === "activity" && this.getNodeMarker(status, width, theme.selectedStrokeColor, theme.strokeColor) }
                <text dy={yOffset}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    dominantBaseline="middle"
                    fill={foreground}
                    className={this.getIconClass(status, kind)}>
                        {this.getIcon(status, kind)}
                    </text>
            </g>
        );
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

function fontAwesomeStar(fill: string, stroke: string) {
    // Font Awesome Free 5.15.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
    return <path
            fill={fill}
            stroke={stroke}
            strokeWidth="50"
            d="M259.3 17.8L194 150.2 47.9 171.5c-26.2 3.8-36.7 36.1-17.7 54.6l105.7 103-25 145.5c-4.5 26.3 23.2 46 46.4 33.7L288 439.6l130.7 68.7c23.2 12.2 50.9-7.4 46.4-33.7l-25-145.5 105.7-103c19-18.5 8.5-50.8-17.7-54.6L382 150.2 316.7 17.8c-11.7-23.6-45.6-23.9-57.4 0z" />
}
