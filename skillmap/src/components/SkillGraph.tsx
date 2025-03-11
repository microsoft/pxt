import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchChangeSelectedItem, dispatchShowCompletionModal,
    dispatchSetSkillMapCompleted, dispatchOpenActivity, dispatchRestartActivity } from '../actions/dispatch';
import { GraphNode } from './GraphNode';
import { GraphPath } from "./GraphPath";

import { getActivityStatus, isCodeCarryoverEnabled, lookupActivityProgress,
    lookupPreviousCompletedActivityState } from '../lib/skillMapUtils';
import { SvgGraphItem, SvgGraphPath } from '../lib/skillGraphUtils';
import { tickEvent } from "../lib/browserUtils";

export interface SkillGraphProps {
    // Rendering
    unit: number;
    items: SvgGraphItem[];
    paths: SvgGraphPath[];
    width: number;
    height: number;

    // Skillmap
    map: SkillMap;
    user: UserState;
    selectedActivityId?: string;
    pageSourceUrl: string;
    theme: SkillGraphTheme;
    completionState: "incomplete" | "transitioning" | "completed";

    // Events
    dispatchChangeSelectedItem: (mapId?: string, activityId?: string) => void;
    dispatchShowCompletionModal: (mapId: string, activityId?: string) => void;
    dispatchSetSkillMapCompleted: (mapId: string) => void;
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchRestartActivity: (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => void;
}

class SkillGraphImpl extends React.Component<SkillGraphProps> {
    constructor(props: SkillGraphProps) {
        super(props);
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

    protected onItemDoubleClick = (activityId: string, kind: MapNodeKind) => {
        const { user, pageSourceUrl, map, dispatchOpenActivity, dispatchRestartActivity } = this.props;
        const { status } = getActivityStatus(user, pageSourceUrl, map, activityId);
        const activity = map.activities[activityId];
        tickEvent("skillmap.activity.open.doubleclick", { path: map.mapId, activity: activityId, status: status || "" });

        const progress = lookupActivityProgress(user, pageSourceUrl, map.mapId, activity.activityId);
        const previousState = lookupPreviousCompletedActivityState(user, pageSourceUrl, map, activity.activityId);

        if (isCodeCarryoverEnabled(user, pageSourceUrl, map, activity) && !progress?.headerId) {
            dispatchRestartActivity(map.mapId, activityId, previousState.headerId, !!previousState.headerId);
        } else if (kind == "activity" && status !== "locked") {
            dispatchOpenActivity(map.mapId, activityId);
        }
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
        const { unit, items, paths, map, user, selectedActivityId, pageSourceUrl, theme } = this.props;

        return <g className="skill-graph">
            <g opacity={theme.pathOpacity}>
                {paths.map((el, i) => {
                    return <GraphPath className="skill-graph-path-border" key={`graph-activity-${i}`} strokeWidth={3 * unit} color={theme.strokeColor} points={el.points} />
                })}
                {paths.map((el, i) => {
                    return <GraphPath className="skill-graph-path" key={`graph-activity-${i}`} strokeWidth={3 * unit - 4} color={theme.pathColor}  points={el.points} />
                })}
            </g>
            {items.map((el, i) => {
                return <GraphNode key={`graph-activity-${i}`}
                    node={el.activity}
                    theme={theme}
                    kind={el.activity.kind}
                    position={el.position}
                    width={5 * unit}
                    selected={el.activity.activityId === selectedActivityId}
                    onItemSelect={this.onItemSelect}
                    onItemDoubleClick={this.onItemDoubleClick}
                    status={getActivityStatus(user, pageSourceUrl, map, el.activity.activityId).status} />
            })}
        </g>
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
    } as SkillGraphProps
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem,
    dispatchShowCompletionModal,
    dispatchSetSkillMapCompleted,
    dispatchOpenActivity,
    dispatchRestartActivity
};

export const SkillGraph = connect(mapStateToProps, mapDispatchToProps)(SkillGraphImpl);
