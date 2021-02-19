import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchChangeSelectedItem, dispatchShowCompletionModal, dispatchSetSkillMapCompleted } from '../actions/dispatch';
import { SkillGraphNode, SkillGraphItem } from './SkillGraphNode';
import { SkillCardActionButton } from "./SkillCardActionButton";

interface SkillGraphProps {
    map: SkillMap;
    requiredMaps: SkillMap[];
    user: UserState;
    selectedItem?: string;
    pageSourceUrl: string;
    completionState: "incomplete" | "transitioning" | "completed";
    dispatchChangeSelectedItem: (id?: string) => void;
    dispatchShowCompletionModal: (mapId: string, activityId?: string) => void;
    dispatchSetSkillMapCompleted: (mapId: string) => void;
}

class SkillGraphImpl extends React.Component<SkillGraphProps> {
    protected items: SkillGraphItem[];
    // need a list of roots

    constructor(props: SkillGraphProps) {
        super(props);

        this.items = this.getItems(props.map.mapId, props.map.root);
    }

    protected getItems(mapId: string, root: MapActivity): SkillGraphItem[] {
        const items: SkillGraphItem[] = [];
        const base = root as any;
        base.depth = 0;
        let activities: any[] = [base]; // TODO don't use any
        // topological sort before generating items?
        while (activities.length > 0) {
            let current = activities.shift();
            if (current) {
                const item = {
                    id: current.activityId,
                    label: current.displayName,
                    url: current.url,
                    imageUrl: current.imageUrl,
                    mapId,
                    description: current.description,
                    tags: current.tags,
                    width: 1,
                    depth: current.depth,
                    parent: current.parent,
                    next: current.next
                }
                items.push(item);
                // if (current.parent) current.parent.children.push(item)
                const next = current.next.map((el: any) => {
                    // todo: should calc counter/yoffset in here??
                    el.depth = current.depth + 1;
                    el.parent = item;
                    return el;
                })
                activities = activities.concat(next);
            }
        }

        items.forEach(el => {
            // console.log(el)
            this.setWidths(el)
        })
        // this.setWidths(base)

        console.log(items)
        return items;
    }

    protected setWidths(node: SkillGraphItem) {
        if (node.next && node.next.length) {
            // console.log(node.next.length)
            node.width = 0;
            for (let child of node.next) {
                node.width += this.setWidths(child);
            }
        } else {
            node.width = 1;
        }
        // console.log(node.label, node.width)
        return node.width;
    }

    protected onItemSelect = (id: string) => {
        const { dispatchChangeSelectedItem } = this.props;
        if (id !== this.props.selectedItem) {
            dispatchChangeSelectedItem(id);
        } else {
            dispatchChangeSelectedItem(undefined);
        }
    }

    // todo remove probably
    protected getSelectedItem(id?: string) {
        let item: SkillGraphItem | undefined;
        this.items.forEach(el => { if (el.id === id) item = el; });
        return item;
    }

    // depth: depth in chart (distance from root)
    // counter: the nth item we've encountered with this depth
    protected getOffset(depth: number, counter: number,): { x: number, y: number } {
        return { x: (depth + 1) * 120, y: counter * 80 + 10}
    }

    render() {
        const { map, user, selectedItem, pageSourceUrl } = this.props;
        // const completed = isMapCompleted(user, pageSourceUrl, map);
        // const requirments = this.renderRequirements();
        let currentDepth = 0;
        let yOffset = 0;

        const selected = this.getSelectedItem(selectedItem);

        const widthMap: {[key: string]: number} = {}

        // calc max depth, max height, to get size?
        // todo title prereqs (in component??)
        return <div className="skill-graph">
            {map.displayName && <div className="graph-title">
                <span>{map.displayName}</span>
            </div>}
            <div className="graph">
                <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
                    {this.items.map((el, i) => {
                        // TODO this should be calculated before render time

                        const key = el.depth + "";
                        if (!widthMap[key]) widthMap[key] = 1;
                        if (currentDepth != el.depth) {
                            currentDepth = el.depth;
                            yOffset = 1;
                        } else {
                            yOffset = widthMap[key];
                        }
                        widthMap[key] = (widthMap[key])  + el.width;
                        (el as any).yoffset = yOffset;
                        console.log(el.label)
                        console.log("depth:" + key, "width:" + el.width, "yoff:" + yOffset);
                        // todo: translateX and translateY should be in functions (for easy to vary graph placement)

                        // function to calculate placement {x, y}
                        // can run on parent node? save parent placement? draw line to previously completed? (for total freedom version -> can be weird)
                        // console.log(el.parent)
                        return <SkillGraphNode key={`graph-activity-${i}`} item={el}
                            id={el.id}
                            mapId={map.mapId}
                            offset={this.getOffset(el.depth, yOffset)}
                            parentOffset={this.getOffset(el.parent?.depth || 0, (el.parent as any)?.yoffset || 0)}
                            selected={el.id === selectedItem}
                            onItemSelect={this.onItemSelect} />
                    })}
                </svg>
                {/* {selected && <div className="graph-activity-card"
                        style={ {
                            position: "absolute",
                            left: this.getOffset(selected.depth, (selected as any)?.yoffset).x + "px",
                            top: this.getOffset(selected.depth, (selected as any)?.yoffset).y + "px"
                        } }>
                            <div className="graph-activity-info">
                                <div className="graph-card-title">{selected.label}</div>
                                <div className="graph-card-description">{selected.description}</div>
                                <div className="spacer"></div>
                                <SkillCardActionButton id={selected.id} mapId={map.mapId} />
                            </div>
                    </div>} */}
            </div>
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    const map: SkillMap = ownProps.map;
    const mapProgress = state.user?.mapProgress?.[state.pageSourceUrl];
    let requiredMaps: SkillMap[] = [];

    // if (map.prerequisites?.length && state.pageSourceUrl) {
    //     requiredMaps = map.prerequisites
    //         .filter(req => req.type === "map" && !isMapUnlocked(state.user, state.maps[req.mapId], state.pageSourceUrl!))
    //         .map(req => state.maps[(req as MapFinishedPrerequisite).mapId]);

    // }

    return {
        user: state.user,
        requiredMaps,
        pageSourceUrl: state.pageSourceUrl,
        completionState: mapProgress?.[map.mapId]?.completionState,
        selectedItem: state.selectedItem && ownProps.map?.activities?.[state.selectedItem] ? state.selectedItem : undefined
    }
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem
};

export const SkillGraph = connect(mapStateToProps, mapDispatchToProps)(SkillGraphImpl);