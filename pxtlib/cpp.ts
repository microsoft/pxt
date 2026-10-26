/// <reference path="../localtypings/pxtarget.d.ts"/>
/// <reference path="shared/extensioninfo.ts"/>

namespace pxt {
    declare let require: any;

    let lzmaPromise: Promise<any>;
    function getLzmaAsync() {
        let lzmaPromise: Promise<any>;
        if (!lzmaPromise) {
            if (U.isNodeJS)
                lzmaPromise = Promise.resolve(require("lzma"));
            else
                lzmaPromise = Promise.resolve((<any>window).LZMA);
            lzmaPromise.then(res => {
                if (!res) pxt.reportError('lzma', 'failed to load');
                return res;
            })
        }
        return lzmaPromise;
    }

    export function lzmaDecompressAsync(buf: Uint8Array): Promise<string> { // string
        return getLzmaAsync()
            .then(lzma => new Promise<string>((resolve, reject) => {
                try {
                    lzma.decompress(buf, (res: string, error: any) => {
                        if (error) pxt.debug(`lzma decompression failed`);
                        resolve(error ? undefined : res);
                    })
                }
                catch (e) {
                    if (e) pxt.debug(`lzma decompression failed`);
                    resolve(undefined);
                }
            }));
    }

    export function lzmaCompressAsync(text: string): Promise<Uint8Array> {
        return getLzmaAsync()
            .then(lzma => new Promise<Uint8Array>((resolve, reject) => {
                try {
                    lzma.compress(text, 7, (res: any, error: any) => {
                        if (error) pxt.reportException(error);
                        resolve(error ? undefined : new Uint8Array(res));
                    })
                }
                catch (e) {
                    pxt.reportException(e)
                    resolve(undefined);
                }
            }));
    }
}

namespace pxt.cpp {
    import U = pxtc.Util;

    function parseExpr(e: string): number {
        e = e.trim()
        e = e.replace(/^\(/, "")
        e = e.replace(/\)$/, "")
        e = e.trim();
        if (/^-/.test(e) && parseExpr(e.slice(1)) != null)
            return -parseExpr(e.slice(1))
        if (/^0x[0-9a-f]+$/i.exec(e))
            return parseInt(e.slice(2), 16)
        if (/^0b[01]+$/i.exec(e))
            return parseInt(e.slice(2), 2)
        if (/^0\d+$/i.exec(e))
            return parseInt(e, 8)
        if (/^\d+$/i.exec(e))
            return parseInt(e, 10)
        return null;
    }

    function fromUTF8Bytes(binstr: ArrayLike<number>): string {
        if (!binstr) return ""

        // escape function is deprecated
        let escaped = ""
        for (let i = 0; i < binstr.length; ++i) {
            let k = binstr[i] & 0xff
            if (k == 37 || k > 0x7f) {
                escaped += "%" + k.toString(16);
            } else {
                escaped += String.fromCharCode(k)
            }
        }

        // decodeURIComponent does the actual UTF8 decoding
        return decodeURIComponent(escaped)
    }

    function swapBytes(str: string): string {
        let r = ""
        let i = 0
        for (; i < str.length; i += 2)
            r = str[i] + str[i + 1] + r
        Util.assert(i == str.length)
        return r
    }

    interface RawEmbed {
        meta: string;
        text: Uint8Array;
    }

    function extractSourceFromBin(bin: Uint8Array): RawEmbed {
        let magic = [0x41, 0x14, 0x0E, 0x2F, 0xB8, 0x2F, 0xA2, 0xBB]
        outer: for (let p = 0; p < bin.length; p += 16) {
            if (bin[p] != magic[0])
                continue
            for (let i = 0; i < magic.length; ++i)
                if (bin[p + i] != magic[i])
                    continue outer
            let metaLen = bin[p + 8] | (bin[p + 9] << 8)
            let textLen = bin[p + 10] | (bin[p + 11] << 8) | (bin[p + 12] << 16) | (bin[p + 13] << 24)
            // TODO test in iOS Safari
            p += 16
            let end = p + metaLen + textLen
            if (end > bin.length)
                continue
            let bufmeta = bin.slice(p, p + metaLen)
            let buftext = bin.slice(p + metaLen, end)
            return {
                meta: fromUTF8Bytes(bufmeta),
                text: buftext
            }
        }
        return null
    }

