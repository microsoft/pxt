import * as React from "react";

import { SvgCoord } from '../lib/skillGraphUtils';

/* tslint:disable:no-import-side-effect */
import '../styles/skillnode.css'
/* tslint:enable:no-import-side-effect */

interface SkillGraphPathProps {
    points: SvgCoord[];
    strokeWidth: number;
    color: string;
}

export class SkillGraphPath extends React.Component<SkillGraphPathProps> {
    render() {
        const  { points, strokeWidth, color } = this.props;

        let pathStart = "M 0 0";
        let pathEnd = "";
        let start, end: SvgCoord;
        points.forEach(p => {
            start = p;
            if (end) {
                pathStart += ` l ${(end?.x || 0) - start.x} ${(end?.y || 0) - start.y}`;
                pathEnd = ` l ${start.x - (end?.x || 0)} ${start.y - (end?.y || 0)} ${pathEnd}`;
            }
            end = start;
        })

        return  <g transform={`translate(${end!.x || 0} ${end!.y || 0})`}>
            <path stroke={color} strokeWidth={strokeWidth} d={`${pathStart} ${pathEnd}`} />
        </g>
    }
}