import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchChangeSelectedItem, dispatchShowCompletionModal, dispatchSetSkillMapCompleted } from '../actions/dispatch';
import { GraphNode } from './GraphNode';
import { GraphPath } from "./GraphPath";

import { getActivityStatus, isActivityUnlocked } from '../lib/skillMapUtils';
import { SvgCoord, orthogonalGraph } from '../lib/skillGraphUtils';
import { tickEvent } from "../lib/browserUtils";

interface SvgGraphItem {
    activity: MapActivity;
    position: SvgCoord;
}

interface SvgGraphPath {
    points: SvgCoord[];
}

interface SkillGraphProps {
    map: SkillMap;
    user: UserState;
    selectedActivityId?: string;
    pageSourceUrl: string;
    theme: SkillGraphTheme;
    completionState: "incomplete" | "transitioning" | "completed";
    dispatchChangeSelectedItem: (mapId?: string, activityId?: string) => void;
    dispatchShowCompletionModal: (mapId: string, activityId?: string) => void;
    dispatchSetSkillMapCompleted: (mapId: string) => void;
}

const UNIT = 10;
const PADDING = 4;

class SkillGraphImpl extends React.Component<SkillGraphProps> {
    protected items: SvgGraphItem[];
    protected paths: SvgGraphPath[];
    protected size: { width: number, height: number };

    constructor(props: SkillGraphProps) {
        super(props);
        this.size = { width: 0, height: 0 };

        const { items, paths } = this.getItems(props.map.root);
        this.items = items;
        this.paths = paths;
    }

    protected getItems(root: MapNode): { items: SvgGraphItem[], paths: SvgGraphPath[] } {
        const nodes = orthogonalGraph(root);

        // Convert into renderable items
        const items: SvgGraphItem[] = [];
        const paths: SvgGraphPath[] = [];
        for (let current of nodes) {
            const { depth, offset } = current;
            items.push({
                activity: current,
                position: this.getPosition(depth, offset)
            } as any);

            if (current.edges) {
                current.edges.forEach(edge => {
                    const points: SvgCoord[] = [];
                    edge.forEach(n => points.push(this.getPosition(n.depth, n.offset)));
                    paths.push({ points });
                });
            }

            this.size.height = Math.max(this.size.height, current.offset);
            this.size.width = Math.max(this.size.width, current.depth);
        }

        return { items, paths };
    }

    protected onItemSelect = (activityId: string, kind: MapNodeKind) => {
        const { user, pageSourceUrl, map, completionState, selectedActivityId,
            dispatchChangeSelectedItem, dispatchShowCompletionModal } = this.props;

        const { status } = getActivityStatus(user, pageSourceUrl, map, activityId);
        if (kind === "completion" && status === "completed") {
            tickEvent("skillmap.graph.reward.select", { path: map.mapId, activity: activityId})
            dispatchChangeSelectedItem(map.mapId, activityId);
            dispatchShowCompletionModal(map.mapId, activityId)
        } else {
            if (activityId !== selectedActivityId) {
                tickEvent("skillmap.graph.item.select", { path: map.mapId, activity: activityId })
                dispatchChangeSelectedItem(map.mapId, activityId);
            } else {
                tickEvent("skillmap.graph.item.deselect", { path: map.mapId, activity: activityId })
                dispatchChangeSelectedItem(undefined);
            }
        }
    }

    // This function converts graph position (no units) to x/y (SVG units)
    protected getPosition(depth: number, offset: number): SvgCoord {
        return { x: this.getX(depth), y: this.getY(offset) }
    }

    protected getX(position: number) {
        return ((position * 12) + PADDING) * UNIT;
    }

    protected getY(position: number) {
        return ((position * 9) + PADDING) * UNIT;
    }

    componentDidUpdate(props: SkillGraphProps) {
        if (props.completionState === "transitioning") {
            setTimeout(() => {
                tickEvent("skillmap.graph.reward.auto", { path: props.map.mapId, activity: props.selectedActivityId || "" })
                props.dispatchSetSkillMapCompleted(props.map.mapId)
                props.dispatchShowCompletionModal(props.map.mapId, props.selectedActivityId)
            }, 400);
        }
    }

    render() {
        const { map, user, selectedActivityId, pageSourceUrl, theme } = this.props;
        const width = this.getX(this.size.width) + UNIT * PADDING;
        const height = this.getY(this.size.height) + UNIT * PADDING;
        return <svg className="skill-graph" xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <g opacity={theme.pathOpacity}>
                {this.paths.map((el, i) => {
                    return <GraphPath key={`graph-activity-${i}`} strokeWidth={3 * UNIT} color={theme.strokeColor} points={el.points} />
                })}
                {this.paths.map((el, i) => {
                    return <GraphPath key={`graph-activity-${i}`} strokeWidth={3 * UNIT - 4} color={theme.pathColor}  points={el.points} />
                })}
            </g>
            {this.items.map((el, i) => {
                return <GraphNode key={`graph-activity-${i}`}
                    theme={theme}
                    kind={el.activity.kind}
                    activityId={el.activity.activityId}
                    position={el.position}
                    width={5 * UNIT}
                    selected={el.activity.activityId === selectedActivityId}
                    onItemSelect={this.onItemSelect}
                    status={getActivityStatus(user, pageSourceUrl, map, el.activity.activityId).status} />
            })}
        </svg>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    const mapProgress = state.user?.mapProgress?.[state.pageSourceUrl];
    return {
        user: state.user,
        pageSourceUrl: state.pageSourceUrl,
        theme: state.theme,
        selectedActivityId: state.selectedItem && ownProps.map?.mapId == state.selectedItem.mapId ? state.selectedItem.activityId : undefined,
        completionState: mapProgress?.[ownProps.map.mapId]?.completionState
    }
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem,
    dispatchShowCompletionModal,
    dispatchSetSkillMapCompleted
};

export const SkillGraph = connect(mapStateToProps, mapDispatchToProps)(SkillGraphImpl);