    function extractSource(hexfile: string): RawEmbed {
        if (!hexfile) return undefined;

        let metaLen = 0
        let textLen = 0
        let toGo = 0
        let buf: number[];
        let ptr = 0;
        hexfile.split(/\r?\n/).forEach(ln => {
            let m = /^:10....0[0E]41140E2FB82FA2BB(....)(....)(....)(....)(..)/.exec(ln)
            if (m) {
                metaLen = parseInt(swapBytes(m[1]), 16)
                textLen = parseInt(swapBytes(m[2]), 16) + parseInt(swapBytes(m[3]), 16) * 0x10000
                toGo = metaLen + textLen
                buf = <any>new Uint8Array(toGo)
            } else if (toGo > 0) {
                m = /^:10....0[0E](.*)(..)$/.exec(ln)
                if (!m) return
                let k = m[1]
                while (toGo > 0 && k.length > 0) {
                    buf[ptr++] = parseInt(k[0] + k[1], 16)
                    k = k.slice(2)
                    toGo--
                }
            }
        })
        if (!buf || !(toGo == 0 && ptr == buf.length)) {
            return undefined;
        }
        let bufmeta = new Uint8Array(metaLen)
        let buftext = new Uint8Array(textLen)
        for (let i = 0; i < metaLen; ++i)
            bufmeta[i] = buf[i];
        for (let i = 0; i < textLen; ++i)
            buftext[i] = buf[metaLen + i];
        // iOS Safari doesn't seem to have slice() on Uint8Array
        return {
            meta: fromUTF8Bytes(bufmeta),
            text: buftext
        }
    }

    export interface HexFileMeta {
        cloudId: string;
        targetVersions?: pxt.TargetVersions;
        editor: string;
        name: string;
    }

    export interface HexFile {
        meta?: HexFileMeta;
        source: string;
    }

    export function unpackSourceFromHexFileAsync(file: File): Promise<HexFile> { // string[] (guid)
        if (!file) return undefined;

        return pxt.Util.fileReadAsBufferAsync(file).then(data => {
            let a = new Uint8Array(data);
            return unpackSourceFromHexAsync(a);
        });
    }

    export function unpackSourceFromHexAsync(dat: Uint8Array): Promise<HexFile> { // string[] (guid)
        function error(e: string) {
            pxt.debug(e);
            return Promise.reject(new Error(e));
        }

        let rawEmbed: RawEmbed

        // UF2?
        if (pxt.HF2.read32(dat, 0) == ts.pxtc.UF2.UF2_MAGIC_START0) {
            let bin = ts.pxtc.UF2.toBin(dat)
            if (bin)
                rawEmbed = extractSourceFromBin(bin.buf)
        }

        // ELF?
        if (pxt.HF2.read32(dat, 0) == 0x464c457f) {
            rawEmbed = extractSourceFromBin(dat)
        }

        // HEX? (check for colon)
        if (dat[0] == 0x3a) {
            let str = fromUTF8Bytes(dat);
            rawEmbed = extractSource(str || "")
        }

        if (!rawEmbed || !rawEmbed.meta || !rawEmbed.text) {
            return error("This .hex file doesn't contain source.");
        }

        let hd: {
            compression: string;
            headerSize: number;
            metaSize: number;
            editor: string;
            target?: string;
        } = JSON.parse(rawEmbed.meta)
        if (!hd) {
            return error("This .hex file is not valid.");
        }
        else if (hd.compression == "LZMA") {
            return lzmaDecompressAsync(rawEmbed.text)
                .then(res => {
                    if (!res) return null;
                    let meta = res.slice(0, hd.headerSize || hd.metaSize || 0);
                    let text = res.slice(meta.length);
                    if (meta)
                        Util.jsonCopyFrom(hd, JSON.parse(meta))
                    return { meta: hd as any, source: text }
                })
        } else if (hd.compression) {
            return error(`Compression type ${hd.compression} not supported.`);
        } else {
            return Promise.resolve({ source: fromUTF8Bytes(rawEmbed.text) });
        }
    }
}

