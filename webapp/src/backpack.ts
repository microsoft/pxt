export const MAX_BACKPACK_ITEMS = 50;
export const MAX_BACKPACK_ASSETS = 200;
export const MAX_BACKPACK_NAME_LENGTH = 100;
export const MAX_BACKPACK_CODE_LENGTH = 524288;
export const MAX_BACKPACK_DATA_LENGTH = 1048576;
// Keep capture's existing conservative PNG budget; the API accepts 128 KiB binary.
export const MAX_BACKPACK_PREVIEW_LENGTH = 64000;

/** The target controls availability independently of cloud sign-in. */
export function isBackpackEnabled(): boolean {
    return !!pxt.appTarget?.appTheme?.backpack;
}

export function isBackpackAssetsEnabled(): boolean {
    return isBackpackEnabled() && !!pxt.appTarget?.appTheme?.assetEditor;
}

/** Individual durable records. Namespace and key are literal IndexedDB key components. */
export interface BackpackLocalRecord {
    namespace: string;
    key: string;
    payload: string;
    /** Claim guest uploads before sending so a different account cannot retry them. */
    owner?: string;
    firstAttemptAt?: number;
}

export interface BackpackLocalStorage {
    listAsync(namespace: string): Promise<BackpackLocalRecord[]>;
    /** Atomic compare-and-swap; undefined expected means the key must be absent. */
    changeAsync(namespace: string, key: string, expected: BackpackLocalRecord | undefined,
        next: BackpackLocalRecord | undefined): Promise<boolean>;
}

export function backpackLocalNamespace(target: string, userId?: string): string {
    return JSON.stringify([target, userId === undefined ? "guest" : "user", userId || ""]);
}

function storageError(): Error {
    return new Error(lf("Could not save or read your local backpack. Allow browser storage and check available space, then try again."));
}

/** Injectable IndexedDB factory; never falls back to memory or native localStorage. */
export function createBackpackLocalStorage(factory: IDBFactory): BackpackLocalStorage {
    const openAsync = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
        let request: IDBOpenDBRequest;
        let failed = false;
        try { request = factory.open("pxt-backpack", 1); }
        catch { reject(storageError()); return; }
        request.onupgradeneeded = () => {
            const store = request.result.createObjectStore("items", { keyPath: ["namespace", "key"] });
            store.createIndex("namespace", "namespace", { unique: false });
        };
        request.onerror = request.onblocked = () => { failed = true; reject(storageError()); };
        request.onsuccess = () => {
            if (failed) { request.result.close(); return; }
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
        };
    });
    const transactionAsync = async <T>(mode: IDBTransactionMode,
        action: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> => {
        const db = await openAsync();
        try {
            return await new Promise<T>((resolve, reject) => {
                let transaction: IDBTransaction;
                let result: T;
                try {
                    // The optional third argument is ignored by older implementations.
                    const begin = db.transaction as (name: string, mode: IDBTransactionMode,
                        options?: { durability: "strict" }) => IDBTransaction;
                    transaction = begin.call(db, "items", mode, { durability: "strict" });
                    transaction.oncomplete = () => resolve(result);
                    transaction.onerror = transaction.onabort = () => reject(storageError());
                    action(transaction.objectStore("items"), value => { result = value; });
                } catch {
                    try { transaction?.abort(); } catch { /* Already completed. */ }
                    reject(storageError());
                }
            });
        } finally { db.close(); }
    };
    return {
        listAsync: namespace => transactionAsync<BackpackLocalRecord[]>("readonly", (store, done) => {
            const request = store.index("namespace").getAll(namespace);
            request.onsuccess = () => done(request.result);
        }),
        changeAsync: (namespace, key, expected, next) => transactionAsync<boolean>("readwrite", (store, done) => {
            const request = store.get([namespace, key]);
            request.onsuccess = () => {
                try {
                    const current: BackpackLocalRecord = request.result;
                    const same = !current ? !expected : !!expected && current.payload === expected.payload
                        && current.owner === expected.owner && current.firstAttemptAt === expected.firstAttemptAt;
                    if (!same) { done(false); return; }
                    if (next) store.put({ ...next, namespace, key });
                    else store.delete([namespace, key]);
                    done(true);
                } catch { store.transaction.abort(); }
            };
        })
    };
}

interface LocalIdentity {
    kind: "local";
    targetId: string;
    generation: number;
}

interface CloudIdentity {
    kind: "cloud";
    userId: string;
    targetId: string;
    client: pxt.auth.AuthClient;
    generation: number;
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
    summary?: BackpackSummary;
    /** Opaque local record identity, never taken from the payload. */
    local?: BackpackLocalRecord;
    pendingError?: string;
    error?: string;
}

export interface BackpackSummary {
    id: string;
    name: string;
    kind?: pxt.auth.BackpackKind;
    /** Invalid recovery summaries may lack capture metadata. */
    versions?: pxt.auth.BackpackVersions;
    blockText: string;
    blockTypes: string[];
    searchText?: string[];
    /** Supporting definitions included in addition to the selected container. */
    functionCount?: number;
    dependencies: pxt.Map<string>;
    projectBlocks?: pxt.Map<string>;
    createdAt: number;
    updatedAt: number;
    version: string;
    status: "ready" | "invalid";
    hasPreview: boolean;
    previewPixelDensity?: number;
    error?: string;
}

export interface BackpackLimits {
    maxItems: number;
    maxAssets: number;
    maxAssetCodeBytes: number;
    maxCodeBytes: number;
    maxMetadataBytes: number;
    maxPreviewBytes: number;
    maxRequestBytes: number;
    maxTotalBytes: number;
    maxPageBytes: number;
}

export interface BackpackState {
    entries: BackpackEntry[];
    warning?: string;
    complete?: boolean;
    usage?: { count: number; codeCount: number; assetCount: number; bytes: number };
    limits?: BackpackLimits;
}

interface Snapshot extends BackpackState {
    identity: Identity;
}

let snapshot: Snapshot;
const MAX_PREVIEW_CACHE_BYTES = 8 * 1024 * 1024;
interface CachedPreview {
    id: string;
    version: string;
    bytes: number;
    controller: AbortController;
    value: Promise<pxt.auth.BackpackItem | Blob>;
}
const previewCache = new Map<string, CachedPreview>();

