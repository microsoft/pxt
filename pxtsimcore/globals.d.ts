// Declarations for the globals pxtsimcore may use. Core compiles without the DOM library, so these
// are declared by hand. Globals that only some hosts have may be undefined at run time. ImageData
// is the shape core reads from board view screenshots.
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any;
declare function clearTimeout(handle?: any): void;
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any;
declare function clearInterval(handle?: any): void;
// Present in browsers and workers only. Check typeof before calling.
declare const requestAnimationFrame: ((callback: () => void) => any) | undefined;
declare const cancelAnimationFrame: ((handle: any) => void) | undefined;
// Present in Node only. Check typeof before calling.
declare const setImmediate: ((callback: () => void) => any) | undefined;
// Present in browsers, workers and Node. Check typeof before calling.
declare const MessageChannel: (new () => {
    port1: { onmessage: ((event: any) => void) | null; close(): void };
    port2: { postMessage(message: any): void };
}) | undefined;

declare const console: {
    log(...data: any[]): void;
    debug(...data: any[]): void;
    info(...data: any[]): void;
    warn(...data: any[]): void;
    error(...data: any[]): void;
};

declare const performance: { now(): number };

// Present in browsers, workers and Node.
declare function btoa(data: string): string;
declare function atob(data: string): string;

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
