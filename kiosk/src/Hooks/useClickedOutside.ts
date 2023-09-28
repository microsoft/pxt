import { MutableRefObject, useCallback, useEffect, useRef } from "react";

export function useClickedOutside(
    ref: MutableRefObject<HTMLElement | null>,
    handler: (event: Event) => void,
    when = true
): void {
    const savedHandler = useRef(handler);

    const memoizedCallback = useCallback(
        (event: MouseEvent | Event) => {
            if (ref.current && !ref.current.contains(event.target as Element)) {
                savedHandler.current(event);
            }
        },
        [ref]
    );

    useEffect(() => {
        savedHandler.current = handler;
    });

    useEffect(() => {
        if (when) {
            document.addEventListener("click", memoizedCallback, true);
            document.addEventListener("ontouchstart", memoizedCallback, true);

            return () => {
                document.removeEventListener("click", memoizedCallback, true);
                document.removeEventListener(
                    "ontouchstart",
                    memoizedCallback,
                    true
                );
            };
        }
    }, [ref, handler, when, memoizedCallback]);
}
