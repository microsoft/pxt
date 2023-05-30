import * as React from "react";
import { classList, ContainerProps } from "../util";

export interface VerticalResizeContainerProps extends ContainerProps {
    horizontalResizeEnabled?: boolean;
    verticalResizeEnabled?: boolean;
    minWidth?: string;
    maxWidth?: string;
    initialWidth?: string;
    minHeight?: string;
    maxHeight?: string;
    initialHeight?: string;
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
        minWidth,
        maxWidth,
        initialWidth,
        minHeight,
        maxHeight,
        initialHeight,
        children,
        horizontalResizeEnabled,
        verticalResizeEnabled,
        onResizeDrag,
        onResizeEnd
    } = props;

    const RESIZABLE_BORDER_SIZE = 4;
    const containerRef: React.MutableRefObject<HTMLDivElement> = React.useRef(undefined);
    const widthProperty = `--${id}-width`;
    const heightProperty = `--${id}-height`;
    const containerEl: HTMLDivElement = document.querySelector(`#${id}`);

    let [hasResizedVertical, setHasResizedVertical] = React.useState(false);
    let [hasResizedHorizontal, setHasResizedHorizontal] = React.useState(false);

    const resizeVertical = (e: React.MouseEvent | MouseEvent) => {
        containerEl.style.setProperty(
            heightProperty,
            `max(min(${maxHeight}, ${e.pageY - containerEl.offsetTop}px), ${minHeight})`
        );

        if (onResizeDrag) {
            onResizeDrag(containerEl.clientHeight);
        }

        setHasResizedVertical(true);

        e.preventDefault();
        e.stopPropagation();
    }

    const resizeHorizontal = (e: React.MouseEvent | MouseEvent) => {
        containerEl.style.setProperty(
            widthProperty,
            `max(min(${maxWidth}, ${e.pageX - containerEl.offsetLeft}px), ${minWidth})` // TODO thsparks - Handle min/max unset.
        );

        if (onResizeDrag) {
            onResizeDrag(containerEl.clientWidth); // TODO thsparks - pass width and height?
        }

        setHasResizedHorizontal(true);

        e.preventDefault();
        e.stopPropagation();
    }

    const cleanEvents = () => {
        document.removeEventListener("pointermove", resizeVertical, false);
        document.removeEventListener("pointermove", resizeHorizontal, false);
        document.removeEventListener("pointerup", cleanEvents, false);
        document.querySelector("body")?.classList.remove("cursor-resize");
        
        if (onResizeEnd) {
            onResizeEnd(containerEl.clientHeight); // TODO thsparks - move into separate function.
        }
    }

    React.useEffect(() => cleanEvents, []);

    const onPointerDown = (e: React.MouseEvent) => {
        const computedStyle = getComputedStyle(containerRef?.current);

        if (horizontalResizeEnabled) {
            const containerWidth = parseInt(computedStyle.width) - parseInt(computedStyle.borderWidth);
            if (e.nativeEvent.offsetX > containerWidth - RESIZABLE_BORDER_SIZE - 4) {
                document.querySelector("body")?.classList.add("cursor-resize");
                document.addEventListener("pointermove", resizeHorizontal, false);
                document.addEventListener("pointerup", cleanEvents, false);
            }
        }

        if (verticalResizeEnabled) {
            const containerHeight = parseInt(computedStyle.height) - parseInt(computedStyle.borderWidth);
            if (e.nativeEvent.offsetY > containerHeight - RESIZABLE_BORDER_SIZE - 4) {
                document.querySelector("body")?.classList.add("cursor-resize");
                document.addEventListener("pointermove", resizeVertical, false);
                document.addEventListener("pointerup", cleanEvents, false);
            }
        }
    }

    return <div
        id={id}
        ref={containerRef}
        className={classList(horizontalResizeEnabled ? "horizontal-resize-container" : "", verticalResizeEnabled ? "vertical-resize-container" : "", className)}
        aria-describedby={ariaDescribedBy}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        style={{height: hasResizedVertical ? `var(${heightProperty})` : initialHeight, width: hasResizedHorizontal ?  `var(${widthProperty})` : initialWidth}}>
            {children}
    </div>
}