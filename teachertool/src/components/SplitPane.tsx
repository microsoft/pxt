import * as React from "react";
import css from "./styling/SplitPane.module.scss";
import { classList } from "react-common/components/util";

interface IProps {
    className?: string;
    split: "horizontal" | "vertical";
    defaultSize: number | string; // The size to reset to when double clicking the splitter.
    startingSize?: number | string; // The size to use initially when creating the splitter. Defaults to `defaultSize`.
    primary: "left" | "right";
    left: React.ReactNode;
    right: React.ReactNode;
    leftMinSize: number | string;
    rightMinSize: number | string;
    onResizeEnd?: (size: number | string) => void;
}

export const SplitPane: React.FC<IProps> = ({
    className,
    split,
    defaultSize,
    startingSize,
    left,
    right,
    leftMinSize,
    rightMinSize,
    onResizeEnd,
}) => {
    const [size, setSize] = React.useState(startingSize || defaultSize);
    const [isResizing, setIsResizing] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!isResizing) {
            onResizeEnd?.(size);
        }
    }, [isResizing]);

    function handleResizeMouse(event: MouseEvent) {
        handleResize(event.clientX, event.clientY);
    }

    function handleResizeTouch(event: TouchEvent) {
        if (event.touches.length >= 1) {
            handleResize(event.touches[0].clientX, event.touches[0].clientY);
        }
    }

    function handleResize(clientX: number, clientY: number) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
            setIsResizing(true); // Do this here rather than inside startResizing to prevent interference with double click detection.
            const newSize =
                split === "vertical"
                    ? `${((clientX - containerRect.left) / containerRect.width) * 100}%`
                    : `${((clientY - containerRect.top) / containerRect.height) * 100}%`;
            setSize(newSize);
        }
    }

    function startResizing(event: React.MouseEvent | React.TouchEvent) {
        event.preventDefault();
        document.addEventListener("mousemove", handleResizeMouse);
        document.addEventListener("mouseup", endResizing);
        document.addEventListener("touchmove", handleResizeTouch);
        document.addEventListener("touchend", endResizing);
    }

    function endResizing() {
        document.removeEventListener("mousemove", handleResizeMouse);
        document.removeEventListener("mouseup", endResizing);
        document.removeEventListener("touchmove", handleResizeTouch);
        document.removeEventListener("touchend", endResizing);

        setIsResizing(false);
    }

    function setToDefaultSize() {
        setSize(defaultSize);
        onResizeEnd?.(defaultSize);
    }

    const leftStyle: React.CSSProperties = { flexBasis: size };
    if (split === "vertical") {
        leftStyle.minWidth = leftMinSize;

        // Setting right's minWidth doesn't work because left is still allowed
        // to expand beyond it. Instead, set left's maxWidth.
        leftStyle.maxWidth = `calc(100% - ${rightMinSize})`;
    } else {
        leftStyle.minHeight = leftMinSize;
        leftStyle.maxHeight = `calc(100% - ${rightMinSize})`;
    }

    return (
        <div ref={containerRef} className={classList(css["split-pane"], css[`split-${split}`], className)}>
            <div className={css[`left`]} style={leftStyle}>
                {left}
            </div>
            <div
                className={css[`splitter`]}
                onMouseDown={startResizing}
                onTouchStart={startResizing}
                onDoubleClick={setToDefaultSize}
            >
                <div className={css[`splitter-inner`]} />
            </div>
            <div className={css[`right`]}>{right}</div>

            {/*
                This overlay is necessary to prevent any other parts of the page (particularly iframes)
                from intercepting the mouse events while resizing. We simply add a transparent div over the
                left and right sections.
            */}
            <div className={classList(css["resizing-overlay"], isResizing ? undefined : "hidden")} />
        </div>
    );
};
