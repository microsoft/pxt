import { useEffect, RefObject } from "react";

export function useClickedOutside(
    ref: RefObject<Element | undefined>,
    triggerRef: RefObject<Element | undefined> | undefined,
    cb: (ev?: Event) => any
) {
    useEffect(() => {
        const handleMouseDown = (ev: Event) => {
            const el = ref?.current;
            const tr = triggerRef?.current;
            if ((el && !el.contains(ev.target as Node)) && (!triggerRef || !tr?.contains(ev.target as Node))) {
                cb?.(ev);
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [ref]);
}
