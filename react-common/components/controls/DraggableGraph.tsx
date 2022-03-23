import * as React from "react";
import { ControlProps } from "../util";

export interface DraggableGraphProps extends ControlProps {
    interpolation: pxt.assets.SoundInterpolation;
    min: number;
    max: number;

    // Points are equally spaced along the graph
    points: number[];
}

export const DraggableGraph = (props: DraggableGraphProps) => {
    const {
        interpolation,
        min,
        max,
        points,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
    } = props;

    const width = 100;
    const height = 32;

    const xSlice = width / (points.length - 1);
    const yScale = height / (max - min);

    return <div>
        <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
            {points.map((val, index) =>
                <g key={index}>
                    <rect
                        className="draggable-graph-point"
                        x={xSlice * index - (index ? 2 : 0)}
                        y={yScale * val}
                        width={2}
                        height={2}
                        />
                    {index < points.length - 1 &&
                        <path
                            className="draggable-graph-path"
                            stroke="black"
                            stroke-width={0.5}
                            d={getInterpolationPath(
                                xSlice * index - (index ? 2 : 0) + 1,
                                yScale * val + 1,
                                xSlice * (index + 1) - 1,
                                points[index + 1] * yScale + 1,
                                interpolation
                            )}
                        />
                    }
                </g>
            )}
        </svg>
    </div>
}

function getInterpolationPath(x0: number, y0: number, x1: number, y1: number, curve: pxt.assets.SoundInterpolation) {
    switch (curve) {
        // case "none":
        //     return `M ${x0} ${y0} H ${(x0 + x1) / 2} V ${y1} H ${x1}`;
        case "linear":
            return `M ${x0} ${y0} L ${x1} ${y1}`;
        case "curve":
            return `M ${x0} ${y0} `
        case "logarithmic":
            return `M ${x0} ${y0} `
    }
    return "";
}
