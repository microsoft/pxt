import { useEffect } from "react";
import * as NavGrid from "../Services/NavGrid";
import * as RectCache from "../Services/RectCache";

export function useMakeNavigable(
    ref: HTMLElement | null | undefined,
    opts?: {
        exitDirections?: NavGrid.NavDirection[];
        autofocus?: boolean;
        tabIndex?: number;
    }
) {
    if (opts?.tabIndex === -1) {
        return;
    }

    // Register this element with the NavGrid
    useEffect(() => {
        const unregister = NavGrid.registerNavigable(ref, opts);
        return () => unregister();
    }, [ref]);

    // Invalidate the rect cache when the element is unmounted
    useEffect(() => () => RectCache.invalidateCacheForElement(ref), [ref]);
}
