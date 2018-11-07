/// <reference path="./tickEvent.ts" />
/// <reference path="./apptarget.ts" />

namespace ts.pxtc {
    export let __dummy = 42;
}

import pxtc = ts.pxtc

namespace ts.pxtc.Util {
    export function assert(cond: boolean, msg = "Assertion failed") {
        if (!cond) {
            debugger
            throw new Error(msg)
        }
    }

    export function flatClone<T>(obj: T): T {
        if (obj == null) return null
        let r: any = {}
        Object.keys(obj).forEach((k) => { r[k] = (obj as any)[k] })
        return r;
    }

    export function clone<T>(v: T): T {
        if (v == null) return null
        return JSON.parse(JSON.stringify(v))
    }

    export function htmlEscape(_input: string) {
        if (!_input) return _input; // null, undefined, empty string test
        return _input.replace(/([^\w .!?\-$])/g, c => "&#" + c.charCodeAt(0) + ";");
    }

    export function jsStringQuote(s: string) {
        return s.replace(/[^\w .!?\-$]/g,
            (c) => {
                let h = c.charCodeAt(0).toString(16);
                return "\\u" + "0000".substr(0, 4 - h.length) + h;
            });
    }

    export function jsStringLiteral(s: string) {
        return "\"" + jsStringQuote(s) + "\"";
    }

    // IndexedDB wrapper class
    export type IDBUpgradeHandler = (ev: IDBVersionChangeEvent, request: IDBRequest) => void;

    export class IDBWrapper {
        private _db: IDBDatabase;
        private upgradeHandler: IDBUpgradeHandler;

        constructor(private name: string, private version: number, upgradeHandler?: IDBUpgradeHandler) {
            if (upgradeHandler) {
                this.upgradeHandler = upgradeHandler;
            }
        }

        private throwIfNotOpened(): void {
            if (!this._db) {
                throw new Error("Database not opened; call IDBWrapper.openAsync() first");
            }
        }

        private errorHandler(err: Error, op: string, reject: (err: Error) => void): void {
            console.error(new Error(`${this.name} IDBWrapper error for ${op}: ${err.message}`));
            reject(err);
        }

        private getObjectStore(name: string, mode: "readonly" | "readwrite" = "readonly"): IDBObjectStore {
            this.throwIfNotOpened();
            const transaction = this._db.transaction([name], mode);
            return transaction.objectStore(name);
        }

        public openAsync(): Promise<void> {
            return new Promise((resolve, reject) => {
                const idbFactory: IDBFactory = window.indexedDB || (<any>window).mozIndexedDB || (<any>window).webkitIndexedDB || (<any>window).msIndexedDB;
                const request = idbFactory.open(this.name, this.version);
                request.onsuccess = () => {
                    this._db = request.result;
                    resolve();
                };
                request.onerror = () => this.errorHandler(request.error, "open", reject);
                request.onupgradeneeded = (ev) => this.upgradeHandler(ev, request);
            });
        }

        public getAsync<T>(storeName: string, id: string): Promise<T> {
            return new Promise((resolve, reject) => {
                const store = this.getObjectStore(storeName);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result as T);
                request.onerror = () => this.errorHandler(request.error, "get", reject);
            });
        }

        public getAllAsync<T>(storeName: string): Promise<T[]> {
            return new Promise((resolve, reject) => {
                const store = this.getObjectStore(storeName);
                const cursor = store.openCursor();
                const data: T[] = [];

                cursor.onsuccess = () => {
                    if (cursor.result) {
                        data.push(cursor.result.value);
                        cursor.result.continue();
                    } else {
                        resolve(data);
                    }
                };
                cursor.onerror = () => this.errorHandler(cursor.error, "getAll", reject);
            });
        }

