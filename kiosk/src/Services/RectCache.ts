import { nanoid } from "nanoid";
import { NavRect } from "../Types";

type CachedRect = {
    rect: NavRect;
    expiresAt: number;
};

const rectCache = new Map<string, CachedRect>();

let cacheCheckIntervalId: number | undefined;
const cachedRectExpirationMs = 1000 * 60 * 5;
const cachedRectIdentifierKey = Symbol("cachedRectIdentifierKey");

let cacheHits = 0;
let cacheMisses = 0;

export function getCachedElementRect(el: HTMLElement): NavRect {
    let id = (el as any)[cachedRectIdentifierKey];
    if (id) {
        // Elemnt has a cache key, check if it's in the cache
        const cached = rectCache.get(id);
        if (cached && cached.expiresAt > Date.now()) {
            cacheHits++;
            return cached.rect;
        }
    }

    cacheMisses++;

    if (!id) {
        // Assign a unique key to the element so we can cache it
        id = nanoid();
        Object.defineProperty(el, cachedRectIdentifierKey, {
            value: id,
            writable: false,
        });
    }

    const domrect = el.getBoundingClientRect();
    const rect: CachedRect = {
        rect: {
            top: domrect.y,
            left: domrect.x,
            right: domrect.x + domrect.width,
            bottom: domrect.y + domrect.height,
            width: domrect.width,
            height: domrect.height,
            center: {
                x: domrect.x + domrect.width / 2,
                y: domrect.y + domrect.height / 2,
            },
        },
        expiresAt: Date.now() + cachedRectExpirationMs,
    };
    rectCache.set(id, rect);
    return rect.rect;
}

export function invalidateCacheForElement(el: HTMLElement | undefined | null) {
    if (el) {
        const id = (el as any)[cachedRectIdentifierKey];
        if (id) {
            rectCache.delete(id);
        }
    }
}

function checkCache() {
    const now = Date.now();
    for (const [id, cached] of rectCache) {
        if (cached.expiresAt < now) {
            rectCache.delete(id);
        }
    }
    //console.log( `rectCache: ${cacheHits} hits, ${cacheMisses} misses,
    //    ${rectCache.size} cached`
    //);
}

export function clearCache() {
    rectCache.clear();
}

let initializeOnce = () => {
    initializeOnce = () => {
        throw new Error("rectCache.initialize() called more than once.");
    };
    cacheCheckIntervalId = window.setInterval(checkCache, 1234);
};

export function initialize() {
    initializeOnce();
}
