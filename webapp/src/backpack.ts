export const MAX_BACKPACK_ITEMS = 50;
export const MAX_BACKPACK_NAME_LENGTH = 100;
export const MAX_BACKPACK_CODE_LENGTH = 100000;
export const MAX_BACKPACK_DATA_LENGTH = 500000;
export const MAX_BACKPACK_PREVIEW_LENGTH = 64000;

interface LocalIdentity {
    kind: "local";
    targetId: string;
}

interface CloudIdentity {
    kind: "cloud";
    userId: string;
    targetId: string;
    client: pxt.auth.AuthClient;
}

type Identity = LocalIdentity | CloudIdentity;

interface CloudContext extends CloudIdentity {
    token: string;
}

type OperationContext = LocalIdentity | CloudContext;

export interface BackpackEntry {
    /** The collection key, not the potentially damaged ID inside the stored item. */
    id: string;
    source: "local" | "cloud";
    name: string;
    createdAt: number;
    item?: pxt.auth.BackpackItem;
    error?: string;
}

export interface BackpackState {
    entries: BackpackEntry[];
    warning?: string;
}

interface Snapshot {
    identity: Identity;
    entries: BackpackEntry[];
    warning?: string;
    error?: Error;
}

let snapshot: Snapshot;
let queue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const safeKey = (key: string): boolean => !["__proto__", "constructor", "prototype"].includes(key);

function hasControlCharacters(value: string): boolean {
    return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

function isRecord(value: unknown): value is pxt.Map<unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || Object.getPrototypeOf(proto) === null;
}

function validateId(id: unknown): asserts id is string {
    if (typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
        throw new Error(lf("Invalid backpack item ID."));
    }
}

function validateName(name: unknown): asserts name is string {
    if (typeof name !== "string" || !name.trim() || name.length > MAX_BACKPACK_NAME_LENGTH || hasControlCharacters(name)) {
        throw new Error(lf("Backpack names must contain 1 to 100 characters without control characters."));
    }
}

