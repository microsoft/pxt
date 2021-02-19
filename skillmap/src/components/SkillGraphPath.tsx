import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { SkillGraphItem } from './SkillGraphNode';

import { isActivityUnlocked, isMapUnlocked, lookupActivityProgress, } from '../lib/skillMapUtils';

/* tslint:disable:no-import-side-effect */
import '../styles/skillnode.css'
/* tslint:enable:no-import-side-effect */

type SkillCardStatus = "locked" | "notstarted" | "inprogress" | "completed" | "restarted";

export interface GraphCoord {
    x: number;
    y: number;
}

interface SkillGraphPathProps {
    status?: SkillCardStatus;
    item: SkillGraphItem;
    offset: GraphCoord;
    parentOffset?: GraphCoord;
    selected?: boolean;
    onItemSelect?: (id: string) => void;
    width: number;
    color: string;
}

export class SkillGraphPathImpl extends React.Component<SkillGraphPathProps> {
    render() {
        const  { item, offset, parentOffset, selected, status, width, color } = this.props;
        const { depth, parent, label } = item;

        const xdiff = (parentOffset?.x || 0) - offset.x;
        const ydiff = (parentOffset?.y || 0) - offset.y;

        // console.log(item.width)

        return  <g className={`graph-activity ${selected ? "selected" : ""}`} transform={`translate(${offset.x} ${offset.y})`} onClick={this.handleClick}>
            {/* {parent && <line x1="0.0" y1="0.0" x2={xdiff} y2={0} stroke="#000" />}
            {parent && <line x1={xdiff} y1="0.0" x2={xdiff} y2={ydiff} stroke="#000" />} */}
            {parent && <path stroke={color} strokeWidth={width}
                d={`M 0 0 h ${xdiff} v ${ydiff} v ${-ydiff} h ${-xdiff}`} />}
            {/* {parent && <path stroke="lightgrey" strokeWidth="36"
                d={`M 0 0 h ${xdiff} v ${ydiff} v ${-ydiff} h ${-xdiff}`} />} */}
        </g>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    return { };
}

export const SkillGraphPath = connect(mapStateToProps)(SkillGraphPathImpl);