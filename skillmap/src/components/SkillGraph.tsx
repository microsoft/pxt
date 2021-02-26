import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchChangeSelectedItem  } from '../actions/dispatch';
import { SkillGraphNode } from './SkillGraphNode';
import { SkillGraphPath } from "./SkillGraphPath";

import { isActivityUnlocked } from '../lib/skillMapUtils';
import { SvgCoord, orthogonalGraph } from '../lib/skillGraphUtils';

interface GraphItem {
    activity: MapActivity;
    position: SvgCoord;
}

interface GraphPath {
    points: SvgCoord[];
}

interface SkillGraphProps {
    map: SkillMap;
    user: UserState;
    selectedItem?: string;
    pageSourceUrl: string;
    dispatchChangeSelectedItem: (id?: string) => void;
}

const UNIT = 10;

class SkillGraphImpl extends React.Component<SkillGraphProps> {
    protected items: GraphItem[];
    protected paths: GraphPath[];
    protected size: { width: number, height: number };

    constructor(props: SkillGraphProps) {
        super(props);
        this.size = { width: 0, height: 0 };

        const { items, paths } = this.getItems(props.map.root);
        this.items = items;
        this.paths = paths;
    }

    protected getItems(root: MapActivity): { items: GraphItem[], paths: GraphPath[] } {
        const nodes = orthogonalGraph(root);

        // Convert into renderable items
        const items: GraphItem[] = [];
        const paths: GraphPath[] = [];
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

    protected onItemSelect = (id: string) => {
        const { dispatchChangeSelectedItem } = this.props;
        if (id !== this.props.selectedItem) {
            dispatchChangeSelectedItem(id);
        } else {
            dispatchChangeSelectedItem(undefined);
        }
    }

    // This function converts graph position (no units) to x/y (SVG units)
    protected getPosition(depth: number, offset: number): SvgCoord {
        return { x: (depth + 1) * 12 * UNIT, y: (offset * 8 + 6) * UNIT}
    }

    render() {
        const { map, user, selectedItem, pageSourceUrl } = this.props;
        return <div className="skill-graph">
            {map.displayName && <div className="graph-title">
                <span>{map.displayName}</span>
            </div>}
            <div className="graph">
                <svg xmlns="http://www.w3.org/2000/svg" width={(this.size.width + 2) * 12 * UNIT} height={(this.size.height + 2) * 8 * UNIT}>
                    {this.paths.map((el, i) => {
                        return <SkillGraphPath key={`graph-activity-${i}`} strokeWidth={3 * UNIT} color="#000" points={el.points} />
                    })}
                    {this.paths.map((el, i) => {
                         return <SkillGraphPath key={`graph-activity-${i}`} strokeWidth={3 * UNIT - 4} color="#BFBFBF" points={el.points} />
                    })}
                    {this.items.map((el, i) => {
                        return <SkillGraphNode key={`graph-activity-${i}`}
                            activityId={el.activity.activityId}
                            position={el.position}
                            width={5 * UNIT}
                            selected={el.activity.activityId === selectedItem}
                            onItemSelect={this.onItemSelect}
                            status={isActivityUnlocked(user, pageSourceUrl, map, el.activity.activityId) ? "notstarted" : "locked"} /> // TODO shakao needs "completed/inprogress"
                    })}
                </svg>
            </div>
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    return {
        user: state.user,
        pageSourceUrl: state.pageSourceUrl,
        selectedItem: state.selectedItem && ownProps.map?.activities?.[state.selectedItem] ? state.selectedItem : undefined
    }
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem
};

export const SkillGraph = connect(mapStateToProps, mapDispatchToProps)(SkillGraphImpl);