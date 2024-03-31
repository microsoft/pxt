import { useEffect, RefObject } from "react";

export function useClickedOutside(refs: RefObject<Element | null>[], cb: (ev?: Event) => any) {
    useEffect(() => {
        const handleMouseDown = (ev: Event) => {
            for (const ref of refs) {
                const el = ref?.current;
                if (el && el.contains(ev.target as Node)) return;
            }
            cb?.(ev);
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [...refs]);
}
