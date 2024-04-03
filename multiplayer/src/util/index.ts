import zlib from "zlib";
import { Vec2Like } from "../types";

export function isLocal() {
    return window.location.hostname === "localhost";
}

export function toNumber(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    return parseFloat(v);
}

export function xorInPlace(a: Buffer, b: Buffer): Buffer {
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i++) {
        a[i] ^= b[i];
    }
    return a;
}

export function gzipAsync(data: zlib.InputType): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        zlib.gzip(data, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

export function gunzipAsync(data: zlib.InputType): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        zlib.gunzip(data, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

export function cleanupJoinCode(joinCode: string | undefined): string | undefined {
    try {
        const url = new URL(joinCode || "");
        if (url.searchParams.has("join")) {
            joinCode = url.searchParams.get("join") ?? undefined;
        }
    } catch {}
    if (!joinCode) return undefined;
    joinCode = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (joinCode.length !== 6) return undefined;
    return joinCode;
}

export function cleanupShareCode(shareCode: string | undefined): string | undefined {
    try {
        const url = new URL(shareCode || "");
        if (url.searchParams.has("host")) {
            shareCode = url.searchParams.get("host") ?? undefined;
        }
    } catch {}
    if (!shareCode) return undefined;
    return pxt.Cloud.parseScriptId(shareCode);
}

export function resourceUrl(path: string | undefined): string | undefined {
    if (!path) return;
    if (pxt.BrowserUtils.isLocalHostDev() && !(path.startsWith("https:") || path.startsWith("data:"))) {
        return pxt.appTarget?.appTheme.homeUrl + path;
    }
    return path;
}

export function throttle<F extends (...args: Parameters<F>) => ReturnType<F>>(func: F, waitFor: number): F {
    let timeout: NodeJS.Timeout | undefined;
    let previousTime = 0;
    return function (this: ThisParameterType<F>, ...args: Parameters<F>) {
        const context = this;
        const currentTime = Date.now();
        const timeSinceLastCall = currentTime - previousTime;
        const timeRemaining = waitFor - timeSinceLastCall;
        if (timeRemaining <= 0) {
            previousTime = currentTime;
            func.apply(context, args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                previousTime = Date.now();
                timeout = undefined;
                func.apply(context, args);
            }, timeRemaining);
        }
    } as F;
}

export function flattenVerts(verts: Vec2Like[]): number[] {
    const flatVerts: number[] = [];
    for (const v of verts) {
        flatVerts.push(v.x, v.y);
    }
    return flatVerts;
}

export function jsonReplacer(key: any, value: any) {
    if (value instanceof Map) {
        return {
            [".dataType"]: "Map",
            value: Array.from(value.entries()),
        };
    } else {
        return value;
    }
}

export function jsonReviver(key: any, value: any) {
    if (typeof value === "object" && value !== null) {
        if (value[".dataType"] === "Map") {
            return new Map(value.value);
        }
    }
    return value;
}

export function distSq(a: Vec2Like, b: Vec2Like) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

export function dist(a: Vec2Like, b: Vec2Like) {
    return Math.sqrt(distSq(a, b));
}
