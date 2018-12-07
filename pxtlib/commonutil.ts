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


    // Localization functions. Please port any modifications over to pxtsim/localization.ts
    let _localizeLang: string = "en";
    let _localizeStrings: pxt.Map<string> = {};
    let _translationsCache: pxt.Map<pxt.Map<string>> = {};
    let _didSetlocalizations = false;
    let _didReportLocalizationsNotSet = false;
    export let localizeLive = false;

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

    export function hash32(s: string): number {
        // same hashing as https://github.com/lancaster-university/codal-core/blob/c1fe7a4c619683a50d47cb0c19d15b8ff3bd16a1/source/drivers/PearsonHash.cpp#L26
        const hashTable = [
            251, 175, 119, 215, 81, 14, 79, 191, 103, 49, 181, 143, 186, 157, 0,
            232, 31, 32, 55, 60, 152, 58, 17, 237, 174, 70, 160, 144, 220, 90, 57,
            223, 59, 3, 18, 140, 111, 166, 203, 196, 134, 243, 124, 95, 222, 179,
            197, 65, 180, 48, 36, 15, 107, 46, 233, 130, 165, 30, 123, 161, 209, 23,
            97, 16, 40, 91, 219, 61, 100, 10, 210, 109, 250, 127, 22, 138, 29, 108,
            244, 67, 207, 9, 178, 204, 74, 98, 126, 249, 167, 116, 34, 77, 193,
            200, 121, 5, 20, 113, 71, 35, 128, 13, 182, 94, 25, 226, 227, 199, 75,
            27, 41, 245, 230, 224, 43, 225, 177, 26, 155, 150, 212, 142, 218, 115,
            241, 73, 88, 105, 39, 114, 62, 255, 192, 201, 145, 214, 168, 158, 221,
            148, 154, 122, 12, 84, 82, 163, 44, 139, 228, 236, 205, 242, 217, 11,
            187, 146, 159, 64, 86, 239, 195, 42, 106, 198, 118, 112, 184, 172, 87,
            2, 173, 117, 176, 229, 247, 253, 137, 185, 99, 164, 102, 147, 45, 66,
            231, 52, 141, 211, 194, 206, 246, 238, 56, 110, 78, 248, 63, 240, 189,
            93, 92, 51, 53, 183, 19, 171, 72, 50, 33, 104, 101, 69, 8, 252, 83, 120,
            76, 135, 85, 54, 202, 125, 188, 213, 96, 235, 136, 208, 162, 129, 190,
            132, 156, 38, 47, 1, 7, 254, 24, 4, 216, 131, 89, 21, 28, 133, 37, 153,
            149, 80, 170, 68, 6, 169, 234, 151
        ]

        // REF: https://en.wikipedia.org/wiki/Pearson_hashing
        function eightBitHash(s: Uint8Array): number {
            let hash = 0;
            for (let i = 0; i < s.length; i++) {
                let c = s[i];
                hash = hashTable[hash ^ c];
            }
            return hash;
        }
        function hashN(s: string, byteCount: number): number {
            let hash;
            const buffer = new Uint8Array(s.length * 2);
            for (let i = 0; i < s.length; ++i) {
                const c = s.charCodeAt(i);
                buffer[2 * i] = c & 0xff;
                buffer[2 * i + 1] = (c >> 8) & 0xff;
            }
            let res = 0;
            for (let i = 0; i < byteCount; ++i) {
                hash = eightBitHash(buffer);
                res |= (hash << i);
                buffer[0] = (buffer[0] + 1) % 255;
            }
            return res;
        }


        if (!s) return 0;
        return hashN(s, 4);
    }
}

const lf = ts.pxtc.Util.lf;