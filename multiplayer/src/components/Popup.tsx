import { useRef, useCallback, RefObject } from "react";
import { useClickedOutside } from "../hooks";

export default function Render(
    props: React.PropsWithChildren<{
        className?: string;
        visible: boolean;
        onClickedOutside: () => any;
        triggerElementRef?: RefObject<Element | undefined>;
    }>
) {
    const { children, visible, className, onClickedOutside } = props;

    const ref = useRef<Element | null>();
    const setRef = useCallback((el: Element | null) => {
        ref.current = el;
    }, []);

    useClickedOutside(ref, props.triggerElementRef, () => onClickedOutside());

    return visible ? (
        <div ref={setRef} className={className}>
            {children}
        </div>
    ) : null;
}