function clearBackpackCache(): void {
    for (const cached of previewCache.values()) cached.controller.abort();
    previewCache.clear();
}

let queue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const safeKey = (key: string): boolean => !["__proto__", "constructor", "prototype"].includes(key);

const DEFAULT_LIMITS: BackpackLimits = { maxItems: 50, maxAssets: 200, maxAssetCodeBytes: 131072, maxCodeBytes: 524288, maxMetadataBytes: 65536,
    maxPreviewBytes: 131072, maxRequestBytes: 1048576, maxTotalBytes: 52428800, maxPageBytes: 1048576 };
const validCount = (value: unknown): boolean => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function utf8Length(value: string): number {
    let bytes = 0;
    for (const character of value) {
        const point = character.codePointAt(0);
        bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    }
    return bytes;
}

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

function validateVersions(value: unknown): pxt.auth.BackpackVersions {
    if (!isRecord(value) || Object.keys(value).length !== 2 || !own(value, "target") || !own(value, "pxt")
        || Object.values(value).some(version => typeof version !== "string" || version.length > 100
            || !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version))) {
        throw new Error(lf("This backpack item has invalid editor version information."));
    }
    return { target: value.target as string, pxt: value.pxt as string };
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
    if (value.kind !== "code" && value.kind !== "asset") throw new Error(lf("Invalid backpack item kind."));
    const versions = validateVersions(value.versions);
    const maxCodeBytes = value.kind === "asset" ? DEFAULT_LIMITS.maxAssetCodeBytes : MAX_BACKPACK_CODE_LENGTH;
    if (typeof value.code !== "string" || utf8Length(value.code) > maxCodeBytes) {
        throw new Error(lf("Backpack code must be text of at most {0} UTF-8 bytes.", maxCodeBytes));
    }
    const payload: unknown = pxt.Util.jsonTryParse(value.code);
    const blocks = isRecord(payload) && Array.isArray(payload.blocks) ? payload.blocks : [];
    const root = blocks[blocks.length - 1];
    // Storage may be read before an extension is installed. Verify the real field on import/edit.
    if (value.kind === "asset" && (blocks.length !== 1 || !isRecord(root) || typeof root.type !== "string" || !safeKey(root.type)
        || !root.type || !isRecord(root.fields) || !Object.keys(root.fields).length || own(root, "next")
        || root.inputs !== undefined && (!isRecord(root.inputs) || !!Object.keys(root.inputs).length)
        || own(value, "previewUri") || own(value, "previewPixelDensity"))) {
        throw new Error(lf("Invalid standalone backpack asset."));
    }
    if (typeof value.blockText !== "string" || value.blockText.length > 100000) {
        throw new Error(lf("Backpack block text must be text of at most {0} characters.", 100000));
    }
    if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt) || value.createdAt < 0) {
        throw new Error(lf("Invalid backpack creation time."));
    }
    const metadata = validateBackpackRequirements(value);
    if (value.previewUri !== undefined && (typeof value.previewUri !== "string"
        || value.previewUri.length > 22 + 4 * Math.ceil(DEFAULT_LIMITS.maxPreviewBytes / 3)
        || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value.previewUri)
        || (value.previewUri.length - "data:image/png;base64,".length) % 4 !== 0)) {
        throw new Error(lf("Backpack previews must be PNG data URIs of at most {0} bytes.", DEFAULT_LIMITS.maxPreviewBytes));
    }
    if (value.previewPixelDensity !== undefined && (!value.previewUri
        || typeof value.previewPixelDensity !== "number" || ![1, 1.5, 2].includes(value.previewPixelDensity))) {
        throw new Error(lf("Invalid backpack preview pixel density."));
    }
    const result: pxt.auth.BackpackItem = {
        id: value.id, name: value.name, kind: value.kind, versions,
        code: value.code, blockText: value.blockText, ...metadata, createdAt: value.createdAt
    };
    if (typeof value.previewUri === "string") {
        const base64 = value.previewUri.slice(22);
        const bytes = base64.length / 4 * 3 - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
        if (bytes > DEFAULT_LIMITS.maxPreviewBytes) throw new BackpackRequestError("backpack_preview_too_large");
        result.previewUri = value.previewUri;
    }
    if (typeof value.previewPixelDensity === "number") result.previewPixelDensity = value.previewPixelDensity;
    if (utf8Length(JSON.stringify(result)) > DEFAULT_LIMITS.maxRequestBytes) throw new BackpackRequestError("backpack_request_too_large");
    return result;
}

/** Shared dependency/source policy, independent of a capture's code and editor version. */
export function validateBackpackRequirements(value: pxt.Map<unknown>): { dependencies: pxt.Map<string>; projectBlocks?: pxt.Map<string> } {
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
    const result: { dependencies: pxt.Map<string>; projectBlocks?: pxt.Map<string> } = { dependencies };
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
    return result;
}

let identityGeneration = 0;
let lastIdentity: Identity;

function activeIdentity(): Identity | undefined {
    const targetId = pxt.appTarget?.id;
    const signedIn = pxt.auth.hasIdentity() && pxt.auth.cachedHasAuthToken;
    const client = signedIn ? pxt.auth.client() : undefined;
    const userId = pxt.auth.cachedUserState?.profile?.id;
    // A partially loaded signed-in session must not write to the guest backpack.
    if (!isBackpackEnabled() || !targetId || !safeKey(targetId) || signedIn && (!client || !userId)) {
        if (lastIdentity) identityGeneration++;
        clearBackpackCache();
        lastIdentity = undefined;
        return undefined;
    }
    const kind = signedIn ? "cloud" : "local";
    if (!lastIdentity || lastIdentity.targetId !== targetId || lastIdentity.kind !== kind
        || lastIdentity.kind === "cloud" && (lastIdentity.userId !== userId || lastIdentity.client !== client)) {
        identityGeneration++;
        clearBackpackCache();
    }
    lastIdentity = signedIn ? { kind: "cloud", client, userId, targetId, generation: identityGeneration }
        : { kind: "local", targetId, generation: identityGeneration };
    return lastIdentity;
}

