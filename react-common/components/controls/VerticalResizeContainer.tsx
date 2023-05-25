import * as React from "react";
import { classList, ContainerProps } from "../util";

export interface VerticalResizeContainerProps extends ContainerProps {
    minHeight?: string;
    maxHeight?: string;
    heightProperty?: string;
    style?: any;
    onResizeDrag?: () => void;
    onResizeEnd?: () => void;
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
        heightProperty,
        onResizeDrag,
        onResizeEnd,
        style,
        children
    } = props;

    const RESIZABLE_BORDER_SIZE = 4;

    const containerRef: React.MutableRefObject<HTMLDivElement> = React.useRef(undefined);

    const resize = (e: React.MouseEvent | MouseEvent) => {
        const containerEl: HTMLDivElement = document.querySelector(`#${id}`);

        containerEl.style.setProperty(
            heightProperty,
            `max(min(${maxHeight}, ${e.pageY - containerEl.offsetTop}px), ${minHeight})`
        );
        e.preventDefault();
        e.stopPropagation();

        if(onResizeDrag) {
            onResizeDrag();
        }
    }

    const cleanEvents = () => {
        document.removeEventListener("pointermove", resize, false);
        document.removeEventListener("pointerup", cleanEvents, false);
        document.querySelector("body")?.classList.remove("cursor-resize");
        
        if(onResizeEnd) {
            onResizeEnd();
        }
    }

    React.useEffect(() => cleanEvents, []);

    const onPointerDown = (e: React.MouseEvent) => {
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
        className={classList("vertical-resize-container", className)}
        aria-describedby={ariaDescribedBy}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        style={style}>
            {children}
    </div>
}