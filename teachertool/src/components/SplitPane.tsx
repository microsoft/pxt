import * as React from "react";
import css from "./styling/SplitPane.module.scss";
import { classList } from "react-common/components/util";

interface IProps {
    className?: string;
    split: "horizontal" | "vertical";
    defaultSize: number | string;
    primary: "left" | "right";
    left: React.ReactNode;
    right: React.ReactNode;
}

export const SplitPane: React.FC<IProps> = ({ className, split, defaultSize, left, right }) => {
    const [size, setSize] = React.useState(defaultSize);
    const leftRef = React.useRef<HTMLDivElement>(null);

    function handleResizeMouse(event: MouseEvent) {
        handleResize(event.clientX, event.clientY);
    }

    function handleResizeTouch(event: TouchEvent) {
        if (event.touches.length >= 1) {
            handleResize(event.touches[0].clientX, event.touches[0].clientY);
        }
    }

    function handleResize(clientX: number, clientY: number) {
        const paneRect = leftRef.current?.getBoundingClientRect();
        if (paneRect) {
            const newSize = split === "vertical" ? clientX - paneRect.left : clientY - paneRect.top;
            setSize(newSize);
        }
    }

    function addResizeListeners(event: React.MouseEvent | React.TouchEvent) {
        event.preventDefault();
        document.addEventListener("mousemove", handleResizeMouse);
        document.addEventListener("mouseup", removeResizeListeners);
        document.addEventListener("touchmove", handleResizeTouch);
        document.addEventListener("touchend", removeResizeListeners);
    }

    function removeResizeListeners() {
        document.removeEventListener("mousemove", handleResizeMouse);
        document.removeEventListener("mouseup", removeResizeListeners);
        document.removeEventListener("touchmove", handleResizeTouch);
        document.removeEventListener("touchend", removeResizeListeners);
    }

    return (
        <div className={classList(css[`split-pane-${split}`], className)}>
            <div ref={leftRef} className={css[`left-${split}`]} style={{ flexBasis: size }}>
                {left}
            </div>
            <div
                className={css[`splitter-${split}`]}
                onMouseDown={addResizeListeners}
                onTouchStart={addResizeListeners}
            >
                <div className={css[`splitter-${split}-inner`]} />
            </div>
            <div className={css[`right-${split}`]}>{right}</div>
        </div>
    );
};
