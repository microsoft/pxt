import { useRef, useCallback, useState } from "react";
import { useClickedOutside } from "../hooks";

export default function Render(
    props: React.PropsWithChildren<{
        className?: string;
        visible: boolean;
        onClickedOutside: () => any;
    }>
) {
    const { children, visible, className, onClickedOutside } = props;

    const ref = useRef<Element | null>();
    const setRef = useCallback((el: Element | null) => {
        ref.current = el;
    }, []);

    useClickedOutside(ref, () => onClickedOutside());

    return visible ? (
        <div ref={setRef} className={className}>
            {children}
        </div>
    ) : null;
}
