import * as React from "react";
import { useLayoutEffect, useCallback } from "react";

export function useElementBounds(elem: Element | undefined) {
    const [bounds, setBounds] = React.useState<DOMRect | null>(null);

    const handleResize = useCallback(() => {
        if (elem) {
            setBounds(elem.getBoundingClientRect());
        }
    }, [elem]);

    useLayoutEffect(() => {
        if (!elem) return;

        handleResize();

        const observer = new ResizeObserver(() => handleResize());
        observer.observe(elem);

        return () => {
            observer.disconnect();
        };
    }, [elem, handleResize]);

    return bounds;
}