function isActive(identity: Identity): boolean {
    const active = activeIdentity();
    return !!active && active.generation === identity.generation && active.kind === identity.kind && active.targetId === identity.targetId
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
    let token: string;
    try { token = await pxt.auth.getAuthTokenAsync(); }
    catch { throw new Error(lf("Your backpack session is unavailable. Please sign in again.")); }
    assertActive(identity);
    if (!token) throw new Error(lf("Sign in to use your backpack."));
    const context = { ...identity, token };
    await verifyAsync(context);
    return context;
}

async function verifyAsync(context: OperationContext): Promise<void> {
    assertActive(context);
    if (context.kind === "local") return;
    let state: Readonly<pxt.auth.UserState>;
    let token: string;
    try { state = await pxt.auth.getUserStateAsync(); }
    catch { throw new Error(lf("Your backpack session is unavailable. Please sign in again.")); }
    assertActive(context);
    if (state?.profile?.id !== context.userId) throw new Error(lf("Your backpack account changed."));
    try { token = await pxt.auth.getAuthTokenAsync(); }
    catch { throw new Error(lf("Your backpack session is unavailable. Please sign in again.")); }
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

export function backpackErrorMessage(code?: string): string {
    switch (code) {
        case "backpack_request_too_large":
        case "backpack_entry_too_large": return lf("This snippet is too large. Save a smaller block container.");
        case "backpack_preview_too_large": return lf("This snippet's preview is too large. Try saving without a preview.");
        case "backpack_quota_exceeded": return lf("Your backpack is full. Delete some snippets and try again.");
        case "backpack_id_conflict": return lf("A different snippet already uses this ID. Neither copy was overwritten.");
        case "backpack_version_conflict":
        case "backpack_precondition_required": return lf("This snippet changed on another device. Cancel and reopen the backpack before trying again.");
        case "backpack_entry_deleted": return lf("This snippet was deleted. Capture the blocks again to save a new copy.");
        case "backpack_invalid_entry": return lf("This snippet contains invalid data. You can delete it or reopen the backpack to check again.");
        case "backpack_unsupported_entry": return lf("This saved item uses an unsupported Backpack format. Delete it and save a new copy from your project.");
        case "backpack_not_found": return lf("This snippet is no longer available. Reopen the backpack to check again.");
        case "backpack_invalid_cursor": return lf("The backpack list changed. Reopen the backpack to load it again.");
        case "backpack_rate_limited": return lf("Too many backpack requests. Wait a moment and try again.");
        case "backpack_account_deleting": return lf("This account is being deleted. Backpack changes are unavailable.");
        case "backpack_access_denied": return lf("Backpack access was denied. Reload the editor and try signing in again.");
        case "backpack_unavailable": return lf("Backpack sync is temporarily unavailable. Your pending snippets remain in this browser.");
        default: return lf("Could not sync your backpack. Please try again.");
    }
}

class BackpackRequestError extends Error {
    constructor(public readonly code: string) { super(backpackErrorMessage(code)); }
}

function apiUrl(path: string): string {
    return pxt.BrowserUtils.isLocalHostDev() ? `${pxt.cloud.DEV_BACKEND}${path}` : path;
}

async function headersAsync(context: CloudContext): Promise<pxt.Map<string>> {
    try {
        const headers = await pxt.auth.getAuthHeadersAsync(context.token);
        headers["x-pxt-target"] = context.targetId;
        return headers;
    } catch { throw new BackpackRequestError(undefined); }
}

async function requestAsync(context: CloudContext, path: string, method = "GET", data?: unknown, version?: string): Promise<unknown> {
    await verifyAsync(context);
    const headers = await headersAsync(context);
    if (version) headers["If-Match"] = version;
    await verifyAsync(context);
    let response: pxt.Util.HttpResponse;
    try {
        response = await pxt.Util.requestAsync({ url: apiUrl(path), method, data, headers,
            withCredentials: true, allowHttpErrors: true });
    } catch {
        await verifyAsync(context);
        throw new BackpackRequestError(undefined);
    }
    await verifyAsync(context);
    if (response.statusCode === 401 || response.statusCode === 403) clearBackpackCache();
    if (response.statusCode === 401) {
        try { await pxt.auth.AuthClient.staticLogoutAsync(); } catch { /* Do not expose auth transport details. */ }
        throw new Error(lf("Your session expired. Sign in again to use your backpack."));
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
        const body: unknown = response.json;
        const code = isRecord(body) && isRecord(body.error) && typeof body.error.code === "string" ? body.error.code : undefined;
        const fallback = response.statusCode === 403 ? "backpack_access_denied"
            : response.statusCode === 503 ? "backpack_unavailable" : undefined;
        // Store only known codes; never retain unknown backend strings or bodies.
        throw new BackpackRequestError(code?.startsWith("backpack_") && ["backpack_unavailable", "backpack_request_too_large",
            "backpack_entry_too_large", "backpack_preview_too_large", "backpack_quota_exceeded", "backpack_id_conflict",
            "backpack_version_conflict", "backpack_entry_deleted", "backpack_invalid_entry", "backpack_unsupported_entry", "backpack_not_found",
            "backpack_invalid_cursor", "backpack_precondition_required", "backpack_rate_limited", "backpack_account_deleting"].includes(code)
            ? code : fallback);
    }
    return response.json;
}

function localStorage(): BackpackLocalStorage {
    try { return createBackpackLocalStorage(window.indexedDB); }
    catch { throw new Error(lf("Could not access your local backpack. Allow browser storage and try again.")); }
}

function namespace(context: Identity): string {
    return backpackLocalNamespace(context.targetId, context.kind === "cloud" ? context.userId : undefined);
}

function localEntry(record: BackpackLocalRecord): BackpackEntry {
    let value: unknown;
    try { value = JSON.parse(record.payload); } catch { value = undefined; }
    return { ...readBackpackEntry(record.key, value, "local"), local: { ...record } };
}

async function localEntriesAsync(context: OperationContext): Promise<BackpackEntry[]> {
    const records = await localStorage().listAsync(namespace(context));
    if (context.kind === "cloud") {
        const guests = await localStorage().listAsync(backpackLocalNamespace(context.targetId));
        records.push(...guests.filter(record => !record.owner || record.owner === context.userId));
    }
    assertActive(context);
    return records.filter(record => !record.owner || context.kind === "cloud" && record.owner === context.userId).map(localEntry);
}

async function changeLocalAsync(context: OperationContext, record: BackpackLocalRecord, next?: BackpackLocalRecord): Promise<boolean> {
    await verifyAsync(context);
    const changed = await localStorage().changeAsync(record.namespace, record.key, record, next);
    assertActive(context);
    return changed;
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

/** Validate metadata without inventing a code payload or downloading content. */
export function readBackpackSummary(value: unknown): BackpackEntry {
    if (!isRecord(value)) throw new BackpackRequestError(undefined);
    validateId(value.id);
    if (typeof value.version !== "string" || !value.version || value.version.length > 1024 || hasControlCharacters(value.version)) {
        throw new BackpackRequestError(undefined);
    }
    const recovery = readBackpackEntry(value.id, { name: value.name, createdAt: value.createdAt }, "cloud");
    try {
        validateName(value.name);
        if (typeof value.blockText !== "string" || utf8Length(value.blockText) > 65536
            || !Array.isArray(value.blockTypes) || value.blockTypes.length > 10000
            || value.blockTypes.some(type => typeof type !== "string" || !type || type.length > 256 || !safeKey(type) || hasControlCharacters(type))
            || value.searchText !== undefined && (!Array.isArray(value.searchText)
                || value.searchText.length > 50000 || value.searchText.some(text => typeof text !== "string"))
            || value.functionCount !== undefined && (!validCount(value.functionCount) || (value.functionCount as number) > 2000)
            || typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt) || value.createdAt < 0
            || typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) || value.updatedAt < 0
            || !["ready", "invalid"].includes(value.status as string) || typeof value.hasPreview !== "boolean"
            || value.previewPixelDensity !== undefined && (!value.hasPreview || ![1, 1.5, 2].includes(value.previewPixelDensity as number))) {
            throw new Error();
        }
        const metadata = validateBackpackRequirements(value);
        if (value.kind !== "code" && value.kind !== "asset") throw new Error();
        const versions = validateVersions(value.versions);
        const summary: BackpackSummary = {
            id: value.id, name: value.name, kind: value.kind, versions, blockText: value.blockText,
            blockTypes: value.blockTypes.slice() as string[], ...metadata,
            ...(value.searchText === undefined ? {} : { searchText: (value.searchText as string[]).slice() }),
            ...(value.functionCount === undefined ? {} : { functionCount: value.functionCount as number }),
            createdAt: value.createdAt, updatedAt: value.updatedAt, version: value.version,
            status: value.status as "ready" | "invalid", hasPreview: value.hasPreview,
            ...(value.previewPixelDensity === undefined ? {} : { previewPixelDensity: value.previewPixelDensity as number })
        };
        if (utf8Length(JSON.stringify(summary)) > DEFAULT_LIMITS.maxPageBytes) throw new Error();
        return { id: summary.id, source: "cloud", name: summary.name, createdAt: summary.createdAt, summary,
            ...(summary.status === "invalid" ? { error: backpackErrorMessage("backpack_invalid_entry") } : {}) };
    } catch {
        // Keep the independently validated ID/version for trash recovery only.
        return { ...recovery, summary: { id: value.id, version: value.version, name: recovery.name,
            createdAt: recovery.createdAt, updatedAt: 0, status: "invalid", hasPreview: false,
            blockText: "", blockTypes: [], dependencies: {} } };
    }
}

