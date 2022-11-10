import { useEffect, RefObject } from "react";

export function useClickedOutside(
    containerRefs: RefObject<Element | undefined>[],
    callback: (ev?: Event) => any
) {
    useEffect(() => {
        const handleMouseDown = (ev: Event) => {
            for (let ref of containerRefs) {
                const el = ref?.current;
                if (el && el.contains(ev.target as Node)) {
                    return;
                }
            }

            // Mouse position is outside all container elements.
            callback?.(ev);
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [containerRefs]);
}
