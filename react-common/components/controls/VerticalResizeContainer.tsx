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
    const containerRef: React.MutableRefObject<HTMLDivElement> = React.useRef(undefined);
    const heightProperty = `--${id}-height`;
    const containerEl: HTMLDivElement = document.querySelector(`#${id}`);

    let [hasResized, setHasResized] = React.useState(false);

    const resize = (e: React.MouseEvent | MouseEvent) => {
        let heightVal = `${e.pageY - containerEl.offsetTop}px`;
        if (maxHeight) heightVal = `min(${maxHeight}, ${heightVal})`;
        if (minHeight) heightVal = `max(${minHeight}, ${heightVal})`;

        containerEl.style.setProperty(heightProperty, heightVal);

        if (onResizeDrag) {
            onResizeDrag(containerEl.clientHeight);
        }

        setHasResized(true);

        e.preventDefault();
        e.stopPropagation();
    }

    const onPointerUp = () => {
        // Clean resize events
        document.removeEventListener("pointermove", resize, false);
        document.removeEventListener("pointerup", onPointerUp, false);
        document.querySelector("body")?.classList.remove("cursor-resize");

        // Notify resize end
        if (onResizeEnd) {
            onResizeEnd(containerEl.clientHeight);
        }
    }

    React.useEffect(() => onPointerUp, []);

    const onPointerDown = (e: React.MouseEvent) => {
        if (!resizeEnabled) {
            return;
        }

        const computedStyle = getComputedStyle(containerRef?.current);
        const containerHeight = parseInt(computedStyle.height) - parseInt(computedStyle.borderWidth);
        if (e.nativeEvent.offsetY < containerHeight && e.nativeEvent.offsetY > containerHeight - RESIZABLE_BORDER_SIZE - 4) {
            document.querySelector("body")?.classList.add("cursor-resize");
            document.addEventListener("pointermove", resize, false);
            document.addEventListener("pointerup", onPointerUp, false);
        }
    }

    return <div
        id={id}
        ref={containerRef}
        className={classList(resizeEnabled ? "vertical-resize-container" : "", className)}
        aria-describedby={ariaDescribedBy}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        style={{height: resizeEnabled && hasResized ? `var(${heightProperty})` : initialHeight}}>
            {children}
    </div>
}