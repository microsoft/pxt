import * as React from "react";
import { ControlProps, bindGestureEvents, GestureTarget, ClientCoordinates, screenToSVGCoord, clientCoord, classList } from "../util";

export interface DraggableGraphProps extends ControlProps {
    interpolation: pxt.assets.SoundInterpolation;
    min: number;
    max: number;
    squiggly?: boolean;

    aspectRatio: number; // width / height
    onPointChange: (index: number, newValue: number) => void;

    // Points are equally spaced y-values along the width of the graph
    points: number[];
    handleStartAnimationRef?: (startAnimation: (duration: number) => void) => void;
}

export const DraggableGraph = (props: DraggableGraphProps) => {
    const {
        interpolation,
        min,
        max,
        points,
        handleStartAnimationRef,
        onPointChange,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
        aspectRatio,
        squiggly
    } = props;

    const width = 1000;
    const height = (1 / aspectRatio) * width;

    const unit = width / 40;
    const halfUnit = unit / 2;

    const yOffset = unit;
    const availableHeight = height - unit * 5 / 2;
    const availableWidth = width - halfUnit * 3;

    const xSlice = availableWidth / (points.length - 1);
    const yScale = availableHeight / (max - min);

    const [dragIndex, setDragIndex] = React.useState(-1);

    const svgCoordToValue = (point: DOMPoint) =>
        (1 - ((point.y - yOffset) / availableHeight)) * (max - min) + min;

    let animationRef: number;

    const throttledSetDragValue = (index: number, value: number) => {
        if (animationRef) cancelAnimationFrame(animationRef);
        animationRef = requestAnimationFrame(() => {
            handlePointChange(index, value);
        });
    }

    const handlePointChange = (index: number, newValue: number) => {
        onPointChange(index, Math.max(Math.min(newValue, max), min));
    }

    const refs: SVGRectElement[] = [];

    const getPointRefHandler = (index: number) =>
        (ref: SVGRectElement) => {
            if (!ref) return;

            refs[index] = ref;
        }

    React.useEffect(() => {
        refs.forEach((ref, index) => {
            ref.onpointerdown = ev => {
                if (dragIndex !== -1) return;
                const coord = clientCoord(ev);
                const svg = screenToSVGCoord(ref.ownerSVGElement, coord);
                setDragIndex(index);
                throttledSetDragValue(index, svgCoordToValue(svg));
            };

            ref.onpointermove = ev => {
                if (dragIndex !== index) return;
                const coord = clientCoord(ev);
                const svg = screenToSVGCoord(ref.ownerSVGElement, coord);
                throttledSetDragValue(index, svgCoordToValue(svg));
            };

            ref.onpointerleave = ev => {
                if (dragIndex !== index) return;
                setDragIndex(-1);
                const coord = clientCoord(ev);
                const svg = screenToSVGCoord(ref.ownerSVGElement, coord);
                throttledSetDragValue(index, svgCoordToValue(svg));
            };

            ref.onpointerup = ev => {
                if (dragIndex !== index) return;
                setDragIndex(-1);
                const coord = clientCoord(ev);
                const svg = screenToSVGCoord(ref.ownerSVGElement, coord);
                throttledSetDragValue(index, svgCoordToValue(svg));
            };
        });
    }, [dragIndex, onPointChange])

    const getValue = (index: number) => {
        return points[index];
    }

    const handleRectAnimateRef = (ref: SVGAnimateElement) => {
        if (ref && handleStartAnimationRef) {
            handleStartAnimationRef((duration: number) => {
                ref.setAttribute("dur", duration + "ms");
                (ref as any).beginElement();
            })
        }
    }

    return <div
        id={id}
        className={classList("common-draggable-graph", className)}
        aria-label={ariaLabel}
        aria-hidden={ariaHidden}
        aria-describedby={ariaDescribedBy}
        role={role}>
        <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
            {points.map((val, index) => {
                const isNotLast = index < points.length - 1;
                const x = Math.max(xSlice * index - halfUnit, unit);
                const y = yOffset + Math.max(yScale * (max - getValue(index)) - halfUnit, halfUnit);

                // The logarithmic interpolation is perpendicular to the x-axis at the beginning, so
                // flip the label to the other side if it would overlap path
                const shouldFlipLabel = isNotLast && interpolation === "logarithmic" && getValue(index + 1) > getValue(index);

                return <g key={index}>
                        <rect
                            className="draggable-graph-point"
                            x={x}
                            y={y}
                            width={unit}
                            height={unit}
                            />
                        {isNotLast &&
                            <path
                                className="draggable-graph-path"
                                stroke="black"
                                fill="none"
                                strokeWidth="2px"
                                d={getInterpolationPath(
                                    x + halfUnit,
                                    y + halfUnit,
                                    Math.max(xSlice * (index + 1), 0),
                                    yOffset + Math.max(yScale * (max - getValue(index + 1)) - halfUnit, halfUnit) + halfUnit,
                                    interpolation,
                                    squiggly
                                )}
                            />
                        }
                        <text x={x + halfUnit} y={shouldFlipLabel ? y + unit * 2 : y - halfUnit} fontSize={unit} className="common-draggable-graph-text">
                            {Math.round(getValue(index))}
                        </text>
                        <rect
                            className="draggable-graph-surface"
                            ref={getPointRefHandler(index)}
                            x={x - xSlice / 6}
                            y={0}
                            width={xSlice / 3}
                            height={height}
                            fill="white"
                            opacity={0}
                            />
                    </g>
            })}
            <rect x="-2" y="0" width="1" height="100%" fill="grey">
                <animate ref={handleRectAnimateRef} attributeName="x" from="2%" to="98%" dur="1000ms" begin="indefinite" />
            </rect>
        </svg>
    </div>
}

