export function isLocal() {
    return window.location.hostname === "localhost"
}

export function toNumber(v: any): number | undefined {
    if (v == null) return undefined
    if (typeof v === "number") return v
    return parseFloat(v)
}
