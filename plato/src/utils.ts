import { NameAdjectives, NameNouns } from "@/constants";

export function isLocalhost(): boolean {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function isNgrok(): boolean {
    return window.location.hostname.includes(".ngrok.");
}

export async function delayAsync(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function debounce<F extends (...args: Parameters<F>) => ReturnType<F>>(func: F, delayMs: number) {
    let timeout: NodeJS.Timeout;

    const debounced = (...args: Parameters<F>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delayMs);
    };

    return debounced;
}

const TYPE_KEY = "__@type" as const;

type SerializedValue =
    | { [TYPE_KEY]: "Map"; value: [any, any][] }
    | { [TYPE_KEY]: "Set"; value: any[] }
    | { [TYPE_KEY]: "Date"; value: string };
//| { [TYPE_KEY]: "RegExp"; value: string }

export function jsonReplacer(_key: string, value: any): any {
    if (value instanceof Map) {
        return {
            [TYPE_KEY]: "Map",
            value: Array.from(value.entries()).map(([k, v]) => [k, jsonReplacer("", v)] as [any, any]),
        } satisfies SerializedValue;
    }
    if (value instanceof Set) {
        return {
            [TYPE_KEY]: "Set",
            value: Array.from(value.values()).map(v => jsonReplacer("", v)),
        } satisfies SerializedValue;
    }
    if (value instanceof Date) {
        return {
            [TYPE_KEY]: "Date",
            value: value.toISOString(),
        } satisfies SerializedValue;
    }
    /*
    if (value instanceof RegExp) {
        return {
            [TYPE_KEY]: "RegExp",
            value: value.toString(),
        } satisfies SerializedValue;
    }
    */
    return value;
}

export function jsonReviver(_key: string, value: any): any {
    if (typeof value === "object" && value !== null && TYPE_KEY in value) {
        const type = value[TYPE_KEY];
        switch (type) {
            case "Map":
                if (Array.isArray(value.value)) {
                    return new Map(value.value.map(([k, v]: [any, any]) => [k, jsonReviver("", v)]));
                }
                break;
            case "Set":
                if (Array.isArray(value.value)) {
                    return new Set(value.value.map((v: any) => jsonReviver("", v)));
                }
                break;
            case "Date":
                return new Date(value.value);
            /*
            case "RegExp":
                const match = /^\/(.*)\/([gimsuy]*)$/.exec(value.value);
                if (match) {
                    return new RegExp(match[1], match[2]);
                }
                break;
            */
        }
    }
    return value;
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

export function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomName(): string {
    const adjective = randomElement(NameAdjectives);
    const noun = randomElement(NameNouns);
    return lf("{id:adjective,noun}{0} {1}", adjective, noun);
}

export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
