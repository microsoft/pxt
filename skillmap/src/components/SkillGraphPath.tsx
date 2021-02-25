import * as React from "react";

import { GraphCoord } from '../lib/skillGraphUtils';

/* tslint:disable:no-import-side-effect */
import '../styles/skillnode.css'
/* tslint:enable:no-import-side-effect */

interface SkillGraphPathProps {
    start: GraphCoord;
    end: GraphCoord;
    strokeWidth: number;
    color: string;
    direction?: "vertical" | "horizontal"
}

export class SkillGraphPath extends React.Component<SkillGraphPathProps> {
    render() {
        const  { start, end, strokeWidth, color, direction } = this.props;

        const xdiff = (start?.x || 0) - end.x;
        const ydiff = (start?.y || 0) - end.y;
        const path = direction == "vertical"
            ? `v ${ydiff} h ${xdiff} h ${-xdiff} v ${-ydiff}`
            : `h ${xdiff} v ${ydiff} v ${-ydiff} h ${-xdiff}`

        return  <g transform={`translate(${end.x} ${end.y})`}>
            <path stroke={color} strokeWidth={strokeWidth} d={`M 0 0 ${path}`} />
        </g>
    }
}