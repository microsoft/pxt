import * as React from "react";
import { ProjectToolsResizeAxis, ProjectToolsResizeHandleProps } from "./ProjectToolsResizeHandle";

interface WidthRange {
    width: number;
    min: number;
    max: number;
}

interface HeightRange {
    height: number;
    max: number;
}

export interface ProjectToolsResizeState {
    width?: number;
    height?: number;
    resizing: boolean;
    widthHandle: ProjectToolsResizeHandleProps;
    heightHandle: ProjectToolsResizeHandleProps;
}

/** Keep pointer/keyboard sizing and ARIA limits synchronized with the panel's CSS bounds. */
export function useProjectToolsResize(
    panel: React.RefObject<HTMLDivElement>,
    expanded: boolean,
    compact: boolean,
    rtl: boolean
): ProjectToolsResizeState {
    // Leave initial sizing to CSS; remember explicit sizes for this project view.
    const [width, setWidth] = React.useState<number>();
    const [height, setHeight] = React.useState<number>();
    const [widthRange, setWidthRange] = React.useState<WidthRange>({ width: 0, min: 0, max: 0 });
    const [heightRange, setHeightRange] = React.useState<HeightRange>({ height: 0, max: 0 });
    const [resizing, setResizing] = React.useState(false);
    const drag = React.useRef<{ axis: ProjectToolsResizeAxis; position: number; size: number }>();

    const measureWidth = React.useCallback((): WidthRange => {
        const bounds = panel.current.getBoundingClientRect();
        const style = window.getComputedStyle(panel.current);
        const maxWidth = parseFloat(style.maxWidth);
        const minWidth = parseFloat(style.minWidth);
        const max = Math.min(900, Number.isFinite(maxWidth) ? maxWidth : window.innerWidth);

        return {
            width: bounds.width,
            min: Math.min(max, Number.isFinite(minWidth) ? minWidth : 256),
            max
        };
    }, [panel]);

    const measureHeight = React.useCallback((): HeightRange => {
        const bounds = panel.current.getBoundingClientRect();
        const maxHeight = parseFloat(window.getComputedStyle(panel.current).maxHeight);

        return {
            height: bounds.height,
            max: Number.isFinite(maxHeight) ? maxHeight : Math.max(0, window.innerHeight - bounds.top)
        };
    }, [panel]);

    const updateSizeRanges = React.useCallback((): void => {
        const height = measureHeight();
        const width = measureWidth();
        setHeightRange(previous =>
            previous.height === height.height && previous.max === height.max ? previous : height
        );
        setWidthRange(previous =>
            previous.width === width.width && previous.min === width.min && previous.max === width.max ? previous : width
        );
    }, [measureHeight, measureWidth]);

    React.useLayoutEffect(() => {
        if (!expanded) {
            return undefined;
        }

        updateSizeRanges();
        const observer = new ResizeObserver(updateSizeRanges);
        observer.observe(panel.current);
        window.addEventListener("resize", updateSizeRanges);

        // A banner can move the top edge without resizing a manually sized panel.
        const layoutRoot = panel.current.closest("#root");
        const mutations = new MutationObserver(updateSizeRanges);
        if (layoutRoot) {
            mutations.observe(layoutRoot, { attributes: true, attributeFilter: ["class"] });
        }

        return () => {
            observer.disconnect();
            mutations.disconnect();
            window.removeEventListener("resize", updateSizeRanges);
        };
    }, [panel, expanded, compact, updateSizeRanges]);

    const resizeWidth = (value: number): void => {
        const { min, max } = measureWidth();
        setWidth(Math.max(min, Math.min(max, value)));
    };

    const resizeHeight = (value: number): void => {
        const { max } = measureHeight();
        setHeight(Math.min(max, Math.max(Math.min(240, max), value)));
    };

    const startResize = (event: React.PointerEvent<HTMLDivElement>, axis: ProjectToolsResizeAxis): void => {
        if (event.button !== 0 || drag.current) {
            return;
        }

        event.preventDefault();
        const bounds = panel.current.getBoundingClientRect();
        drag.current = {
            axis,
            position: axis === "width" ? event.clientX : event.clientY,
            size: bounds[axis]
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setResizing(true);
    };

    const moveResize = (event: React.PointerEvent<HTMLDivElement>): void => {
        const current = drag.current;
        if (!current) {
            return;
        }

        if (current.axis === "width") {
            resizeWidth(current.size + (event.clientX - current.position) * (rtl ? 1 : -1));
        } else {
            resizeHeight(current.size + event.clientY - current.position);
        }
    };

    const stopResize = (event: React.PointerEvent<HTMLDivElement>): void => {
        drag.current = undefined;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setResizing(false);
    };

    const lostResizeCapture = (): void => {
        drag.current = undefined;
        setResizing(false);
    };

    const resizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, axis: ProjectToolsResizeAxis): void => {
        if (axis === "width") {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                return;
            }

            event.preventDefault();
            if (event.key === "Home") {
                resizeWidth(measureWidth().min);
            } else if (event.key === "End") {
                resizeWidth(900);
            } else {
                resizeWidth(
                    measureWidth().width + (event.key === "ArrowLeft" ? 1 : -1) * (rtl ? -1 : 1) * (event.shiftKey ? 80 : 20)
                );
            }
        } else {
            if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                return;
            }

            event.preventDefault();
            if (event.key === "Home") {
                resizeHeight(240);
            } else if (event.key === "End") {
                setHeight(undefined);
            } else {
                resizeHeight(
                    measureHeight().height + (event.key === "ArrowDown" ? 1 : -1) * (event.shiftKey ? 80 : 20)
                );
            }
        }
    };

    const handleProps = (axis: ProjectToolsResizeAxis): ProjectToolsResizeHandleProps => ({
        axis,
        value: axis === "width" ? widthRange.width : heightRange.height,
        min: axis === "width" ? widthRange.min : Math.min(240, heightRange.max),
        max: axis === "width" ? widthRange.max : heightRange.max,
        onFocus: updateSizeRanges,
        onPointerDown: event => startResize(event, axis),
        onPointerMove: moveResize,
        onPointerUp: stopResize,
        onPointerCancel: stopResize,
        onLostPointerCapture: lostResizeCapture,
        onKeyDown: event => resizeKeyDown(event, axis)
    });

    return {
        width,
        height,
        resizing,
        widthHandle: handleProps("width"),
        heightHandle: handleProps("height")
    };
}
