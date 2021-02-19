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
    width: number;
    mapId: string;
    description?: string;
    tags?: string[];
    parent?: SkillGraphItem;
    next?: SkillGraphItem[]
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

        // console.log(item.width)

        return  <g className={`graph-activity ${selected ? "selected" : ""}`} transform={`translate(${offset.x} ${offset.y})`} onClick={this.handleClick}>
            {/* {parent && <line x1="0.0" y1="0.0" x2={xdiff} y2={0} stroke="#000" />}
            {parent && <line x1={xdiff} y1="0.0" x2={xdiff} y2={ydiff} stroke="#000" />} */}
            {/* {parent && <path stroke="#000" strokeWidth="40"
                d={`M 0 0 h ${xdiff} v ${ydiff} v ${-ydiff} h ${-xdiff}`} />}
            {parent && <path stroke="lightgrey" strokeWidth="36"
                d={`M 0 0 h ${xdiff} v ${ydiff} v ${-ydiff} h ${-xdiff}`} />} */}
            <rect x="-25.0" y="-25.0" width="50.0" height="50.0" rx="5" fill={`${status === "locked" ? "lightgrey" : "var(--tertiary-color)"}`} stroke="#000" strokeWidth="2" />

            {status === "locked" ?
                <text textAnchor="middle" alignmentBaseline="middle" className="graph-icon">{"\uf023"}</text>
                : <text textAnchor="middle" alignmentBaseline="middle" className="graph-icon">{"\uf11b"}</text>
            }
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