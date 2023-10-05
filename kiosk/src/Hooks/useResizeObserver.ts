import { useCallback, useRef, useEffect } from "react";

const config: ResizeObserverOptions = {
    box: "content-box",
};

export function useResizeObserver(
    ref: HTMLElement | null,
    callback: ResizeObserverCallback | undefined,
    options: ResizeObserverOptions = config
) {
    const { box } = options;
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    });

    const handleResizeObserver = useCallback<ResizeObserverCallback>(
        (...args) => callbackRef.current?.(...args),
        []
    );

    useEffect(() => {
        if (ref) {
            // Create an observer instance linked to the callback function
            const observer = new ResizeObserver(handleResizeObserver);

            // Start observing the target node for resizes
            observer.observe(ref, { box });
            return () => observer.disconnect();
        }
    }, [ref, handleResizeObserver, box]);

    return [ref];
}
