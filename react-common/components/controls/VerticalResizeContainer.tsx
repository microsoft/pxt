import * as React from "react";
import { classList, ContainerProps } from "../util";

export interface VerticalResizeContainerProps extends ContainerProps {
    minHeight?: string;
    maxHeight?: string;
    initialHeight?: string;
    resizeEnabled?: boolean;
    onResizeDrag?: (newSize: number) => void;
    onResizeEnd?: (newSize: number) => void;
}

export const VerticalResizeContainer = (props: VerticalResizeContainerProps) => {
    const {
        id,
        className,
        ariaDescribedBy,
        ariaHidden,
        ariaLabel,
        minHeight,
        maxHeight,
        initialHeight,
        children,
        resizeEnabled,
        onResizeDrag,
        onResizeEnd
    } = props;

    const RESIZABLE_BORDER_SIZE = 4;
    const containerRef = React.useRef<HTMLDivElement>();
    const heightProperty = `--${id}-height`;

    let [hasResized, setHasResized] = React.useState(false);

    React.useEffect(() => {
        if (!resizeEnabled) return undefined;

        const container = containerRef.current;

        const resize = (e: MouseEvent) => {
            let heightVal = `${e.pageY - container.offsetTop}px`;
            if (maxHeight) heightVal = `min(${maxHeight}, ${heightVal})`;
            if (minHeight) heightVal = `max(${minHeight}, ${heightVal})`;

            container.style.setProperty(heightProperty, heightVal);

            if (onResizeDrag) {
                onResizeDrag(container.clientHeight);
            }

            setHasResized(true);

            e.preventDefault();
            e.stopPropagation();
        };

        const cleanupBodyEvents = () => {
            document.removeEventListener("pointermove", resize, false);
            document.removeEventListener("pointerup", onPointerUp, false);
            document.body.classList.remove("cursor-resize");
        };

        const onPointerUp = () => {
            // Clean resize events
            cleanupBodyEvents();

            // Notify resize end
            if (onResizeEnd) {
                onResizeEnd(container.clientHeight);
            }
        };

        const onPointerDown = (e: MouseEvent) => {
            const computedStyle = getComputedStyle(container);
            const containerHeight = parseInt(computedStyle.height) - parseInt(computedStyle.borderWidth);
            if (e.offsetY < containerHeight && e.offsetY > containerHeight - RESIZABLE_BORDER_SIZE - 4) {
                document.body.classList.add("cursor-resize");
                document.addEventListener("pointermove", resize, false);
                document.addEventListener("pointerup", onPointerUp, false);
            }
        };

        container.addEventListener("pointerdown", onPointerDown);

        return () => {
            container.removeEventListener("pointerdown", onPointerDown);
            cleanupBodyEvents();
        };
    }, [heightProperty, minHeight, maxHeight, onResizeEnd, onResizeDrag, resizeEnabled]);

    return <div
        id={id}
        ref={containerRef}
        className={classList(resizeEnabled ? "vertical-resize-container" : "", className)}
        aria-describedby={ariaDescribedBy}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        style={{height: resizeEnabled && hasResized ? `var(${heightProperty})` : initialHeight}}>
            {children}
    </div>
}