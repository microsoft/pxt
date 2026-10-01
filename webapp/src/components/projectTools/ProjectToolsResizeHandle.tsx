import * as React from "react";
import { classList } from "../../../../react-common/components/util";
import { PROJECT_TOOLS_PANEL_ID } from "../../projectToolsState";

export type ProjectToolsResizeAxis = "width" | "height";

export interface ProjectToolsResizeHandleProps {
    axis: ProjectToolsResizeAxis;
    value: number;
    min: number;
    max: number;
    onFocus: () => void;
    onPointerDown: React.PointerEventHandler<HTMLDivElement>;
    onPointerMove: React.PointerEventHandler<HTMLDivElement>;
    onPointerUp: React.PointerEventHandler<HTMLDivElement>;
    onPointerCancel: React.PointerEventHandler<HTMLDivElement>;
    onLostPointerCapture: React.PointerEventHandler<HTMLDivElement>;
    onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
}

export function ProjectToolsResizeHandle(props: ProjectToolsResizeHandleProps): JSX.Element {
    const {
        axis,
        value,
        min,
        max,
        onFocus,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onLostPointerCapture,
        onKeyDown
    } = props;
    const width = axis === "width";
    const label = width ? lf("Resize project tools width") : lf("Resize project tools height");

    return (
        <div
            className={classList("project-tools-resize", `project-tools-resize-${axis}`)}
            role="separator"
            aria-orientation={width ? "vertical" : "horizontal"}
            tabIndex={0}
            aria-label={label}
            title={label}
            aria-controls={PROJECT_TOOLS_PANEL_ID}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            onFocus={onFocus}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onLostPointerCapture={onLostPointerCapture}
            onKeyDown={onKeyDown}
        >
            <svg
                className="project-tools-resize-grip"
                viewBox={width ? "0 0 8 20" : "0 0 20 8"}
                aria-hidden="true"
                focusable="false"
            >
                {[4, 10, 16].map(position => (
                    <React.Fragment key={position}>
                        <circle
                            cx={width ? 2 : position}
                            cy={width ? position : 2}
                            r="1"
                        />
                        <circle
                            cx={width ? 6 : position}
                            cy={width ? position : 6}
                            r="1"
                        />
                    </React.Fragment>
                ))}
            </svg>
        </div>
    );
}
