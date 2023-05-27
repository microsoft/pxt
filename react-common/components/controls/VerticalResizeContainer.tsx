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
        containerEl.style.setProperty(
            heightProperty,
            `max(min(${maxHeight}, ${e.pageY - containerEl.offsetTop}px), ${minHeight})`
        );

        if (onResizeDrag) {
            onResizeDrag(containerEl.clientHeight);
        }

        setHasResized(true);

        e.preventDefault();
        e.stopPropagation();
    }

    const cleanEvents = () => {
        document.removeEventListener("pointermove", resize, false);
        document.removeEventListener("pointerup", cleanEvents, false);
        document.querySelector("body")?.classList.remove("cursor-resize");
        
        if (onResizeEnd) {
            onResizeEnd(containerEl.clientHeight);
        }
    }

    React.useEffect(() => cleanEvents, []);

    const onPointerDown = (e: React.MouseEvent) => {
        if (!resizeEnabled) {
            return;
        }

        const computedStyle = getComputedStyle(containerRef?.current);
        const containerHeight = parseInt(computedStyle.height) - parseInt(computedStyle.borderWidth);
        if (e.nativeEvent.offsetY > containerHeight - RESIZABLE_BORDER_SIZE - 4) {
            document.querySelector("body")?.classList.add("cursor-resize");
            document.addEventListener("pointermove", resize, false);
            document.addEventListener("pointerup", cleanEvents, false);
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
        style={{height: hasResized ? `var(${heightProperty})` : initialHeight}}>
            {children}
    </div>
}