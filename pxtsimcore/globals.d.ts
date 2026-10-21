// Minimal declarations for host-agnostic globals (available in browsers, workers and Node)
// that pxtsimcore may use. Anything DOM-specific must NOT be declared here.
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any;
declare function clearTimeout(handle?: any): void;
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any;
declare function clearInterval(handle?: any): void;

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
