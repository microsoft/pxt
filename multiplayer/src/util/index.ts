import zlib from "zlib";

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

export function cleanupJoinCode(
    joinCode: string | undefined
): string | undefined {
    if (!joinCode) return undefined;
    joinCode = joinCode.trim();
    if (joinCode.length !== 6) return undefined;
    joinCode = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (joinCode.length !== 6) return undefined;
    return joinCode;
}