function getInterpolationPath(x0: number, y0: number, x1: number, y1: number, curve: pxt.assets.SoundInterpolation, squiggly: boolean) {
    let pathFunction: (x: number) => number;

    switch (curve) {
        case "linear":
            pathFunction = x => y0 + (x - x0) * (y1 - y0) / (x1 - x0);
            break;
        case "curve":
            pathFunction = x => y0 + (y1 - y0) * Math.sin((x - x0) / (x1 - x0) * (Math.PI / 2));
            break;
        case "logarithmic":
            pathFunction = x => y0 + Math.log10(1 + 9 * ((x - x0) / (x1 - x0))) * (y1 - y0)
            break;
    }

    const slices = 20;
    const slice = (x1 - x0) / slices;

    const parts: string[] = [`M ${x0} ${y0}`];

    let prevX = x0;
    let prevY = y0;

    let currX = x0;
    let currY = y0;

    const squiggleAmplitude = 40;

    for (let i = 1; i < slices + 1; i++) {
        currX = x0 + i * slice;
        currY = pathFunction(currX);
        if (!squiggly) {
            parts.push(`L ${currX} ${currY}`);
            continue;
        }

        const angle = Math.atan2(currY - prevY, currX - prevX);
        const distance = Math.sqrt((currY - prevY) ** 2 + (currX - prevX) ** 2);

        const cx1 = prevX + Math.cos(angle) * (distance / 4) + squiggleAmplitude * Math.cos(angle + Math.PI / 2);
        const cy1 = prevY + Math.sin(angle) * (distance / 4) + squiggleAmplitude * Math.sin(angle + Math.PI / 2);

        parts.push(`Q ${cx1} ${cy1} ${prevX + Math.cos(angle) * (distance / 2)} ${prevY + Math.sin(angle) * (distance / 2)}`)

        const cx2 = prevX + Math.cos(angle) * (3 * distance / 4) - squiggleAmplitude * Math.cos(angle + Math.PI / 2);
        const cy2 = prevY + Math.sin(angle) * (3 * distance / 4) - squiggleAmplitude * Math.sin(angle + Math.PI / 2);

        parts.push(`Q ${cx2} ${cy2} ${currX} ${currY}`)

        prevX = currX;
        prevY = currY;
    }

    return parts.join(" ");
}
