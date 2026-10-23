// Minimal declarations for host-agnostic globals (available in browsers, workers and Node)
// that pxtsimcore may use. Anything DOM-specific must NOT be declared here.
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any;
declare function clearTimeout(handle?: any): void;
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any;
declare function clearInterval(handle?: any): void;
// Present in browsers and workers only; check typeof before calling.
declare const requestAnimationFrame: ((callback: () => void) => any) | undefined;
declare const cancelAnimationFrame: ((handle: any) => void) | undefined;

declare const console: {
    log(...data: any[]): void;
    debug(...data: any[]): void;
    info(...data: any[]): void;
    warn(...data: any[]): void;
    error(...data: any[]): void;
};

declare const performance: { now(): number };

declare class TextEncoder {
    encode(input?: string): Uint8Array;
}

declare class TextDecoder {
    constructor(label?: string);
    decode(input?: ArrayBuffer | ArrayBufferView): string;
}

interface ImageData {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;
}

declare class URLSearchParams {
    constructor(init?: string);
    get(name: string): string | null;
    set(name: string, value: string): void;
}

declare class URL {
    constructor(url: string, base?: string | URL);
    readonly origin: string;
    readonly searchParams: URLSearchParams;
    toString(): string;
}
