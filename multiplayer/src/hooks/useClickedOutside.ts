import { useEffect, RefObject } from "react";

export function useClickedOutside(
    ref: RefObject<Element | undefined>,
    cb: (ev?: Event) => any
) {
    useEffect(() => {
        const handleMouseDown = (ev: Event) => {
            const el = ref?.current;
            if (el && !el.contains(ev.target as Node)) {
                cb?.(ev);
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [ref]);
}
