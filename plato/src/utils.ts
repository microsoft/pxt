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

export function jsonReplacer(_key: any, value: any) {
    if (value instanceof Map) {
        return {
            [".dataType"]: "Map",
            value: Array.from(value.entries()),
        };
    } else {
        return value;
    }
}

export function jsonReviver(_key: any, value: any) {
    if (typeof value === "object" && value !== null) {
        if (value[".dataType"] === "Map") {
            return new Map(value.value);
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
