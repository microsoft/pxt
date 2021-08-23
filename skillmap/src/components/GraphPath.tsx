import * as React from "react";

import { SvgCoord } from '../lib/skillGraphUtils';

interface GraphPathProps {
    points: SvgCoord[];
    strokeWidth: number;
    color: string;
}

export class GraphPath extends React.Component<GraphPathProps> {
    render() {
        const { points, strokeWidth, color } = this.props;

        let pathStart = `M 0 0`;
        let pathEnd = "";
        let next, prev: SvgCoord;
        points.forEach(p => {
            next = p;
            if (prev) {
                pathStart += ` l ${(next?.x || 0) - prev.x} ${(next?.y || 0) - prev.y}`;
                pathEnd = ` l ${prev.x - (next?.x || 0)} ${prev.y - (next?.y || 0)} ${pathEnd}`;
            }
            prev = next;
        })

        return  <g transform={`translate(${points[0]!.x || 0} ${points[0]!.y || 0})`}>
            <path stroke={color} strokeWidth={strokeWidth} d={`${pathStart} ${pathEnd}`} />
        </g>
    }
}