function summaryAck(value: unknown, id: string): BackpackEntry {
    if (!isRecord(value)) throw new BackpackRequestError(undefined);
    const entry = readBackpackSummary(value.entry);
    if (entry.id !== id || entry.error) throw new BackpackRequestError("backpack_invalid_entry");
    return entry;
}

export function backpackEntryKey(entry: BackpackEntry): string {
    return JSON.stringify([entry.source, entry.local?.namespace || "", entry.id]);
}

function publish(context: OperationContext, entries: BackpackEntry[], state: Partial<BackpackState> = {}): void {
    assertActive(context);
    snapshot = { ...(snapshot && isActive(snapshot.identity) ? snapshot : {}), ...state, identity: context,
        entries: entries.slice().sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)) };
    for (const [key, cached] of previewCache) {
        const entry = entries.find(entry => entry.source === "cloud" && entry.id === cached.id);
        if (entry ? entry.error || entry.summary.version !== cached.version : snapshot.complete) {
            cached.controller.abort();
            previewCache.delete(key);
        }
    }
    notifyBackpackEditorChanged();
}

function currentEntries(context: OperationContext): BackpackEntry[] {
    assertActive(context);
    return snapshot && isActive(snapshot.identity) ? snapshot.entries : [];
}

function upsert(context: OperationContext, entry: BackpackEntry): void {
    publish(context, [...currentEntries(context).filter(saved => backpackEntryKey(saved) !== backpackEntryKey(entry)), entry]);
}

/** Returns detached metadata, never cloud bodies, scoped to the active identity. */
export function getBackpackState(): BackpackState {
    if (!snapshot || !isActive(snapshot.identity)) return { entries: [] };
    const { identity, ...state } = snapshot;
    return JSON.parse(JSON.stringify(state));
}

/** Only locally available valid bodies; cloud callers must use importBackpackEntryAsync. */
export function getBackpackItems(): pxt.auth.BackpackItem[] {
    return getBackpackState().entries.filter(entry => !!entry.item && !entry.error).map(entry => entry.item);
}

function observed(entry: BackpackEntry): BackpackEntry {
    const saved = entry && snapshot && isActive(snapshot.identity)
        && snapshot.entries.find(candidate => backpackEntryKey(candidate) === backpackEntryKey(entry));
    if (!saved || saved.summary?.version !== entry.summary?.version
        || saved.local?.payload !== entry.local?.payload || saved.local?.owner !== entry.local?.owner
        || saved.local?.firstAttemptAt !== entry.local?.firstAttemptAt) {
        throw new Error(lf("This snippet is no longer current. Reopen the backpack and try again."));
    }
    return JSON.parse(JSON.stringify(saved));
}

