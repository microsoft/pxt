import * as React from "react";

import { Button } from "../../sui";

interface TutorialCalloutProps extends React.PropsWithChildren<{}> {
    className?: string;
    buttonIcon?: string;
    buttonLabel?: string;

    onClick?: (visible: boolean) => void;
}

interface HorizontalPosition {
    left?: string;
    width?: string;
}

export function TutorialCallout(props: TutorialCalloutProps) {
    const { children, className, buttonIcon, buttonLabel, onClick } = props;
    const [ visible, setVisible ] = React.useState(false);
    const [ maxHeight, setMaxHeight ] = React.useState("unset");
    const [ top, setTop ] = React.useState("unset");
    const [ bottom, setBottom ] = React.useState("unset");
    const [ horizontalPosition, setHorizontalPosition ] = React.useState<HorizontalPosition>({});
    const popupRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useLayoutEffect(() => {
        if (!visible) return undefined;

        function updatePosition() {
            const lowerBuffer = (document.getElementById("editortools")?.clientHeight ?? 0) + 30;
            const upperBuffer = 16;
            const trigger = popupRef.current?.querySelector<HTMLElement>(".tutorial-callout-button");
            const content = contentRef.current;

            if (!trigger || !content) return;

            const triggerBottom = trigger.getBoundingClientRect().bottom;
            const contentStyle = getComputedStyle(content);
            const transform = contentStyle.transform;
            const verticalOffset = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
            const borderHeight = parseFloat(contentStyle.borderTopWidth) + parseFloat(contentStyle.borderBottomWidth);
            const verticalChrome = parseFloat(contentStyle.paddingTop) + parseFloat(contentStyle.paddingBottom) + borderHeight;
            const popupHeight = content.scrollHeight + borderHeight;
            const availableBottom = window.innerHeight - lowerBuffer;
            const availableHeight = Math.max(availableBottom - upperBuffer, 0);
            const inlineLeft = content.style.left;
            const inlineRight = content.style.right;
            const inlineWidth = content.style.width;
            content.style.left = "";
            content.style.right = "";
            content.style.width = "";
            const contentRect = content.getBoundingClientRect();
            content.style.left = inlineLeft;
            content.style.right = inlineRight;
            content.style.width = inlineWidth;
            const clampedLeft = Math.min(
                Math.max(contentRect.left, upperBuffer),
                Math.max(window.innerWidth - upperBuffer - contentRect.width, upperBuffer)
            );
            const isHorizontallyClamped = Math.abs(clampedLeft - contentRect.left) > 0.5;
            const nextHorizontalPosition = isHorizontallyClamped
                ? { left: `${clampedLeft}px`, width: `${contentRect.width}px` }
                : {};
            setHorizontalPosition(current =>
                current.left === nextHorizontalPosition.left && current.width === nextHorizontalPosition.width
                    ? current
                    : nextHorizontalPosition
            );

            if (triggerBottom + verticalOffset + popupHeight > availableBottom) {
                setTop("unset");
                setBottom(`${lowerBuffer + verticalOffset}px`);
                setMaxHeight(popupHeight > availableHeight
                    ? `${contentStyle.boxSizing === "border-box" ? availableHeight : Math.max(availableHeight - verticalChrome, 0)}px`
                    : "unset");
            } else {
                setBottom("unset");
                setTop(`${triggerBottom}px`);
                setMaxHeight("unset");
            }
        }

        let animationFrame: number;
        const observer = new ResizeObserver(() => {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(updatePosition);
        });

        observer.observe(document.body);
        if (contentRef.current) observer.observe(contentRef.current);

        updatePosition();

        const closeOnOutsideClick = (e: PointerEvent) => {
            if (!popupRef?.current?.contains(e.target as Node)) {
                setVisible(false);
            }
        };

        const outsideClickTimeout = window.setTimeout(() => {
            document.addEventListener("click", closeOnOutsideClick);
        }, 0);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.clearTimeout(outsideClickTimeout);
            observer.disconnect();
            document.removeEventListener("click", closeOnOutsideClick);
        }
    }, [visible]);


    const captureEvent = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation();
    }

    const closeCallout = React.useCallback(() => {
        setVisible(false);
    }, []);

    const toggleCallout = React.useCallback((e: React.MouseEvent) => {
        captureEvent(e);
        setVisible(!visible);
    }, [visible]);

    const handleButtonClick = React.useCallback((e: React.MouseEvent) => {
        if (onClick) onClick(visible);
        toggleCallout(e);
    }, [onClick, visible]);

    const buttonTitle = lf("Click to show a hint!");
    return <div ref={popupRef} className={className}>
        <Button icon={buttonIcon}
            text={buttonLabel}
            className="tutorial-callout-button"
            title={buttonTitle}
            ariaLabel={buttonTitle}
            disabled={!children}
            onClick={children ? handleButtonClick : undefined} />
        {visible && <div ref={contentRef} className={`tutorial-callout no-select`} onClick={captureEvent} style={{top: top, right: horizontalPosition.left === undefined ? undefined : "auto", bottom: bottom, left: horizontalPosition.left, width: horizontalPosition.width, maxHeight: maxHeight, overflowY: maxHeight === "unset" ? "visible" : "auto"}}>
            <Button icon="close" className="tutorial-callout-close" onClick={closeCallout} />
            {children}
        </div>}
        {visible && <div className="tutorial-callout-mask" onClick={closeCallout} />}
    </div>

}
