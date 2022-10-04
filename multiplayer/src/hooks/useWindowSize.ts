import { useState, useEffect } from "react";
import { Dimension } from "../types";

export function useWindowSize(): Dimension {
    const [windowSize, setWindowSize] = useState<Dimension>({
        width: 0,
        height: 0,
    });

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [setWindowSize]);

    return windowSize;
}
