import Fuse = require("fuse.js");

interface SearchEntry {
    id: string;
    name: string;
    blocks: string[];
    extensions: string[];
}

function record(value: unknown): value is pxt.Map<unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function addText(text: Set<string>, value: unknown): void {
    if (typeof value !== "string" && typeof value !== "number") return;
    const raw = String(value).trim();
    if (!raw) return;
    text.add(raw);
    text.add(raw.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/[_.:/#-]+/g, " "));
}

/** Read text only: never instantiate blocks, invoke mutation hooks, or index asset binary data. */
function blockText(item: pxt.auth.BackpackItem): string[] {
    const text = new Set<string>();
    addText(text, item.blockText);
    let payload: unknown;
    try { payload = JSON.parse(item.code); }
    catch { return Array.from(text); }
    if (!record(payload) || !Array.isArray(payload.blocks)) return Array.from(text);

    const ignored = new Set(["id", "functionid", "data", "jres", "bitmap", "pixels", "__proto__", "constructor", "prototype"]);
    const fields = (value: unknown): void => {
        const pending = [value];
        while (pending.length) {
            const next = pending.pop();
            if (next && typeof next === "object") {
                for (const key of Object.keys(next)) {
                    if (!ignored.has(key)) pending.push((next as pxt.Map<unknown>)[key]);
                }
            } else addText(text, next);
        }
    };
    const states: unknown[] = payload.blocks.slice();
    const connection = (value: unknown): void => {
        if (!record(value)) return;
        if (value.block) states.push(value.block);
        if (value.shadow) states.push(value.shadow);
    };
    while (states.length) {
        const state = states.pop();
        if (!record(state)) continue;
        addText(text, state.type);
        fields(state.fields);
        fields(state.extraState);
        if (record(state.inputs)) Object.values(state.inputs).forEach(connection);
        connection(state.next);
    }
    return Array.from(text);
}

/** Build once per collection update; every query is a local, fuzzy filter in the original item order. */
export function createBackpackSearch(items: pxt.auth.BackpackItem[], extensionName?: (name: string) => string): (query: string) => pxt.auth.BackpackItem[] {
    const entries: SearchEntry[] = items.map(item => {
        const extensions = new Set<string>();
        for (const [name, version] of Object.entries(item.dependencies)) {
            addText(extensions, name);
            addText(extensions, version);
            addText(extensions, extensionName?.(name));
        }
        return { id: item.id, name: item.name, blocks: blockText(item), extensions: Array.from(extensions) };
    });
    const fuse = new Fuse(entries, {
        keys: ["name", "blocks", "extensions"],
        threshold: 0.3,
        // Fuse 3 has no ignoreLocation option. Text near the end of a snippet matters equally.
        distance: Number.MAX_SAFE_INTEGER,
        shouldSort: false,
        minMatchCharLength: 1,
    });
    return query => {
        const terms = Array.from(new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean)));
        if (!terms.length) return items;
        let matches: Set<string>;
        // Terms can match different fields (e.g. a snippet name plus its extension).
        for (const term of terms) {
            const ids = new Set(fuse.search<SearchEntry>(term).map(entry => entry.id));
            matches = matches ? new Set(Array.from(matches).filter(id => ids.has(id))) : ids;
            if (!matches.size) return [];
        }
        return items.filter(item => matches.has(item.id));
    };
}