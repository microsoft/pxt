import { useRef, useCallback, RefObject } from "react";
import { useClickedOutside } from "../hooks";

export default function Render(
    props: React.PropsWithChildren<{
        className?: string;
        visible: boolean;
        onClickedOutside: () => any;
        triggerElementRef?: RefObject<Element | undefined>; // Allows us to avoid closing the popup if a click happens inside the trigger element
    }>
) {
    const { children, visible, className, onClickedOutside } = props;

    const ref = useRef<Element | null>();
    const setRef = useCallback((el: Element | null) => {
        ref.current = el;
    }, []);

    useClickedOutside(
        props.triggerElementRef ? [ref, props.triggerElementRef] : [ref],
        () => onClickedOutside()
    );

    return visible ? (
        <div ref={setRef} className={className}>
            {children}
        </div>
    ) : null;
}
