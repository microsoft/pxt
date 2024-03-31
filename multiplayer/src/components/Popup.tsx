import { useRef, useCallback, RefObject } from "react";
import { useClickedOutside } from "../hooks";

export default function Render(
    props: React.PropsWithChildren<{
        className?: string;
        visible: boolean;
        ignoreRefs?: RefObject<Element | null>[];
        onClickedOutside: () => any;
    }>
) {
    const { children, visible, className, ignoreRefs, onClickedOutside } = props;

    const ref = useRef<Element | null>(null);
    const setRef = useCallback((el: Element | null) => {
        ref.current = el;
    }, []);

    useClickedOutside([ref, ...(ignoreRefs || [])], () => onClickedOutside());

    return visible ? (
        <div ref={setRef} className={className}>
            {children}
        </div>
    ) : null;
}
