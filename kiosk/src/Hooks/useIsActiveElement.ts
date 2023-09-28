import { useEffect, useState } from "react";
import * as NavGrid from "../Services/NavGrid";

export function useIsActiveElement(
    ref: HTMLElement | null | undefined
): boolean {
    const [isActive, setIsActive] = useState(false);
    useEffect(() => {
        setIsActive(NavGrid.isActiveElement(ref));
    }, [ref, setIsActive]);
    return isActive;
}
