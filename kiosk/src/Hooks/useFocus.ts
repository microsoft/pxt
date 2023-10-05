import { useEffect } from "react";

export function useFocus(
    ref: HTMLElement | null | undefined,
    onFocus: () => void,
    onBlur: () => void,
    deps: any[] = []
) {
    useEffect(() => {
        if (ref) {
            const handleFocus = () => onFocus();
            const handleBlur = () => onBlur();
            ref.addEventListener("focus", handleFocus);
            ref.addEventListener("blur", handleBlur);
            return () => {
                ref.removeEventListener("focus", handleFocus);
                ref.removeEventListener("blur", handleBlur);
            };
        }
    }, [ref, onFocus, onBlur, ...deps]);
}