        public setAsync(storeName: string, data: any): Promise<void> {
            return new Promise((resolve, reject) => {
                const store = this.getObjectStore(storeName, "readwrite");
                let request: IDBRequest;

                if (typeof data.id !== "undefined" && data.id !== null) {
                    request = store.put(data);
                } else {
                    request = store.add(data);
                }

                request.onsuccess = () => resolve();
                request.onerror = () => this.errorHandler(request.error, "set", reject);
            });
        }

        public deleteAsync(storeName: string, id: string): Promise<void> {
            return new Promise((resolve, reject) => {
                const store = this.getObjectStore(storeName, "readwrite");
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => this.errorHandler(request.error, "delete", reject);
            });
        }

        public deleteAllAsync(storeName: string): Promise<void> {
            return new Promise((resolve, reject) => {
                const store = this.getObjectStore(storeName, "readwrite");
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => this.errorHandler(request.error, "deleteAll", reject);
            });
        }
    }

    // Localization functions. Please port any modifications over to pxtsim/localization.ts
    let _localizeLang: string = "en";
    let _localizeStrings: pxt.Map<string> = {};
    let _translationsCache: pxt.Map<pxt.Map<string>> = {};
    let _didSetlocalizations = false;
    let _didReportLocalizationsNotSet = false;
    export let localizeLive = false;

    export interface ITranslationDbEntry {
        id?: string;
        etag: string;
        time: number;
        strings?: pxt.Map<string>; // UI string translations
        md?: string; // markdown content
    }

    export interface ITranslationDb {
        getAsync(lang: string, filename: string, branch: string): Promise<ITranslationDbEntry>;
        setAsync(lang: string, filename: string, branch: string, etag: string, strings?: pxt.Map<string>, md?: string): Promise<void>;
    }

    class MemTranslationDb implements ITranslationDb {
        translations: pxt.Map<ITranslationDbEntry> = {};
        key(lang: string, filename: string, branch: string) {
            return `${lang}|${filename}|${branch || "master"}`;
        }
        get(lang: string, filename: string, branch: string): ITranslationDbEntry {
            return this.translations[this.key(lang, filename, branch)];
        }
        getAsync(lang: string, filename: string, branch: string): Promise<ITranslationDbEntry> {
            return Promise.resolve(this.get(lang, filename, branch));
        }
        set(lang: string, filename: string, branch: string, etag: string, strings?: pxt.Map<string>, md?: string) {
            this.translations[this.key(lang, filename, branch)] = {
                etag,
                time: Date.now() + 24 * 60 * 60 * 1000, // in-memory expiration is 24h
                strings,
                md
            }
        }
        setAsync(lang: string, filename: string, branch: string, etag: string, strings?: pxt.Map<string>, md?: string): Promise<void> {
            this.set(lang, filename, branch, etag, strings);
            return Promise.resolve();
        }
    }

    class IndexedDbTranslationDb implements ITranslationDb {
        static TABLE = "files";
        static KEYPATH = "id";
        static createAsync(): Promise<IndexedDbTranslationDb> {
            const idbWrapper = new IDBWrapper(`__pxt_translations_${pxt.appTarget.id || ""}`, 2, (ev, r) => {
                const db = r.result as IDBDatabase;
                db.createObjectStore(IndexedDbTranslationDb.TABLE, { keyPath: IndexedDbTranslationDb.KEYPATH });
            });
            return idbWrapper.openAsync()
                .then(() => {
                    return Promise.resolve(new IndexedDbTranslationDb(idbWrapper));
                });
        }

        private db: IDBWrapper;
        private mem: MemTranslationDb;
        constructor(db: IDBWrapper) {
            this.db = db;
            this.mem = new MemTranslationDb();
        }
        getAsync(lang: string, filename: string, branch: string): Promise<ITranslationDbEntry> {
            lang = (lang || "en-US").toLowerCase(); // normalize locale
            const id = this.mem.key(lang, filename, branch);
            const r = this.mem.get(lang, filename, branch);
            if (r) return Promise.resolve(r);

            return this.db.getAsync<ITranslationDbEntry>(IndexedDbTranslationDb.TABLE, id)
                .then((res) => {
                    if (res) {
                        // store in-memory so that we don't try to download again
                        this.mem.set(lang, filename, branch, res.etag, res.strings);
                        return Promise.resolve(res);
                    }
                    return Promise.resolve(undefined);
                })
                .catch((e) => {
                    return Promise.resolve(undefined);
                });
        }
        setAsync(lang: string, filename: string, branch: string, etag: string, strings?: pxt.Map<string>, md?: string): Promise<void> {
            lang = (lang || "en-US").toLowerCase(); // normalize locale
            const id = this.mem.key(lang, filename, branch);
            this.mem.set(lang, filename, branch, etag, strings, md);

            if (strings)
                Object.keys(strings).filter(k => !strings[k]).forEach(k => delete strings[k]);
            const entry: ITranslationDbEntry = {
                id,
                etag,
                time: Date.now(),
                strings,
                md
            }
            return this.db.setAsync(IndexedDbTranslationDb.TABLE, entry)
                .catch((e) => {
                    // ignore set errors
                });
        }
    }

    // wired up in the app to store translations in pouchdb. MAY BE UNDEFINED!
    let _translationDbPromise: Promise<ITranslationDb>;
    export function translationDbAsync(): Promise<ITranslationDb> {
        // try indexed db
        if (!_translationDbPromise)
            _translationDbPromise = IndexedDbTranslationDb.createAsync()
                .catch(() => new MemTranslationDb());
        return _translationDbPromise;
    }

    /**
     * Returns the current user language, prepended by "live-" if in live mode
     */
    export function localeInfo(): string {
        return `${localizeLive ? "live-" : ""}${userLanguage()}`;
    }
    /**
     * Returns current user language iSO-code. Default is `en`.
     */
    export function userLanguage(): string {
        return _localizeLang;
    }
    export function setUserLanguage(localizeLang: string) {
        _localizeLang = localizeLang;
    }

    export function isUserLanguageRtl(): boolean {
        return /^ar|dv|fa|ha|he|ks|ku|ps|ur|yi/i.test(_localizeLang);
    }

    export function _localize(s: string) {
        // Needs to be test in localhost / CLI
        /*if (!_didSetlocalizations && !_didReportLocalizationsNotSet) {
            _didReportLocalizationsNotSet = true;
            pxt.tickEvent("locale.localizationsnotset");
            // pxt.reportError can't be used here because of order of file imports
            // Just use console.error instead, and use an Error so stacktrace is reported
            console.error(new Error("Attempted to translate a string before localizations were set"));
        }*/
        return _localizeStrings[s] || s;
    }

    export function getLocalizedStrings() {
        return _localizeStrings;
    }

    export function setLocalizedStrings(strs: pxt.Map<string>) {
        _didSetlocalizations = true;
        _localizeStrings = strs;
    }

    export function translationsCache() {
        return _translationsCache;
    }

    export function fmt_va(f: string, args: any[]): string {
        if (args.length == 0) return f;
        return f.replace(/\{([0-9]+)(\:[^\}]+)?\}/g, function (s: string, n: string, spec: string): string {
            let v = args[parseInt(n)];
            let r = "";
            let fmtMatch = /^:f(\d*)\.(\d+)/.exec(spec);
            if (fmtMatch) {
                let precision = parseInt(fmtMatch[2])
                let len = parseInt(fmtMatch[1]) || 0
                let fillChar = /^0/.test(fmtMatch[1]) ? "0" : " ";
                let num = (<number>v).toFixed(precision)
                if (len > 0 && precision > 0) len += precision + 1;
                if (len > 0) {
                    while (num.length < len) {
                        num = fillChar + num;
                    }
                }
                r = num;
            } else if (spec == ":x") {
                r = "0x" + v.toString(16);
            } else if (v === undefined) r = "(undef)";
            else if (v === null) r = "(null)";
            else if (v.toString) r = v.toString();
            else r = v + "";
            if (spec == ":a") {
                if (/^\s*[euioah]/.test(r.toLowerCase()))
                    r = "an " + r;
                else if (/^\s*[bcdfgjklmnpqrstvwxz]/.test(r.toLowerCase()))
                    r = "a " + r;
            } else if (spec == ":s") {
                if (v == 1) r = ""
                else r = "s"
            } else if (spec == ":q") {
                r = Util.htmlEscape(r);
            } else if (spec == ":jq") {
                r = Util.jsStringQuote(r);
            } else if (spec == ":uri") {
                r = encodeURIComponent(r).replace(/'/g, "%27").replace(/"/g, "%22");
            } else if (spec == ":url") {
                r = encodeURI(r).replace(/'/g, "%27").replace(/"/g, "%22");
            } else if (spec == ":%") {
                r = (v * 100).toFixed(1).toString() + '%';
            }
            return r;
        });
    }

    export function fmt(f: string, ...args: any[]) { return fmt_va(f, args); }

    const locStats: { [index: string]: number; } = {};
    export function dumpLocStats() {
        const r: { [index: string]: string; } = {};
        Object.keys(locStats).sort((a, b) => locStats[b] - locStats[a])
            .forEach(k => r[k] = k);
        console.log('prioritized list of strings:')
        console.log(JSON.stringify(r, null, 2));
    }

    let sForPlural = true;
    export function lf_va(format: string, args: any[]): string {
        if (!format) return format;

        locStats[format] = (locStats[format] || 0) + 1;
        let lfmt = Util._localize(format)

        if (!sForPlural && lfmt != format && /\d:s\}/.test(lfmt)) {
            lfmt = lfmt.replace(/\{\d+:s\}/g, "")
        }

        lfmt = lfmt.replace(/\{(id|loc):[^\}]+\}/g, '');

        return fmt_va(lfmt, args);
    }

    export function lf(format: string, ...args: any[]): string {
        return lf_va(format, args);
    }
    /**
     * Similar to lf but the string do not get extracted into the loc file.
     */
    export function rlf(format: string, ...args: any[]): string {
        return lf_va(format, args);
    }

    export function lookup<T>(m: pxt.Map<T>, key: string): T {
        if (m.hasOwnProperty(key))
            return m[key]
        return null
    }

    export function isoTime(time: number) {
        let d = new Date(time * 1000)
        return Util.fmt("{0}-{1:f02.0}-{2:f02.0} {3:f02.0}:{4:f02.0}:{5:f02.0}",
            d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
    }

    export function userError(msg: string): Error {
        let e = new Error(msg);
        (<any>e).isUserError = true;
        throw e
    }

    export class CancellationToken {
        private pending = false;
        private cancelled = false;
        private resolve: () => void;
        private deferred: Promise<void>;
        private progressHandler: (completed: number, total: number) => void;

        startOperation() {
            this.pending = true;
        }

        isRunning() {
            return this.pending;
        }

        onProgress(progressHandler: (completed: number, total: number) => void) {
            this.progressHandler = progressHandler;
        }

        reportProgress(completed: number, total: number) {
            if (this.progressHandler) {
                this.progressHandler(completed, total);
            }
        }

        cancel() {
            this.cancelled = true;
            this.pending = false;
        }

        cancelAsync() {
            if (this.cancelled || !this.pending) {
                this.cancelled = true;
                this.pending = false;
                return Promise.resolve();
            }
            this.cancelled = true;
            this.deferred = new Promise(resolve => {
                this.resolve = resolve;
            });

            return this.deferred;
        }

        isCancelled() {
            return this.cancelled;
        }

        throwIfCancelled() {
            if (this.isCancelled()) throw new Error();
        }

        resolveCancel() {
            this.pending = false;
            if (this.deferred) {
                this.resolve();
                this.deferred = undefined;
                this.resolve = undefined;
            }
        }
    }
}

const lf = ts.pxtc.Util.lf;