async function uploadAsync(context: CloudContext, entry: BackpackEntry): Promise<void> {
    if (!entry.item || !entry.local) return;
    let record = entry.local;
    if (record.firstAttemptAt && Date.now() - record.firstAttemptAt > 24 * 60 * 60 * 1000) {
        throw new Error(lf("This pending save is more than a day old. Add it to a project and capture it again to save a new copy."));
    }
    const claimed = { ...record, owner: context.userId, firstAttemptAt: record.firstAttemptAt || Date.now() };
    if (!await changeLocalAsync(context, record, claimed)) throw new BackpackRequestError("backpack_version_conflict");
    record = claimed;
    upsert(context, { ...entry, local: record });
    const acknowledged = summaryAck(await requestAsync(context, `/api/user/backpack/${entry.id}`, "PUT", entry.item), entry.id);
    // The create response is authoritative even after an earlier rename. Do not
    // compare its name/timestamp with the original, immutable creation request.
    let removed: boolean;
    try { removed = await changeLocalAsync(context, record); }
    catch (error) {
        assertActive(context);
        // Cloud ACK is real even when local cleanup fails. Show one cloud row;
        // the durable original remains available for an idempotent retry on open.
        publish(context, [...currentEntries(context).filter(saved => backpackEntryKey(saved) !== backpackEntryKey(entry)
            && !(saved.source === "cloud" && saved.id === entry.id)), acknowledged], {
            warning: lf("Your snippet was synced, but its pending local copy could not be cleaned up. Reopen the backpack to retry cleanup.")
        });
        throw error;
    }
    if (removed) {
        publish(context, [...currentEntries(context).filter(saved => backpackEntryKey(saved) !== backpackEntryKey(entry)
            && !(saved.source === "cloud" && saved.id === entry.id)), acknowledged]);
    } else {
        // Another tab edited the pending record. Its newer body is never deleted.
        upsert(context, acknowledged);
        throw new BackpackRequestError("backpack_version_conflict");
    }
}