namespace pxt.hexloader {
    const downloadCache: Map<Promise<pxtc.HexInfo>> = {};
    let cdnUrlPromise: Promise<string>;
    let hexInfoMemCache: pxt.Map<pxtc.HexInfo> = {}

    export let showLoading: (msg: string) => void = (msg) => { };
    export let hideLoading: () => void = () => { };

    function downloadHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        if (!downloadCache.hasOwnProperty(extInfo.sha))
            downloadCache[extInfo.sha] = downloadHexInfoCoreAsync(extInfo);
        return downloadCache[extInfo.sha];
    }

    function getCdnUrlAsync() {
        if (cdnUrlPromise) return cdnUrlPromise;
        else {
            let curr = getOnlineCdnUrl()
            if (curr) return (cdnUrlPromise = Promise.resolve(curr))
            const forceLive = pxt.webConfig && pxt.webConfig.isStatic;
            return (cdnUrlPromise = Cloud.privateGetAsync("clientconfig", forceLive)
                .then(r => r.primaryCdnUrl));
        }
    }

    function downloadHexInfoCoreAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        let hexurl = ""

        showLoading(pxt.U.lf("Compiling (this may take a minute)..."));
        pxt.tickEvent("cppcompile.start")
        return downloadHexInfoLocalAsync(extInfo)
            .then((hex) => {
                if (hex) {
                    // Found the hex image in the local server cache, use that
                    pxt.tickEvent("cppcompile.cachehit")
                    return hex;
                }
                return getCdnUrlAsync()
                    .then(url => {
                        hexurl = url + "/compile/" + extInfo.sha
                        return U.httpGetTextAsync(hexurl + ".hex")
                    })
                    .then(r => r, e =>
                        Cloud.privatePostAsync("compile/extension", { data: extInfo.compileData }, true)
                            .then(ret => new Promise<string>((resolve, reject) => {
                                let retry = 0;
                                const delay = 8000; // ms
                                const maxWait = 300000; // ms
                                const startTry = U.now();
                                const tryGet = () => {
                                    retry++;
                                    if (U.now() - startTry > maxWait) {
                                        pxt.log(`abandoning C++ build`)
                                        pxt.tickEvent("cppcompile.cancel", { retry })
                                        resolve(null);
                                        return null;
                                    }
                                    let url = ret.hex.replace(/\.hex/, ".json")
                                    pxt.log(`polling C++ build ${url} (attempt #${retry})`)
                                    pxt.tickEvent("cppcompile.poll", { retry })
                                    return Util.httpGetJsonAsync(url)
                                        .then(json => {
                                            pxt.log(`build log ${url.replace(/\.json$/, ".log")}`);
                                            pxt.tickEvent("cppcompile.done", {
                                                success: json?.success ? 1 : 0,
                                                retry,
                                                duration: U.now() - startTry
                                            })
                                            if (!json.success) {
                                                pxt.log(`build failed`);
                                                if (json.mbedresponse && json.mbedresponse.result && json.mbedresponse.result.exception)
                                                    pxt.log(json.mbedresponse.result.exception);
                                                resolve(null);
                                            }
                                            else {
                                                pxt.log("fetching " + hexurl + ".hex")
                                                resolve(U.httpGetTextAsync(hexurl + ".hex"))
                                            }
                                        },
                                            e => {
                                                pxt.log(`waiting ${(delay / 1000) | 0}s for C++ build...`)
                                                setTimeout(tryGet, delay)
                                                return null;
                                            })
                                }
                                tryGet();
                            })))
                    .then(text => {
                        hideLoading();
                        return {
                            hex: text && text.split(/\r?\n/)
                        };
                    })
            }).finally(() => {
                hideLoading();
            })
    }

    function downloadHexInfoLocalAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        if (extInfo.skipCloudBuild)
            return Promise.resolve({ hex: ["SKIP"] })

        if (pxt.webConfig && pxt.webConfig.isStatic) {
            return Util.requestAsync({
                url: `${pxt.webConfig.cdnUrl}hexcache/${extInfo.sha}.hex`
            })
                .then((resp) => {
                    if (resp.text) {
                        const result: any = {
                            enums: [],
                            functions: [],
                            hex: resp.text.split(/\r?\n/)
                        }
                        return Promise.resolve(result);
                    }
                    pxt.log("Hex info not found in bundled hex cache");
                    return Promise.resolve();
                })
                .catch((e) => {
                    pxt.log("Error fetching hex info from bundled hex cache");
                    return Promise.resolve();
                });
        }

        if (!Cloud.localToken || !window || !pxt.BrowserUtils.isLocalHost()) {
            return Promise.resolve(undefined);
        }

        return apiAsync("compile/" + extInfo.sha)
            .then((json) => {
                if (!json || json.notInOfflineCache || !json.hex) {
                    return Promise.resolve(undefined);
                }
                json.hex = json.hex.split(/\r?\n/);
                return json;
            })
            .catch((e) => {
                return Promise.resolve(undefined);
            });
    }

    function apiAsync(path: string, data?: any) {
        return Cloud.localRequestAsync(path, data).then(r => r.json)
    }

    export function storeWithLimitAsync(host: Host, idxkey: string, newkey: string, newval: string, maxLen = 10) {
        return host.cacheStoreAsync(newkey, newval)
            .then(() => host.cacheGetAsync(idxkey))
            .then(res => {
                let keys: string[];
                try { keys = JSON.parse(res || "[]") }
                catch (e) {
                    // cache entry is corrupted, clear cache so that it gets rebuilt
                    pxt.error('invalid cache entry, clearing entry');
                    keys = [];
                }
                keys = keys.filter(k => k != newkey)
                keys.unshift(newkey)
                let todel = keys.slice(maxLen)
                keys = keys.slice(0, maxLen)
                return U.promiseMapAll(todel, e => host.cacheStoreAsync(e, "[]"))
                    .then(() => host.cacheStoreAsync(idxkey, JSON.stringify(keys)))
            })
    }

    export function recordGetAsync(host: Host, idxkey: string, newkey: string) {
        return host.cacheGetAsync(idxkey)
            .then(res => {
                let keys: string[];
                try { keys = JSON.parse(res || "[]") }
                catch (e) {
                    // cache entry is corrupted, clear cache so that it gets rebuilt
                    pxt.error('invalid cache entry, clearing entry');
                    return host.cacheStoreAsync(idxkey, "[]")
                }
                if (keys[0] != newkey) {
                    keys = keys.filter(k => k != newkey)
                    keys.unshift(newkey)
                    return host.cacheStoreAsync(idxkey, JSON.stringify(keys))
                } else {
                    return null
                }
            })
    }

    export function stringifyHexInfoForCache(hexInfo: pxtc.HexInfo) {
        if (!hexInfo?.hex) return undefined;

        const cachedMeta = {
            ...hexInfo,
            hex: compressHex(hexInfo.hex)
        };
        return JSON.stringify(cachedMeta);
    }

    export function getHexInfoAsync(host: Host, extInfo: pxtc.ExtensionInfo, cloudModule?: any): Promise<pxtc.HexInfo> {
        if (!extInfo.sha)
            return Promise.resolve<any>(null)

        const cached = hexInfoMemCache[extInfo.sha]
        if (cached)
            return Promise.resolve(cached)

        pxt.debug("get hex info: " + extInfo.sha)

        let key = "hex-" + extInfo.sha
        return host.cacheGetAsync(key)
            .then(res => {
                let cachedMeta: any;
                try { cachedMeta = res ? JSON.parse(res) : null }
                catch (e) {
                    // cache entry is corrupted, clear cache so that it gets rebuilt
                    pxt.log('invalid cache entry, clearing entry');
                    cachedMeta = null;
                }
                if (cachedMeta && cachedMeta.hex) {
                    pxt.debug("cache hit, size=" + res.length)
                    cachedMeta.hex = decompressHex(cachedMeta.hex)
                    return recordGetAsync(host, "hex-keys", key)
                        .then(() => cachedMeta)
                }
                else {
                    return downloadHexInfoAsync(extInfo)
                        .then(meta => {
                            let store = stringifyHexInfoForCache(meta)
                            return storeWithLimitAsync(host, "hex-keys", key, store)
                                .then(() => meta)
                        }).catch(e => {
                            pxt.reportException(e, { sha: extInfo.sha });
                            return Promise.resolve(null);
                        })
                }
            })
            .then(res => {
                if (res) {
                    if (Object.keys(hexInfoMemCache).length > 20)
                        hexInfoMemCache = {}
                    hexInfoMemCache[extInfo.sha] = res
                }
                return res
            })
    }

    function decompressHex(hex: string[]) {
        let outp: string[] = []

        for (let i = 0; i < hex.length; i++) {
            let m = /^([@!])(....)$/.exec(hex[i])
            if (!m) {
                outp.push(hex[i])
                continue;
            }

            let addr = parseInt(m[2], 16)
            let nxt = hex[++i]
            let buf = ""

            if (m[1] == "@") {
                buf = ""
                let cnt = parseInt(nxt, 16)
                while (cnt-- > 0) {
                    /* eslint-disable no-octal */
                    buf += "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0"
                    /* eslint-enable no-octal */
                }
            } else {
                buf = ts.pxtc.decodeBase64(nxt)
            }

            Util.assert(buf.length > 0)
            Util.assert(buf.length % 16 == 0)

            for (let j = 0; j < buf.length;) {
                let bytes = [0x10, (addr >> 8) & 0xff, addr & 0xff, 0]
                addr += 16;
                for (let k = 0; k < 16; ++k) {
                    bytes.push(buf.charCodeAt(j++))
                }

                let chk = 0
                for (let k = 0; k < bytes.length; ++k)
                    chk += bytes[k]
                bytes.push((-chk) & 0xff)

                let r = ":"
                for (let k = 0; k < bytes.length; ++k) {
                    let b = bytes[k] & 0xff
                    if (b <= 0xf)
                        r += "0"
                    r += b.toString(16)
                }
                outp.push(r.toUpperCase())
            }
        }

        return outp
    }

    function compressHex(hex: string[]) {
        let outp: string[] = []
        let j = 0;

        for (let i = 0; i < hex.length; i += j) {
            let addr = -1;
            let outln = ""
            j = 0;
            let zeroMode = false;

            while (j < 500) {
                let m = /^:10(....)00(.{32})(..)$/.exec(hex[i + j])
                if (!m)
                    break;

                let h = m[2]
                let isZero = /^0+$/.test(h)
                let newaddr = parseInt(m[1], 16)
                if (addr == -1) {
                    zeroMode = isZero;
                    outp.push((zeroMode ? "@" : "!") + m[1])
                    addr = newaddr - 16;
                } else {
                    if (isZero != zeroMode)
                        break;

                    if (addr + 16 != newaddr)
                        break;
                }

                if (!zeroMode)
                    outln += h;

                addr = newaddr;
                j++;
            }

            if (j == 0) {
                outp.push(hex[i])
                j = 1;
            } else {
                if (zeroMode) {
                    outp.push(j.toString(16))
                } else {
                    let bin = ""
                    for (let k = 0; k < outln.length; k += 2)
                        bin += String.fromCharCode(parseInt(outln.slice(k, k + 2), 16))
                    outp.push(ts.pxtc.encodeBase64(bin))
                }
            }
        }

        return outp;
    }

}
