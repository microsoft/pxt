import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { Item } from './CarouselItem';

import { isActivityUnlocked, isMapUnlocked, lookupActivityProgress, } from '../lib/skillMapUtils';

/* tslint:disable:no-import-side-effect */
import '../styles/skillnode.css'
/* tslint:enable:no-import-side-effect */

type SkillCardStatus = "locked" | "notstarted" | "inprogress" | "completed" | "restarted";

export interface GraphCoord {
    x: number;
    y: number;
}

export interface SkillGraphItem extends Item {
    depth: number;
    mapId: string;
    description?: string;
    tags?: string[];
    parent?: SkillGraphItem
}

interface SkillGraphNodeProps {
    status?: SkillCardStatus;
    item: SkillGraphItem;
    offset: GraphCoord;
    parentOffset?: GraphCoord;
    selected?: boolean;
    onItemSelect?: (id: string) => void;
}

export class SkillGraphNodeImpl extends React.Component<SkillGraphNodeProps> {

    protected handleClick = () => {
        if (this.props.onItemSelect) this.props.onItemSelect(this.props.item.id);
    }

    render() {
        const  { item, offset, parentOffset, selected, status } = this.props;
        const { depth, parent, label } = item;

        const xdiff = (parentOffset?.x || 0) - offset.x;
        const ydiff = (parentOffset?.y || 0) - offset.y;

        return  <g className={`graph-activity ${selected ? "selected" : ""}`} transform={`translate(${offset.x} ${offset.y})`} onClick={this.handleClick}>
            {parent && <line x1="0.0" y1="0.0" x2={xdiff} y2={ydiff} stroke="#000" />}
            <circle cx="0.0" cy="0.0" r="30.0" fill={`${status === "locked" ? "lightgrey" : "var(--tertiary-color)"}`} />
            <text textAnchor="middle">{label}</text>
        </g>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const map = state.maps?.[ownProps.mapId];
    const isUnlocked = state.user && map && isActivityUnlocked(state.user, state.pageSourceUrl, map, ownProps.id);

    let status: SkillCardStatus = isUnlocked ? "notstarted" : "locked";
    if (state.user) {
        if (map && state.pageSourceUrl && !isMapUnlocked(state.user, map, state.pageSourceUrl)) {
            status = "locked";
        }
        else {
            const progress = lookupActivityProgress(state.user, state.pageSourceUrl, ownProps.mapId, ownProps.id);
            console.log(ownProps.id)
            if (progress) {
                if (progress.isCompleted) {
                    status = (progress.currentStep && progress.maxSteps && progress.currentStep < progress.maxSteps) ?
                        "restarted" : "completed";
                }
                else if (progress.headerId) {
                    status = "inprogress";
                }
            }
        }
    }

    return {
        status
    };
}

export const SkillGraphNode = connect(mapStateToProps)(SkillGraphNodeImpl);