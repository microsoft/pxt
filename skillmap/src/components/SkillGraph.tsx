import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchChangeSelectedItem  } from '../actions/dispatch';
import { GraphNode } from './GraphNode';
import { GraphPath } from "./GraphPath";

import { isActivityUnlocked } from '../lib/skillMapUtils';
import { SvgCoord, orthogonalGraph } from '../lib/skillGraphUtils';

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
    dispatchChangeSelectedItem: (mapId?: string, activityId?: string) => void;
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

    protected getItems(root: MapActivity): { items: SvgGraphItem[], paths: SvgGraphPath[] } {
        const nodes = orthogonalGraph(root);

        // Convert into renderable items
        const items: SvgGraphItem[] = [];
        const paths: SvgGraphPath[] = [];
        for (let current of nodes) {
            const { depth, offset } = current;
            items.push({
                activity: current,
                position: this.getPosition(depth, offset)
            });

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

    protected onItemSelect = (activityId: string) => {
        const { dispatchChangeSelectedItem, map } = this.props;
        if (activityId !== this.props.selectedActivityId) {
            dispatchChangeSelectedItem(map.mapId, activityId);
        } else {
            dispatchChangeSelectedItem(undefined);
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
        return ((position * 8) + PADDING) * UNIT;
    }

    render() {
        const { map, user, selectedActivityId, pageSourceUrl } = this.props;
        const width = this.getX(this.size.width) + UNIT * PADDING;
        const height = this.getY(this.size.height) + UNIT * PADDING;
        return <svg className="skill-graph" xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {this.paths.map((el, i) => {
                return <GraphPath key={`graph-activity-${i}`} strokeWidth={3 * UNIT} color="#000" points={el.points} />
            })}
            {this.paths.map((el, i) => {
                return <GraphPath key={`graph-activity-${i}`} strokeWidth={3 * UNIT - 4} color="#BFBFBF" points={el.points} />
            })}
            {this.items.map((el, i) => {
                return <GraphNode key={`graph-activity-${i}`}
                    activityId={el.activity.activityId}
                    position={el.position}
                    width={5 * UNIT}
                    selected={el.activity.activityId === selectedActivityId}
                    onItemSelect={this.onItemSelect}
                    status={isActivityUnlocked(user, pageSourceUrl, map, el.activity.activityId) ? "notstarted" : "locked"} /> // TODO shakao needs "completed/inprogress"
            })}
        </svg>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    return {
        user: state.user,
        pageSourceUrl: state.pageSourceUrl,
        selectedActivityId: state.selectedItem && ownProps.map?.mapId == state.selectedItem.mapId ? state.selectedItem.activityId : undefined
    }
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem
};

export const SkillGraph = connect(mapStateToProps, mapDispatchToProps)(SkillGraphImpl);
