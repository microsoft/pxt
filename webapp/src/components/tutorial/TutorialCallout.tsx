import * as React from "react";

import { Button } from "../../sui";

interface TutorialCalloutProps extends React.PropsWithChildren<{}> {
    className?: string;
    buttonIcon?: string;
    buttonLabel?: string;

    onClick?: (visible: boolean) => void;
}

export function TutorialCallout(props: TutorialCalloutProps) {
    const { children, className, buttonIcon, buttonLabel } = props;
    const [ visible, setVisible ] = React.useState(false);
    const [ maxHeight, setMaxHeight ] = React.useState("unset");
    const [ top, setTop ] = React.useState("unset");
    const [ bottom, setBottom ] = React.useState("unset");
    const popupRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        function checkSize() {
            const lowerBuffer = document.getElementById("editortools")?.clientHeight || 0 + 30;
            if (contentRef.current?.getBoundingClientRect().bottom > window.innerHeight - lowerBuffer) {
                setTop("unset");
                setBottom(`${lowerBuffer}px`);
                setMaxHeight("90vh");
            } else {
                setBottom("unset");
            }
        }

        const observer = new ResizeObserver(() => {
            window.requestAnimationFrame(checkSize);
        });

        observer.observe(document.body);
        if (contentRef.current) observer.observe(contentRef.current);

        checkSize();
        return () => observer.disconnect();
    });

    const captureEvent = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation();
    }

    const closeCallout = (e: any) => {
        document.removeEventListener("click", closeCalloutIfClickedOutside, true);
        setVisible(false);
    }

    const closeCalloutIfClickedOutside = (e: PointerEvent) => {
        if (!popupRef?.current?.contains(e.target as Node)) {
            closeCallout(e);
        }
    }

    const toggleCallout = (e: any) => {
        captureEvent(e);
        if (!visible) {
            document.addEventListener("click", closeCalloutIfClickedOutside, true);
        } else {
            document.removeEventListener("click", closeCalloutIfClickedOutside, true);
        }
        setVisible(!visible);
    }

    const handleButtonClick = (e: any) => {
        const { onClick } = props;
        if (onClick) onClick(visible);
        toggleCallout(e);
    }

    const buttonTitle = lf("Click to show a hint!");
    return <div ref={popupRef} className={className}>
        <Button icon={buttonIcon}
            text={buttonLabel}
            className="tutorial-callout-button"
            title={buttonTitle}
            ariaLabel={buttonTitle}
            disabled={!children}
            onClick={children ? handleButtonClick : undefined} />
        {visible && <div ref={contentRef} className={`tutorial-callout no-select`} onClick={captureEvent} style={{top: top, bottom: bottom, maxHeight: maxHeight}}>
            <Button icon="close" className="tutorial-callout-close" onClick={closeCallout} />
            {children}
        </div>}
        {visible && <div className="tutorial-callout-mask" onClick={closeCallout} />}
    </div>

}