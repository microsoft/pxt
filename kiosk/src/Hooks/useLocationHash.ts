import { useState, useCallback, useEffect } from "react";

export function useLocationHash(): [string, (newHash: string) => void] {
    const [hash, setHash] = useState(() => window.location.hash);

    const hashChangeHandler = useCallback(() => {
        setHash(window.location.hash);
    }, []);

    useEffect(() => {
        window.addEventListener("hashchange", hashChangeHandler);
        return () => {
            window.removeEventListener("hashchange", hashChangeHandler);
        };
    }, []);

    const updateHash = useCallback(
        (newHash: string) => {
            if (newHash !== hash) window.location.hash = newHash;
        },
        [hash]
    );

    return [hash, updateHash];
}
