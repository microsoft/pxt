export function tickEvent(id: string, data?: { [key: string]: string | number }) {
    (window as any).pxtTickEvent?.(id, data);
}

export function devicePixelRatio(): number {
    if (typeof window === "undefined" || !window.screen) return 1;

    // these are IE specific
    const sysXDPI = (window.screen as any).systemXDPI
    const logicalXDPI = (window.screen as any).logicalXDPI
    if (sysXDPI !== undefined
        && logicalXDPI !== undefined
        && sysXDPI > logicalXDPI) {
        return sysXDPI / logicalXDPI;
    }
    else if (window && window.devicePixelRatio !== undefined) {
        return window.devicePixelRatio;
    }
    return 1;
}

export function isLocal() {
    return window.location.hostname === "localhost";
}