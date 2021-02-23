import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchChangeSelectedItem  } from '../actions/dispatch';
import { SkillGraphNode } from './SkillGraphNode';
import { SkillGraphPath } from "./SkillGraphPath";

import { isActivityUnlocked } from '../lib/skillMapUtils';
import { GraphCoord, simpleGraph } from '../lib/skillGraphUtils';

interface GraphItem {
    activity: MapActivity;
    offset: GraphCoord;
}

interface GraphPath {
    start: GraphCoord;
    end: GraphCoord;
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
        const nodes = simpleGraph(root);

        // Convert into renderable items
        const items: GraphItem[] = [];
        const paths: GraphPath[] = [];
        for (let current of nodes) {
            const { layer, counter, width } = current;
                items.push({
                    activity: current,
                    offset: this.getOffset(layer, counter, width)
                });
                if (current.parents && current.parents.length > 0) {
                    for (let p of current.parents) {
                        paths.push({
                            start: this.getOffset(p.layer, p.counter, p.width),
                            end: this.getOffset(layer, counter, width)
                        })
                    }
                }

                this.size.height = Math.max(this.size.height, current.counter);
                this.size.width = Math.max(this.size.width, current.layer);
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
    protected getOffset(depth: number, counter: number, width?: number): { x: number, y: number } {
        return { x: (depth + 1) * 12 * UNIT, y: (counter * 8 + 1) * UNIT}
    }

    render() {
        const { map, user, selectedItem, pageSourceUrl } = this.props;
        return <div className="skill-graph">
            {map.displayName && <div className="graph-title">
                <span>{map.displayName}</span>
            </div>}
            <div className="graph">
                <svg xmlns="http://www.w3.org/2000/svg" width={this.size.width * 20 * UNIT} height={this.size.height * 10 * UNIT}>
                    {this.paths.map((el, i) => {
                        return <SkillGraphPath key={`graph-activity-${i}`} strokeWidth={3 * UNIT} color="#000" start={el.start} end={el.end} />
                    })}
                    {this.paths.map((el, i) => {
                         return <SkillGraphPath key={`graph-activity-${i}`} strokeWidth={3 * UNIT - 4} color="#BFBFBF" start={el.start}  end={el.end} />
                    })}
                    {this.items.map((el, i) => {
                        return <SkillGraphNode key={`graph-activity-${i}`}
                            activityId={el.activity.activityId}
                            offset={el.offset}
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