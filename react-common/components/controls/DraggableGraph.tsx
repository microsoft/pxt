import * as React from "react";
import { ControlProps } from "../util";

export enum InterpolationCurve {
    None,
    Linear,
    Curve,
    Exponential
}

export interface DraggableGraphProps extends ControlProps {
    interpolation: InterpolationCurve;
    min: number;
    max: number;

    label: string;


    // Points are equally spaced along the graph
    points: number[];
}

export const DraggableGraph = (props: DraggableGraphProps) => {
    const {
        interpolation,
        min,
        max,
        label,
        points,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
    } = props;

    const height = 32;
    const width = 100;


    return <div>
        <svg viewBox={`0 0 ${height} ${width}`} xmlns="http://www.w3.org/2000/svg">
            {points.map((val, index) =>
                <g key={index}>
                    <rect
                        x={(width / (points.length - 1)) * index}
                        y={(height / (max - min)) * val}
                        width={2}
                        height={2}
                        />

                </g>
            )}
        </svg>
    </div>
}

function getInterpolationPath(x0: number, y0: number, x1: number, y1: number, curve: InterpolationCurve) {
    switch (curve) {
        case InterpolationCurve.None:
            return `M ${x0} ${y0} H ${(x0 + x1) / 2} V ${y1} H ${x1}`;
        case InterpolationCurve.Linear:
            return `M ${x0} ${y0} L ${x1} ${y1}`;
        case InterpolationCurve.Curve:
            return `M ${x0} ${y0} `
    }
    return "";
}
