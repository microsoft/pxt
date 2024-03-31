import { useEffect, useState } from "react";

export function useVisibilityChange(cb: (visible: boolean) => any) {
    useEffect(() => {
        const onVisibilityChange = () => {
            cb(document.visibilityState === "visible");
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);
}
