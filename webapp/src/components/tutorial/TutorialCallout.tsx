import * as React from "react";

import { Button } from "../../sui";

interface TutorialCalloutProps extends React.PropsWithChildren<{}> {
    className?: string;
    buttonIcon?: string;
    buttonLabel?: string;

    onClick?: (visible: boolean) => void;
}

export function TutorialCallout(props: TutorialCalloutProps) {
    const { children, className, buttonIcon, buttonLabel, onClick } = props;
    const [ visible, setVisible ] = React.useState(false);
    const [ maxHeight, setMaxHeight ] = React.useState("unset");
    const [ top, setTop ] = React.useState("unset");
    const [ bottom, setBottom ] = React.useState("unset");
    const popupRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!visible) return undefined;

        function checkSize() {
            const lowerBuffer = (document.getElementById("editortools")?.clientHeight ?? 0) + 30;
            if (contentRef.current?.getBoundingClientRect().bottom >= window.innerHeight - lowerBuffer) {
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

        const closeOnOutsideClick = (e: PointerEvent) => {
            if (!popupRef?.current?.contains(e.target as Node)) {
                setVisible(false);
            }
        };

        document.addEventListener("click", closeOnOutsideClick);

        return () => {
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
        {visible && <div ref={contentRef} className={`tutorial-callout no-select`} onClick={captureEvent} style={{top: top, bottom: bottom, maxHeight: maxHeight}}>
            <Button icon="close" className="tutorial-callout-close" onClick={closeCallout} />
            {children}
        </div>}
        {visible && <div className="tutorial-callout-mask" onClick={closeCallout} />}
    </div>

}