/** Revalidate metadata on every open; keep the previous list until all pages arrive. */
export function refreshBackpackAsync(): Promise<void> {
    return enqueue(async context => {
        const previous = getBackpackState();
        let locals: BackpackEntry[] = [];
        let warning: string;
        try { locals = await localEntriesAsync(context); }
        catch (error) {
            if (context.kind === "local") throw error;
            await verifyAsync(context);
            warning = lf("Local pending snippets could not be read. Allow browser storage and reopen the backpack.");
        }
        if (!previous.complete && !previous.entries.length) {
            publish(context, locals, { complete: false, warning, usage: undefined, limits: undefined });
        }
        if (context.kind === "local") { publish(context, locals, { complete: true }); return; }
        const cloud = new Map<string, BackpackEntry>();
        const cursors = new Set<string>();
        let cursor: string;
        let usage: BackpackState["usage"];
        let limits: BackpackLimits;
        try {
            do {
                const page = await requestAsync(context, `/api/user/backpack?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
                if (!isRecord(page) || !Array.isArray(page.entries) || page.entries.length > 50
                    || !isRecord(page.usage) || ![page.usage.count, page.usage.codeCount, page.usage.assetCount, page.usage.bytes].every(validCount)
                    || page.usage.count !== (page.usage.codeCount as number) + (page.usage.assetCount as number)
                    || !isRecord(page.limits) || Object.keys(DEFAULT_LIMITS).some(key => !validCount((page.limits as pxt.Map<unknown>)[key]))) {
                    throw new BackpackRequestError(undefined);
                }
                for (const value of page.entries) {
                    const entry = readBackpackSummary(value);
                    cloud.set(entry.id, entry);
                }
                usage = { count: page.usage.count as number, codeCount: page.usage.codeCount as number,
                    assetCount: page.usage.assetCount as number, bytes: page.usage.bytes as number };
                limits = page.limits as unknown as BackpackLimits;
                if (page.cursor !== undefined && (typeof page.cursor !== "string" || !page.cursor || page.cursor.length > 2048
                    || cursors.has(page.cursor) || cursors.size >= 100)) throw new BackpackRequestError("backpack_invalid_cursor");
                cursor = page.cursor as string;
                if (cursor) cursors.add(cursor);
            } while (cursor);
        } catch (error) {
            // A guarded 401 intentionally cleared auth; keep the safe sign-in
            // message rather than replacing it with an account-change error.
            if (!isActive(context)) throw error;
            await verifyAsync(context);
            const denied = error instanceof BackpackRequestError && error.code === "backpack_access_denied";
            publish(context, denied ? [] : previous.entries.length ? previous.entries : [...cloud.values(), ...locals], {
                complete: false, warning: error instanceof Error ? error.message : backpackErrorMessage()
            });
            throw error;
        }
        publish(context, [...cloud.values(), ...locals], { complete: true, usage, limits, warning });
        for (const entry of locals) {
            if (!entry.item) continue;
            try { await uploadAsync(context, entry); }
            catch (error) {
                await verifyAsync(context);
                const saved = currentEntries(context).find(candidate => backpackEntryKey(candidate) === backpackEntryKey(entry));
                if (saved) upsert(context, { ...saved, pendingError: error instanceof Error ? error.message : backpackErrorMessage() });
            }
        }
    });
}

export async function saveBackpackItemAsync(item: pxt.auth.BackpackItem): Promise<void> {
    const validated = validateBackpackItem(item);
    // Import validation retains the existing capture bound. New creates must also
    // fit the dedicated service's UTF-8 metadata budget before any persistence.
    if (utf8Length(JSON.stringify({ id: validated.id, name: validated.name, kind: validated.kind,
        versions: validated.versions, blockText: validated.blockText,
        dependencies: validated.dependencies, projectBlocks: validated.projectBlocks,
        createdAt: validated.createdAt })) > DEFAULT_LIMITS.maxMetadataBytes) throw new BackpackRequestError("backpack_entry_too_large");
    return enqueue(async context => {
        const records = await localStorage().listAsync(namespace(context));
        await verifyAsync(context);
        const previous = records.find(record => record.key === validated.id);
        if (previous?.owner && (context.kind !== "cloud" || previous.owner !== context.userId)) {
            throw new BackpackRequestError("backpack_id_conflict");
        }
        const payload = JSON.stringify(validated);
        if (previous && previous.payload !== payload && previous.firstAttemptAt) throw new BackpackRequestError("backpack_id_conflict");
        const categoryCount = records.filter(record => (localEntry(record).item?.kind || "code") === validated.kind).length;
        if (!previous && categoryCount >= (validated.kind === "asset" ? MAX_BACKPACK_ASSETS : MAX_BACKPACK_ITEMS)) {
            throw new BackpackRequestError("backpack_quota_exceeded");
        }
        const totalBytes = records.reduce((sum, record) => sum + (record.key === validated.id ? 0 : utf8Length(record.payload)), utf8Length(payload));
        if (totalBytes > DEFAULT_LIMITS.maxTotalBytes) throw new BackpackRequestError("backpack_quota_exceeded");
        const next: BackpackLocalRecord = { ...previous, namespace: namespace(context), key: validated.id, payload,
            ...(context.kind === "cloud" ? { owner: context.userId } : {}) };
        if (!await localStorage().changeAsync(next.namespace, next.key, previous, next)) throw new BackpackRequestError("backpack_version_conflict");
        assertActive(context);
        const entry = localEntry(next);
        upsert(context, entry);
        if (context.kind === "cloud") {
            try { await uploadAsync(context, entry); }
            catch (error) {
                await verifyAsync(context);
                const saved = currentEntries(context).find(candidate => backpackEntryKey(candidate) === backpackEntryKey(entry));
                if (saved) upsert(context, { ...saved, pendingError: error instanceof Error ? error.message : backpackErrorMessage() });
                throw error;
            }
        }
    });
}

export async function retryBackpackEntryAsync(entry: BackpackEntry): Promise<void> {
    const saved = observed(entry);
    return enqueue(async context => {
        if (context.kind !== "cloud") throw new Error(lf("Sign in to sync this snippet."));
        try { await uploadAsync(context, saved); }
        catch (error) {
            await verifyAsync(context);
            const current = currentEntries(context).find(candidate => backpackEntryKey(candidate) === backpackEntryKey(saved));
            if (current) upsert(context, { ...current, pendingError: error instanceof Error ? error.message : backpackErrorMessage() });
            throw error;
        }
    });
}

/** Optional observed entry preserves the version captured when the native modal opened. */
export async function renameBackpackItemAsync(id: string, name: string, entry?: BackpackEntry): Promise<void> {
    validateId(id);
    validateName(name);
    const saved = observed(entry || getBackpackState().entries.find(candidate => candidate.id === id));
    if (saved.id !== id) throw new BackpackRequestError("backpack_invalid_entry");
    name = name.trim();
    return enqueue(async context => {
        if (saved.error) throw new BackpackRequestError("backpack_invalid_entry");
        if (saved.source === "local") {
            // Once sent, the original create payload must remain immutable for retries.
            if (saved.local.firstAttemptAt) throw new Error(lf("Retry syncing this snippet before renaming it."));
            const renamed = { ...saved.local, payload: JSON.stringify(validateBackpackItem({ ...saved.item, name })) };
            if (!await changeLocalAsync(context, saved.local, renamed)) throw new BackpackRequestError("backpack_version_conflict");
            upsert(context, localEntry(renamed));
        } else {
            if (context.kind !== "cloud") throw new BackpackRequestError(undefined);
            const acknowledged = summaryAck(await requestAsync(context, `/api/user/backpack/${id}`, "PATCH", { name }, saved.summary.version), id);
            if (acknowledged.name !== name) throw new BackpackRequestError("backpack_version_conflict");
            upsert(context, acknowledged);
        }
    });
}

export async function deleteBackpackItemAsync(id: string): Promise<void> {
    validateId(id);
    return deleteBackpackEntryAsync(getBackpackState().entries.find(entry => entry.id === id));
}

/** Local deletion uses the observed literal key, including damaged/non-UUID keys. */
export async function deleteBackpackEntryAsync(entry: BackpackEntry): Promise<void> {
    const saved = observed(entry);
    return enqueue(async context => {
        if (saved.source === "local") {
            if (!await changeLocalAsync(context, saved.local)) throw new BackpackRequestError("backpack_version_conflict");
        } else {
            if (context.kind !== "cloud") throw new BackpackRequestError(undefined);
            const result = await requestAsync(context, `/api/user/backpack/${saved.id}`, "DELETE", undefined, saved.summary.version);
            // The contract returns 200 JSON; also accept a successful 204 with no body.
            if (result !== undefined && result !== null && (!isRecord(result) || result.id !== saved.id || result.deleted !== true)) {
                throw new BackpackRequestError(undefined);
            }
        }
        publish(context, currentEntries(context).filter(candidate => backpackEntryKey(candidate) !== backpackEntryKey(saved)));
    });
}

export function subscribeBackpack(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export type BackpackOpenRequest = { headerId: string; focus: boolean; kind?: pxt.auth.BackpackKind };
const openListeners = new Set<(request: BackpackOpenRequest) => void>();

export function requestBackpackOpen(headerId: string, focus: boolean, kind?: pxt.auth.BackpackKind): void {
    for (const listener of Array.from(openListeners)) {
        try { listener({ headerId, focus, kind }); } catch { /* Observers must not break other subscribers. */ }
    }
}

export function subscribeBackpackOpen(listener: (request: BackpackOpenRequest) => void): () => void {
    openListeners.add(listener);
    return () => { openListeners.delete(listener); };
}

export interface BackpackEditor {
    headerId: () => string;
    canImport: (kind?: pxt.auth.BackpackKind) => boolean;
    canDrop: (target: EventTarget) => boolean;
    assetEditorContext: () => BackpackAssetEditorContext;
    importAsync: (item: pxt.auth.BackpackItem, position?: BackpackImportPosition) => Promise<boolean>;
}

export interface BackpackAssetEditorContext {
    blocksInfo: pxtc.BlocksInfo;
    gallery: pxt.AssetSnapshot;
    palette: string[];
}

interface BackpackAssetEditorHost {
    headerId: () => string;
    canEdit: () => boolean;
    contextAsync: () => Promise<BackpackAssetEditorContext>;
}

let assetEditorHost: BackpackAssetEditorHost;

/** Asset editing belongs to the project, not to the active Blocks workspace. */
export function setBackpackAssetEditor(host: BackpackAssetEditorHost): void {
    assetEditorHost = host;
}

export function canEditBackpackAsset(headerId: string): boolean {
    return isBackpackAssetsEnabled() && !!activeIdentity() && !!headerId && assetEditorHost?.headerId() === headerId && assetEditorHost.canEdit();
}

/** Browser client coordinates, resolved against the workspace after any extension reload. */
export interface BackpackImportPosition {
    x: number;
    y: number;
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

export function canImportBackpack(headerId: string, kind: pxt.auth.BackpackKind = "code"): boolean {
    const editor = registeredEditor?.editor;
    return (kind !== "asset" || isBackpackAssetsEnabled()) && !!activeIdentity() && !!headerId
        && !!editor && editor.headerId() === headerId && editor.canImport(kind);
}

export function canDropBackpack(headerId: string, target: EventTarget, kind: pxt.auth.BackpackKind = "code"): boolean {
    return canImportBackpack(headerId, kind) && registeredEditor.editor.canDrop(target);
}

export async function getBackpackAssetEditorContextAsync(headerId: string): Promise<BackpackAssetEditorContext> {
    const identity = await captureAsync();
    const host = assetEditorHost;
    const check = (): void => {
        if (assetEditorHost !== host || !canEditBackpackAsset(headerId)) {
            throw new Error(lf("Open an editable project to edit this asset."));
        }
    };
    check();
    const context = await host.contextAsync();
    await verifyAsync(identity);
    check();
    return context;
}

export function getBackpackAssetPreviewContext(headerId: string): BackpackAssetEditorContext {
    if (!isBackpackEnabled() || registeredEditor?.editor.headerId() !== headerId) {
        throw new Error(lf("The asset preview is unavailable."));
    }
    return registeredEditor.editor.assetEditorContext();
}

export async function importBackpackItemAsync(item: pxt.auth.BackpackItem, headerId: string): Promise<boolean> {
    const validated = validateBackpackItem(item);
    const registration = registeredEditor;
    const context = await captureAsync();
    await verifyAsync(context);
    if (!registration || registeredEditor !== registration || !canImportBackpack(headerId, validated.kind)) {
        throw new Error(lf("Open a compatible project editor to import this backpack item."));
    }
    const added = await registration.editor.importAsync(validated);
    await verifyAsync(context);
    return added;
}

/** Add and preview drop share the same guarded import path. */
export async function importBackpackEntryAsync(entry: BackpackEntry, headerId: string, position?: BackpackImportPosition): Promise<boolean> {
    const saved = observed(entry);
    if (saved.error) throw new BackpackRequestError("backpack_invalid_entry");
    const context = await captureAsync();
    const registration = registeredEditor;
    if (!registration || !canImportBackpack(headerId, saved.item?.kind || saved.summary?.kind)) {
        throw new Error(lf("Open a compatible project editor to import this backpack item."));
    }
    const item = await readItemAsync(saved, context);
    if (registeredEditor !== registration || !canImportBackpack(headerId, item.kind)) {
        throw new Error(lf("Open a compatible project editor to import this backpack item."));
    }
    // Do not recapture a potentially different identity between fetching and import.
    const added = await registration.editor.importAsync(item, position);
    await verifyAsync(context);
    return added;
}

/** Read code on Add/Edit or for a visible asset preview, never in list responses. */
async function readItemAsync(saved: BackpackEntry, context: OperationContext): Promise<pxt.auth.BackpackItem> {
    let item = saved.item;
    if (saved.source === "cloud") {
        if (context.kind !== "cloud") throw new BackpackRequestError(undefined);
        try {
            const content = await requestAsync(context, `/api/user/backpack/${saved.id}/content`);
            if (!isRecord(content) || content.id !== saved.id || typeof content.code !== "string") {
                throw new BackpackRequestError("backpack_invalid_entry");
            }
            if (content.version !== saved.summary.version) throw new BackpackRequestError("backpack_version_conflict");
            const summary = saved.summary;
            item = validateBackpackItem({ id: summary.id, name: summary.name, code: content.code,
                kind: summary.kind, versions: summary.versions,
                blockText: summary.blockText, dependencies: summary.dependencies, projectBlocks: summary.projectBlocks,
                createdAt: summary.createdAt });
            // Reject missing/malformed serialized blocks without instantiating Blockly.
            const payload: unknown = JSON.parse(item.code);
            if (!isRecord(payload) || !Array.isArray(payload.blocks) || !payload.blocks.length) {
                throw new BackpackRequestError("backpack_invalid_entry");
            }
        } catch (error) {
            await verifyAsync(context);
            const code = error instanceof BackpackRequestError ? error.code : "backpack_invalid_entry";
            if (["backpack_invalid_entry", "backpack_not_found", "backpack_entry_deleted"].includes(code)
                && currentEntries(context).some(entry => entry.source === "cloud" && entry.id === saved.id
                    && entry.summary.version === saved.summary.version)) {
                upsert(context, { ...saved, error: backpackErrorMessage(code) });
            }
            throw new Error(backpackErrorMessage(code));
        }
    }
    await verifyAsync(context);
    return validateBackpackItem(item);
}

export async function loadBackpackAssetAsync(entry: BackpackEntry): Promise<pxt.auth.BackpackItem> {
    const saved = observed(entry);
    if (saved.error || (saved.item?.kind || saved.summary?.kind) !== "asset") throw new BackpackRequestError("backpack_invalid_entry");
    if (saved.local?.firstAttemptAt) throw new Error(lf("Retry syncing this asset before editing it."));
    return readItemAsync(saved, await captureAsync());
}

/** Session-only LRU; versions come from private list metadata, never public URLs. */
async function cachedPreviewAsync(saved: BackpackEntry, context: CloudContext, variant: "asset" | "png",
    load: (signal: AbortSignal) => Promise<pxt.auth.BackpackItem | Blob>): Promise<pxt.auth.BackpackItem | Blob> {
    await verifyAsync(context);
    const key = JSON.stringify([saved.id, saved.summary.version, variant]);
    let cached = previewCache.get(key);
    if (cached) { previewCache.delete(key); previewCache.set(key, cached); }
    else {
        cached = { id: saved.id, version: saved.summary.version, bytes: 0, controller: new AbortController(), value: undefined };
        const current = cached;
        // Defer loading until the entry is in the map so overlapping visible cards share it.
        current.value = Promise.resolve().then(() => load(current.controller.signal)).then(value => {
            assertActive(context);
            observed(saved);
            current.bytes = value instanceof Blob ? value.size : utf8Length(JSON.stringify(value));
            let total = Array.from(previewCache.values()).reduce((sum, entry) => sum + entry.bytes, 0);
            while (total > MAX_PREVIEW_CACHE_BYTES && previewCache.size) {
                const [oldKey, oldest] = previewCache.entries().next().value;
                total -= oldest.bytes;
                oldest.controller.abort();
                previewCache.delete(oldKey);
            }
            return value;
        }).catch(error => {
            if (previewCache.get(key) === current) previewCache.delete(key);
            throw error;
        });
        previewCache.set(key, current);
        if (previewCache.size > 128) {
            const [oldKey, oldest] = previewCache.entries().next().value;
            oldest.controller.abort();
            previewCache.delete(oldKey);
        }
    }
    const value = await cached.value;
    await verifyAsync(context);
    observed(saved);
    return value;
}

/** Asset PNGs are not stored: visible cards read their bounded content to render locally. */
export async function loadBackpackAssetPreviewAsync(entry: BackpackEntry): Promise<pxt.auth.BackpackItem> {
    const saved = observed(entry);
    if (saved.error || (saved.item?.kind || saved.summary?.kind) !== "asset") throw new BackpackRequestError("backpack_invalid_entry");
    const context = await captureAsync();
    if (saved.source !== "cloud" || context.kind !== "cloud") return readItemAsync(saved, context);
    // Detach cached assets: native field decoding is allowed to mutate its input.
    return validateBackpackItem(await cachedPreviewAsync(saved, context, "asset", () => readItemAsync(saved, context)));
}

/** Only assets can replace content. Code captures remain title-only edits. */
export function saveBackpackAssetAsync(entry: BackpackEntry, item: pxt.auth.BackpackItem): Promise<void> {
    const saved = observed(entry);
    const edited = validateBackpackItem(item);
    if (saved.error || edited.id !== saved.id || edited.kind !== "asset"
        || (saved.item?.kind || saved.summary?.kind) !== "asset") throw new BackpackRequestError("backpack_invalid_entry");
    return enqueue(async context => {
        if (saved.source === "local") {
            if (saved.local.firstAttemptAt) throw new Error(lf("Retry syncing this asset before editing it."));
            const next = { ...saved.local, payload: JSON.stringify({ ...edited, createdAt: saved.item.createdAt }) };
            const records = await localStorage().listAsync(saved.local.namespace);
            await verifyAsync(context);
            if (records.reduce((sum, record) => sum + utf8Length(record.key === saved.id ? next.payload : record.payload), 0)
                > DEFAULT_LIMITS.maxTotalBytes) throw new BackpackRequestError("backpack_quota_exceeded");
            if (!await changeLocalAsync(context, saved.local, next)) throw new BackpackRequestError("backpack_version_conflict");
            upsert(context, localEntry(next));
        } else {
            if (context.kind !== "cloud") throw new BackpackRequestError(undefined);
            const acknowledged = summaryAck(await requestAsync(context, `/api/user/backpack/${saved.id}`, "PATCH", edited, saved.summary.version), saved.id);
            upsert(context, acknowledged);
        }
    });
}

/** Binary private preview. Cancellation abandons this caller, not another card's shared read. */
export async function getBackpackPreviewAsync(entry: BackpackEntry, signal: AbortSignal): Promise<Blob> {
    const saved = observed(entry);
    const context = await captureAsync();
    if (context.kind !== "cloud" || saved.error || !saved.summary?.hasPreview) throw new BackpackRequestError(undefined);
    try {
        if (signal.aborted) throw new BackpackRequestError(undefined);
        const blob = await cachedPreviewAsync(saved, context, "png", async requestSignal => {
            const headers = await headersAsync(context);
            await verifyAsync(context);
            const response = await window.fetch(apiUrl(`/api/user/backpack/${saved.id}/preview`), {
                headers, credentials: "include", signal: requestSignal, cache: "no-store"
            });
            await verifyAsync(context);
            if (response.status === 401) {
                await pxt.auth.AuthClient.staticLogoutAsync();
                throw new BackpackRequestError(undefined);
            }
            if (!response.ok || response.headers.get("content-type")?.split(";")[0].trim() !== "image/png") {
                throw new BackpackRequestError(undefined);
            }
            if (response.headers.get("etag") !== saved.summary.version) throw new BackpackRequestError("backpack_version_conflict");
            const blob = await response.blob();
            await verifyAsync(context);
            if (blob.size > DEFAULT_LIMITS.maxPreviewBytes) throw new BackpackRequestError(undefined);
            return blob;
        });
        if (signal.aborted) throw new BackpackRequestError(undefined);
        return blob as Blob;
    } catch {
        throw new Error(lf("This snippet's preview is unavailable."));
    }
}

export function notifyBackpackEditorChanged(): void {
    // Observe transitions even while the panel is inactive. Returning to a prior
    // account must not make an abandoned request from that session current again.
    activeIdentity();
    for (const listener of Array.from(listeners)) {
        try { listener(); } catch { /* A UI error must not turn an acknowledged write into a failure. */ }
    }
}