function portableDependency(name: string, version: string): boolean {
    if (version === "*") return !!pxt.appTarget?.bundledpkgs && own(pxt.appTarget.bundledpkgs, name);
    if (/^pub:[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$/.test(version)) return true;
    if (!/^github:[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*(?:#[A-Za-z0-9_.-]+)?$/.test(version)) return false;
    const parsed = pxt.github.parseRepoId(version);
    return !!parsed?.owner && !!parsed.project
        && version.slice(7).split(/[\/#]/).every(part => part !== "." && part !== ".." && safeKey(part));
}

/** Validates untrusted local/cloud/import data and returns a detached, bounded item. */
export function validateBackpackItem(value: unknown): pxt.auth.BackpackItem {
    if (!isRecord(value)) throw new Error(lf("Invalid backpack item."));
    validateId(value.id);
    validateName(value.name);
    if (typeof value.code !== "string" || value.code.length > MAX_BACKPACK_CODE_LENGTH) {
        throw new Error(lf("Backpack code must be text of at most {0} characters.", MAX_BACKPACK_CODE_LENGTH));
    }
    if (typeof value.blockText !== "string" || value.blockText.length > MAX_BACKPACK_CODE_LENGTH) {
        throw new Error(lf("Backpack block text must be text of at most {0} characters.", MAX_BACKPACK_CODE_LENGTH));
    }
    if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt) || value.createdAt < 0) {
        throw new Error(lf("Invalid backpack creation time."));
    }
    if (!isRecord(value.dependencies) || Object.keys(value.dependencies).length > 100) {
        throw new Error(lf("Invalid backpack dependencies (maximum 100 packages)."));
    }
    const dependencies: pxt.Map<string> = {};
    for (const name of Object.keys(value.dependencies)) {
        const version = value.dependencies[name];
        if (!safeKey(name) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(name)
            || typeof version !== "string" || version.length > 256 || !portableDependency(name, version)) {
            throw new Error(lf("Backpack dependencies must use bundled packages, GitHub repositories, or published IDs."));
        }
        dependencies[name] = version;
    }
    if (value.previewUri !== undefined && (typeof value.previewUri !== "string"
        || value.previewUri.length > MAX_BACKPACK_PREVIEW_LENGTH
        || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value.previewUri)
        || (value.previewUri.length - "data:image/png;base64,".length) % 4 !== 0)) {
        throw new Error(lf("Backpack previews must be PNG data URIs of at most {0} characters.", MAX_BACKPACK_PREVIEW_LENGTH));
    }
    if (value.previewPixelDensity !== undefined && (!value.previewUri
        || typeof value.previewPixelDensity !== "number" || ![1, 1.5, 2].includes(value.previewPixelDensity))) {
        throw new Error(lf("Invalid backpack preview pixel density."));
    }
    const result: pxt.auth.BackpackItem = {
        id: value.id, name: value.name, code: value.code, blockText: value.blockText, dependencies, createdAt: value.createdAt
    };
    if (value.projectBlocks !== undefined) {
        if (!isRecord(value.projectBlocks) || Object.keys(value.projectBlocks).length > 500) {
            throw new Error(lf("Invalid project-defined blocks in this backpack item."));
        }
        result.projectBlocks = {};
        for (const type of Object.keys(value.projectBlocks)) {
            const file = value.projectBlocks[type];
            if (!safeKey(type) || !type || type.length > 256 || hasControlCharacters(type)
                || typeof file !== "string" || !file || file.length > 256 || hasControlCharacters(file)) {
                throw new Error(lf("Invalid project-defined blocks in this backpack item."));
            }
            result.projectBlocks[type] = file;
        }
    }
    if (typeof value.previewUri === "string") result.previewUri = value.previewUri;
    if (typeof value.previewPixelDensity === "number") result.previewPixelDensity = value.previewPixelDensity;
    return result;
}

function activeIdentity(): Identity | undefined {
    const targetId = pxt.appTarget?.id;
    if (!targetId || !safeKey(targetId)) return undefined;
    if (!pxt.auth.cachedHasAuthToken) return { kind: "local", targetId };
    const client = pxt.auth.client();
    const userId = pxt.auth.cachedUserState?.profile?.id;
    // A partially loaded signed-in session must not write to the guest backpack.
    if (!client || !userId) return undefined;
    return { kind: "cloud", client, userId, targetId };
}

function isActive(identity: Identity): boolean {
    const active = activeIdentity();
    return !!active && active.kind === identity.kind && active.targetId === identity.targetId
        && (identity.kind === "local" || active.kind === "cloud"
            && active.client === identity.client && active.userId === identity.userId);
}

function assertActive(identity: Identity): void {
    if (!isActive(identity)) throw new Error(lf("Your account or editor changed. Please reopen the backpack."));
}

// Capture at invocation, not when the queued operation eventually starts.
async function captureAsync(): Promise<OperationContext> {
    const identity = activeIdentity();
    if (!identity) throw new Error(lf("Your backpack session is not ready. Please reopen the backpack."));
    if (identity.kind === "local") return identity;
    const token = await pxt.auth.getAuthTokenAsync();
    assertActive(identity);
    if (!token) throw new Error(lf("Sign in to use your backpack."));
    const context = { ...identity, token };
    await verifyAsync(context);
    return context;
}

async function verifyAsync(context: OperationContext): Promise<void> {
    assertActive(context);
    if (context.kind === "local") return;
    const state = await pxt.auth.getUserStateAsync();
    assertActive(context);
    if (state?.profile?.id !== context.userId) throw new Error(lf("Your backpack account changed."));
    const token = await pxt.auth.getAuthTokenAsync();
    assertActive(context);
    if (!token || token !== context.token) throw new Error(lf("Your backpack session changed. Please try again."));
}

function enqueue(action: (context: OperationContext) => Promise<void>): Promise<void> {
    // Attach rejection handlers to capture immediately, even while another write is pending.
    const operation = Promise.all([queue, captureAsync()]).then(async ([, context]) => {
        await verifyAsync(context);
        await action(context);
    });
    queue = operation.then(() => {}, () => {});
    return operation;
}

async function requestAsync(context: CloudContext, ops?: ts.pxtc.jsonPatch.PatchOperation[]): Promise<pxt.auth.UserPreferences> {
    await verifyAsync(context);
    let result: pxt.auth.ApiResult<pxt.auth.UserPreferences>;
    try {
        result = await context.client.apiAsync<pxt.auth.UserPreferences>(
            "/api/user/preferences", ops, ops ? "PATCH" : "GET", context.token);
    } catch {
        // Never propagate transport errors that could contain request bodies or credentials.
        await verifyAsync(context);
        throw new Error(lf("Could not sync your backpack. Please try again."));
    }
    await verifyAsync(context);
    if (!result.success || !isRecord(result.resp)) throw new Error(lf("Could not sync your backpack. Please try again."));
    return result.resp;
}

interface LocalBackpack {
    storage: Storage;
    items: pxt.Map<unknown>;
    serialized: pxt.Map<string>;
}

function localPrefix(targetId: string): string {
    return `${targetId}/backpack/guest/`;
}

function readLocalBackpack(targetId: string, optional = false): LocalBackpack | undefined {
    try {
        // Do not use shared storage: it routes through the dev server on localhost
        // and can silently fall back to memory when browser storage is unavailable.
        const storage = window.localStorage;
        const prefix = localPrefix(targetId);
        const items: pxt.Map<unknown> = Object.create(null);
        const serialized: pxt.Map<string> = Object.create(null);
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (!key?.startsWith(prefix)) continue;
            const value = storage.getItem(key);
            if (value === null) continue;
            const id = key.slice(prefix.length);
            serialized[id] = value;
            // Keep malformed entries visible to validation, never overwrite/drop them.
            try { items[id] = JSON.parse(value); }
            catch { items[id] = value; }
        }
        return { storage, items, serialized };
    } catch {
        // Cloud-only use remains available even when browser storage is blocked.
        if (optional) return undefined;
        throw new Error(lf("Could not read your local backpack. Allow browser storage and try again."));
    }
}

function localPreferences(targetId: string, local: LocalBackpack): pxt.auth.UserPreferences {
    return { backpack: { [targetId]: local.items as pxt.Map<pxt.auth.BackpackItem> } };
}

function writeLocalItem(context: OperationContext, id: string, item?: pxt.auth.BackpackItem): void {
    assertActive(context);
    const value = item === undefined ? null : JSON.stringify(item);
    try {
        const storage = window.localStorage;
        const key = localPrefix(context.targetId) + id;
        // One key per snippet avoids rewriting other tabs' additions or deletions.
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
        if (storage.getItem(key) !== value) throw new Error();
    } catch {
        throw new Error(lf("Could not save your local backpack. Check that browser storage is available and has enough space, then try again."));
    }
    assertActive(context);
}

function collection(preferences: pxt.auth.UserPreferences, targetId: string): pxt.Map<unknown> {
    const backpack: unknown = preferences.backpack;
    if (backpack === undefined) return {};
    if (!isRecord(backpack)) throw new Error(lf("The saved backpack collection is malformed."));
    if (!own(backpack, targetId)) return {};
    const target = backpack[targetId];
    if (!isRecord(target)) throw new Error(lf("The saved backpack target collection is malformed."));
    return target;
}

function checkCapacity(backpack: unknown, target: pxt.Map<unknown>): void {
    if (Object.keys(target).length > MAX_BACKPACK_ITEMS) throw new Error(lf("A backpack can hold at most {0} items per editor.", MAX_BACKPACK_ITEMS));
    if (JSON.stringify(backpack || {}).length > MAX_BACKPACK_DATA_LENGTH) throw new Error(lf("Your backpack exceeds the {0}-character storage limit.", MAX_BACKPACK_DATA_LENGTH));
}

/** Expose only validated content, or bounded display metadata for a deletable recovery card. */
export function readBackpackEntry(id: string, value: unknown, source: "local" | "cloud"): BackpackEntry {
    try {
        validateId(id);
        const item = validateBackpackItem(value);
        if (item.id !== id) throw new Error(lf("A saved backpack item has a mismatched ID."));
        return { id, source, name: item.name, createdAt: item.createdAt, item };
    } catch {
        // Never render the invalid preview/code or coerce arbitrary objects to strings.
        const name = isRecord(value) && typeof value.name === "string"
            ? Array.from(value.name.slice(0, MAX_BACKPACK_NAME_LENGTH))
                .map(character => hasControlCharacters(character) ? " " : character).join("").trim()
            : "";
        const createdAt = isRecord(value) && typeof value.createdAt === "number"
            && Number.isFinite(value.createdAt) && value.createdAt >= 0 ? value.createdAt : 0;
        return { id, source, name: name || lf("Unnamed snippet"), createdAt,
            error: lf("This snippet contains invalid or oversized data and can't be added. You can delete it from your backpack.") };
    }
}

function entriesFromCollection(target: pxt.Map<unknown>, source: "local" | "cloud"): BackpackEntry[] {
    return Object.keys(target).map(id => readBackpackEntry(id, target[id], source))
        .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

function sameItem(left: pxt.auth.BackpackItem, right: pxt.auth.BackpackItem): boolean {
    const sameMap = (a: pxt.Map<string> = {}, b: pxt.Map<string> = {}): boolean =>
        Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => own(b, key) && a[key] === b[key]);
    return left.id === right.id && left.name === right.name && left.code === right.code
        && left.createdAt === right.createdAt && left.previewUri === right.previewUri
        && left.previewPixelDensity === right.previewPixelDensity
        && left.blockText === right.blockText
        && sameMap(left.projectBlocks, right.projectBlocks) && sameMap(left.dependencies, right.dependencies);
}

/** Move guest snippets to the signed-in profile only after the server acknowledges them. */
async function syncLocalBackpackAsync(context: CloudContext, preferences: pxt.auth.UserPreferences,
    pendingItem?: pxt.auth.BackpackItem): Promise<pxt.auth.UserPreferences> {
    assertActive(context);
    const local = readLocalBackpack(context.targetId, true);
    if (!local || !Object.keys(local.items).length) return preferences;
    // Invalid local copies stay in this browser as recovery cards; never upload them.
    const items = entriesFromCollection(local.items, "local").filter(entry => !!entry.item).map(entry => entry.item);
    if (!items.length) return preferences;
    const target = collection(preferences, context.targetId);
    const updated = { ...target };
    const ops: ts.pxtc.jsonPatch.PatchOperation[] = [
        { op: "add", path: ["backpack"], value: {} },
        { op: "add", path: ["backpack", context.targetId], value: {} }
    ];
    for (const item of items) {
        if (own(target, item.id)) {
            if (!sameItem(validateBackpackItem(target[item.id]), item)) {
                throw new Error(lf("A local snippet conflicts with a saved profile snippet. Neither copy was changed. Sign out to manage the local copy."));
            }
        } else {
            updated[item.id] = item;
            ops.push({ op: "add", path: ["backpack", context.targetId, item.id], value: item });
        }
    }
    // Reserve space for an accompanying save before promoting any local items.
    const prospective = pendingItem ? { ...updated, [pendingItem.id]: pendingItem } : updated;
    checkCapacity({ ...preferences.backpack, [context.targetId]: prospective }, prospective);
    const acknowledged = ops.length > 2 ? await requestAsync(context, ops) : preferences;
    const saved = collection(acknowledged, context.targetId);
    if (items.some(item => !sameItem(validateBackpackItem(saved[item.id]), item))) {
        throw new Error(lf("Your local snippets could not be synced. They are still saved in this browser. Please try again."));
    }
    await verifyAsync(context);
    try {
        for (const item of items) {
            const key = localPrefix(context.targetId) + item.id;
            // Another guest tab may have edited an item while the upload was pending.
            if (local.storage.getItem(key) !== local.serialized[item.id]) continue;
            local.storage.removeItem(key);
            if (local.storage.getItem(key) !== null) throw new Error();
        }
    } catch {
        throw new Error(lf("Your snippets were saved to your profile, but their local copies could not be removed. Please try again."));
    }
    return acknowledged;
}

function publish(context: OperationContext, preferences: pxt.auth.UserPreferences, warning?: string): void {
    assertActive(context);
    const next: Snapshot = { identity: context, entries: [], warning };
    try {
        const target = collection(preferences, context.targetId);
        next.entries = entriesFromCollection(target, context.kind);
        // Quotas prevent new writes, not reading or deleting existing snippets.
        try { checkCapacity(preferences.backpack, target); }
        catch { next.warning = lf("Your backpack is over its storage limit. Delete snippets using their trash buttons to make room."); }
        if (context.kind === "cloud") {
            const local = readLocalBackpack(context.targetId, true);
            if (local) next.entries.push(...entriesFromCollection(local.items, "local").filter(entry => !entry.item));
        }
    } catch {
        next.error = new Error(lf("Your saved backpack collection could not be read. Please try again."));
    }
    snapshot = next;
    notifyBackpackEditorChanged();
}

/** Returns detached display entries only for the current local/profile backpack and target. */
export function getBackpackState(): BackpackState {
    if (!snapshot || !isActive(snapshot.identity)) return { entries: [] };
    if (snapshot.error) throw snapshot.error;
    return { entries: snapshot.entries.map(entry => entry.item
        ? { ...entry, item: validateBackpackItem(entry.item) } : { ...entry }), warning: snapshot.warning };
}

/** Invalid recovery entries are never exposed as importable snippets. */
export function getBackpackItems(): pxt.auth.BackpackItem[] {
    return getBackpackState().entries.filter(entry => !!entry.item).map(entry => entry.item);
}

/** Call on open to read local changes or sync the signed-in profile. */
export function refreshBackpackAsync(): Promise<void> {
    if (!activeIdentity()) {
        snapshot = undefined;
        notifyBackpackEditorChanged();
        return Promise.resolve();
    }
    return enqueue(async context => {
        let preferences = context.kind === "local"
            ? localPreferences(context.targetId, readLocalBackpack(context.targetId))
            : await requestAsync(context);
        if (context.kind === "cloud") {
            try { preferences = await syncLocalBackpackAsync(context, preferences); }
            catch {
                await verifyAsync(context);
                // A failed promotion must not hide the profile's recovery controls.
                // Publish only the original GET, not an unacknowledged upload.
                publish(context, preferences, lf("Some snippets saved in this browser couldn't be synced. They haven't been removed. Try reopening your backpack, or sign out to manage those local copies."));
                if (snapshot.error) throw snapshot.error;
                return;
            }
        }
        publish(context, preferences);
        if (snapshot.error) throw snapshot.error;
    });
}

export async function saveBackpackItemAsync(item: pxt.auth.BackpackItem): Promise<void> {
    const validated = validateBackpackItem(item);
    return enqueue(async context => {
        if (context.kind === "local") {
            const local = readLocalBackpack(context.targetId);
            const updated = { ...local.items, [validated.id]: validated };
            checkCapacity({ [context.targetId]: updated }, updated);
            writeLocalItem(context, validated.id, validated);
            publish(context, localPreferences(context.targetId, readLocalBackpack(context.targetId)));
            return;
        }
        const preferences = await syncLocalBackpackAsync(context, await requestAsync(context), validated);
        const target = collection(preferences, context.targetId);
        const updated = { ...target, [validated.id]: validated };
        checkCapacity({ ...preferences.backpack, [context.targetId]: updated }, updated);
        const ops: ts.pxtc.jsonPatch.PatchOperation[] = [
            { op: "add", path: ["backpack"], value: {} },
            { op: "add", path: ["backpack", context.targetId], value: {} },
            { op: own(target, validated.id) ? "replace" : "add", path: ["backpack", context.targetId, validated.id], value: validated }
        ];
        const acknowledged = await requestAsync(context, ops);
        const saved = validateBackpackItem(collection(acknowledged, context.targetId)[validated.id]);
        if (!sameItem(saved, validated)) {
            throw new Error(lf("The backpack item was changed by another device. Please refresh and try again."));
        }
        publish(context, acknowledged);
    });
}

/** Rename an existing snippet without replacing its blocks or recreating a deleted item. */
export async function renameBackpackItemAsync(id: string, name: string): Promise<void> {
    validateId(id);
    validateName(name);
    name = name.trim();
    return enqueue(async context => {
        const preferences = context.kind === "local"
            ? localPreferences(context.targetId, readLocalBackpack(context.targetId))
            : await requestAsync(context);
        const target = collection(preferences, context.targetId);
        if (!own(target, id)) throw new Error(lf("This snippet is no longer in your backpack. Please reopen the backpack."));
        const item = validateBackpackItem(target[id]);
        if (item.id !== id) throw new Error(lf("A saved backpack item has a mismatched ID."));
        if (item.name === name) {
            publish(context, preferences);
            return;
        }
        const renamed = { ...item, name };
        const updated = { ...target, [id]: renamed };
        checkCapacity({ ...preferences.backpack, [context.targetId]: updated }, updated);
        if (context.kind === "local") {
            writeLocalItem(context, id, renamed);
            publish(context, localPreferences(context.targetId, readLocalBackpack(context.targetId)));
            return;
        }
        // Patch only the name: another device's block edits must survive, and a
        // deleted parent item must not be recreated by a stale rename dialog.
        const acknowledged = await requestAsync(context, [
            { op: "replace", path: ["backpack", context.targetId, id, "name"], value: name }
        ]);
        const saved = validateBackpackItem(collection(acknowledged, context.targetId)[id]);
        if (saved.id !== id || saved.name !== name) {
            throw new Error(lf("The backpack item was changed by another device. Please refresh and try again."));
        }
        publish(context, acknowledged);
    });
}

export async function deleteBackpackItemAsync(id: string): Promise<void> {
    validateId(id);
    return enqueue(context => deleteEntryAsync(context, id, context.kind));
}

/** Delete an observed card, including a malformed key, without trusting any of its damaged content. */
export async function deleteBackpackEntryAsync(entry: BackpackEntry): Promise<void> {
    const id = entry?.id;
    const source = entry?.source;
    if (!snapshot || !snapshot.entries.some(saved => saved.id === id && saved.source === source)
        || !isActive(snapshot.identity)) {
        throw new Error(lf("This snippet is no longer in your backpack. Please reopen the backpack."));
    }
    return enqueue(context => deleteEntryAsync(context, id, source));
}

async function deleteEntryAsync(context: OperationContext, id: string, source: "local" | "cloud"): Promise<void> {
    if (context.kind === "local") {
        writeLocalItem(context, id);
        publish(context, localPreferences(context.targetId, readLocalBackpack(context.targetId)));
        return;
    }
    const preferences = await requestAsync(context);
    if (source === "local") {
        writeLocalItem(context, id);
        publish(context, preferences);
        return;
    }
    const target = collection(preferences, context.targetId);
    // An absent key is an acknowledged deletion, including a retry after a lost response.
    if (!own(target, id)) {
        publish(context, preferences);
        return;
    }
    // Each key is one literal path segment, even when the stored key isn't a UUID.
    // Never validate, rewrite, or remove neighboring snippets to repair this one.
    const acknowledged = await requestAsync(context, [{ op: "remove", path: ["backpack", context.targetId, id] }]);
    if (own(collection(acknowledged, context.targetId), id)) {
        throw new Error(lf("The backpack item could not be deleted. Please try again."));
    }
    publish(context, acknowledged);
}

export function subscribeBackpack(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export type BackpackOpenRequest = { headerId: string; focus: boolean };
const openListeners = new Set<(request: BackpackOpenRequest) => void>();

export function requestBackpackOpen(headerId: string, focus: boolean): void {
    for (const listener of Array.from(openListeners)) {
        try { listener({ headerId, focus }); } catch { /* Observers must not break other subscribers. */ }
    }
}

export function subscribeBackpackOpen(listener: (request: BackpackOpenRequest) => void): () => void {
    openListeners.add(listener);
    return () => { openListeners.delete(listener); };
}

export interface BackpackEditor {
    headerId: () => string;
    canImport: () => boolean;
    importAsync: (item: pxt.auth.BackpackItem) => Promise<boolean>;
}

let registeredEditor: { editor: BackpackEditor };

export function setBackpackEditor(editor: BackpackEditor): () => void {
    const registration = { editor };
    registeredEditor = registration;
    notifyBackpackEditorChanged();
    return () => {
        if (registeredEditor !== registration) return;
        registeredEditor = undefined;
        notifyBackpackEditorChanged();
    };
}

export function canImportBackpack(headerId: string): boolean {
    const editor = registeredEditor?.editor;
    return !!activeIdentity() && !!headerId && !!editor && editor.headerId() === headerId && editor.canImport();
}

export async function importBackpackItemAsync(item: pxt.auth.BackpackItem, headerId: string): Promise<boolean> {
    const validated = validateBackpackItem(item);
    const registration = registeredEditor;
    const context = await captureAsync();
    await verifyAsync(context);
    if (!registration || registeredEditor !== registration || !canImportBackpack(headerId)) {
        throw new Error(lf("Open a compatible project editor to import this backpack item."));
    }
    const added = await registration.editor.importAsync(validated);
    await verifyAsync(context);
    return added;
}

export function notifyBackpackEditorChanged(): void {
    for (const listener of Array.from(listeners)) {
        try { listener(); } catch { /* A UI error must not turn an acknowledged write into a failure. */ }
    }
}