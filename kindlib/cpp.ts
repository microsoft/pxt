/// <reference path="emitter/util.ts"/>

namespace ks {
    declare var require: any;

    function getLzma() {
        if (U.isNodeJS) return require("lzma");
        else return (<any>window).LZMA;
    }

    export function lzmaDecompressAsync(buf: Uint8Array): Promise<string> { // string
        let lzma = getLzma()
        return new Promise<string>((resolve, reject) => {
            try {
                lzma.decompress(buf, (res: string, error: any) => {
                    resolve(error ? undefined : res);
                })
            }
            catch (e) {
                resolve(undefined);
            }
        })
    }

    export function lzmaCompressAsync(text: string): Promise<Uint8Array> {
        let lzma = getLzma()
        return new Promise<Uint8Array>((resolve, reject) => {
            try {
                lzma.compress(text, 7, (res: any, error: any) => {
                    resolve(error ? undefined : new Uint8Array(res));
                })
            }
            catch (e) {
                resolve(undefined);
            }
        })
    }
}

namespace ks.cpp {
    import U = ts.ks.Util;
    import Y = ts.ks;
    let lf = U.lf;

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

    function nsWriter(nskw = "namespace") {
        let text = ""
        let currNs = ""
        let setNs = (ns: string) => {
            if (currNs == ns) return
            if (currNs) text += "}\n"
            if (ns)
                text += nskw + " " + ns + " {\n"
            currNs = ns
        }
        return {
            setNs,
            write: (s: string) => {
                text += "    " + s.replace(/^\s*/mg, "") + "\n"
            },
            finish: () => {
                setNs("")
                return text
            }
        }
    }

    export function getExtensionInfo(mainPkg: MainPackage): Y.ExtensionInfo {
        var res = Y.emptyExtInfo();
        var pointersInc = ""
        var includesInc = ""
        var thisErrors = ""
        var dTsNamespace = ""
        var err = (s: string) => thisErrors += `   ${fileName}(${lineNo}): ${s}\n`;
        var lineNo = 0
        var fileName = ""
        var cfginc = ""
        let protos = nsWriter("namespace")
        let dTs = nsWriter("declare namespace")
        
        let compileService = mainPkg.getTarget().compileService;
        
        
        function parseCpp(src: string, isHeader: boolean) {
            res.hasExtension = true
            let currNs = ""
            let currDocComment = ""
            let currAttrs = ""
            let inDocComment = false

            lineNo = 0

            function mapType(tp: string) {
                switch (tp.replace(/\s+/g, "")) {
                    case "void": return "void";
                    case "int32_t":
                    case "uint32_t":
                    case "int": return "number";
                    case "StringData*": return "string";
                    case "ImageLiteral": return "string";
                    case "Action": return "() => void";
                    default:
                        err("Don't know how to map type: " + tp)
                        return "any"
                }
            }

            let outp = ""

            src.split(/\r?\n/).forEach(ln => {
                ++lineNo
                if (/^\s*\/\*\*/.test(ln)) {
                    inDocComment = true
                    currDocComment = ln + "\n"
                    if (/\*\//.test(ln)) inDocComment = false
                    outp += "//\n"
                    return
                }

                if (inDocComment) {
                    currDocComment += ln + "\n"
                    if (/\*\//.test(ln)) {
                        inDocComment = false
                    }
                    outp += "//\n"
                    return
                }

                if (/^\s*\/\/%/.test(ln)) {
                    currAttrs += ln + "\n"
                    outp += "//\n"
                    return
                }

                outp += ln + "\n"

                let m = /^\s*namespace\s+(\w+)/.exec(ln)
                if (m) {
                    //if (currNs) err("more than one namespace declaration not supported")
                    currNs = m[1]
                    if (currAttrs || currDocComment) {
                        dTs.setNs("");
                        dTs.write(currDocComment)
                        dTs.write(currAttrs)
                        dTs.setNs(currNs)
                        currAttrs = ""
                        currDocComment = ""
                    }
                    return;
                }

                m = /^\s*(\w+)([\*\&]*\s+[\*\&]*)(\w+)\s*\(([^\(\)]*)\)\s*(;\s*$|\{|$)/.exec(ln)
                if (currAttrs && m) {
                    if (!currNs) err("missing namespace declaration");
                    let retTp = (m[1] + m[2]).replace(/\s+/g, "")
                    let funName = m[3]
                    let origArgs = m[4]
                    let args = origArgs.split(/,/).filter(s => !!s).map(s => {
                        s = s.trim()
                        let m = /(.*)=\s*(\d+)$/.exec(s)
                        let defl = ""
                        let qm = ""
                        if (m) {
                            defl = m[2]
                            qm = "?"
                            s = m[1].trim()
                        }
                        m = /^(.*?)(\w+)$/.exec(s)
                        if (!m) {
                            err("invalid argument: " + s)
                            return ""
                        }

                        if (defl)
                            currAttrs += `//% ${m[2]}.defl=${defl}`

                        return `${m[2]}${qm}: ${mapType(m[1])}`
                    })
                    var numArgs = args.length
                    var fi: Y.FuncInfo = {
                        name: currNs + "::" + funName,
                        type: retTp == "void" ? "P" : "F",
                        args: numArgs,
                        value: null
                    }
                    if (currDocComment) {
                        dTs.setNs(currNs)
                        dTs.write(currDocComment)
                        dTs.write(currAttrs)
                        if (/ImageLiteral/.test(m[4]))
                            dTs.write(`//% imageLiteral=1`)
                        dTs.write(`//% shim=${fi.name}`)
                        dTs.write(`function ${funName}(${args.join(", ")}): ${mapType(retTp)};`)
                    }
                    currDocComment = ""
                    currAttrs = ""
                    if (!isHeader) {
                        protos.setNs(currNs)
                        protos.write(`${retTp} ${funName}(${origArgs});`)
                    }
                    res.functions.push(fi)
                    pointersInc += "(uint32_t)(void*)::" + fi.name + ",\n"
                    return;
                }

                if (currAttrs && ln.trim()) {
                    err("declaration not understood: " + ln)
                    return;
                }
            })

            return outp
        }

        function parseJson(pkg: Package) {
            let json = pkg.config.microbit
            if (!json) return;

            res.hasExtension = true

            // TODO check for conflicts
            if (json.dependencies) {
                U.jsonCopyFrom(res.microbitConfig.dependencies, json.dependencies)
            }

            if (json.config)
                Object.keys(json.config).forEach(k => {
                    if (!/^\w+$/.test(k))
                        err(lf("invalid config variable: {0}", k))
                    cfginc += "#undef " + k + "\n"
                    if (!/^\w+$/.test(json.config[k]))
                        err(lf("invalid config value: {0}: {1}", k, json.config[k]))
                    cfginc += "#define " + k + " " + json.config[k] + "\n"
                })
        }

        // This is overridden on the build server, but we need it for command line build
        res.microbitConfig.dependencies["kindscript-microbit-core"] = "microsoft/kindscript-microbit-core#" + compileService.gittag;

        if (mainPkg) {
            // TODO computeReachableNodes(pkg, true)
            for (let pkg of mainPkg.sortedDeps()) {
                thisErrors = ""
                parseJson(pkg)
                for (let fn of pkg.getFiles()) {
                    let isHeader = U.endsWith(fn, ".h")
                    if (isHeader || U.endsWith(fn, ".cpp")) {
                        let fullName = pkg.level == 0 ? fn : "kind_modules/" + pkg.id + "/" + fn
                        if (isHeader)
                            includesInc += `#include "source/${fullName}"\n`
                        let src = pkg.readFile(fn)
                        fileName = fullName
                        // parseCpp() will remove doc comments, to prevent excessive recompilation
                        src = parseCpp(src, isHeader)
                        res.extensionFiles["/source/" + fullName] = src

                        if (pkg.level == 0)
                            res.onlyPublic = false
                        if (pkg.verProtocol() != "pub" && pkg.verProtocol() != "embed")
                            res.onlyPublic = false
                    }
                }
                if (thisErrors) {
                    res.errors += lf("Packge {0}:\n", pkg.id) + thisErrors
                }
            }
        }

        if (res.errors)
            return res;

        res.generatedFiles["/ext/config.h"] = cfginc
        res.generatedFiles["/ext/pointers.inc"] = pointersInc
        res.generatedFiles["/ext/refs.inc"] = includesInc + protos.finish()

        let moduleJson = {
            "name": "kindscript-microbit-app",
            "version": "0.0.0",
            "description": "Auto-generated. Do not edit.",
            "license": "n/a",
            "dependencies": res.microbitConfig.dependencies,
            "targetDependencies": {},
            "bin": "./source"
        }

        let configJson = {
            "microbit": {
                "configfile": "inc/MicroBitCustomConfig.h"
            }
        }

        res.generatedFiles["/module.json"] = JSON.stringify(moduleJson, null, 4) + "\n"
        res.generatedFiles["/config.json"] = JSON.stringify(configJson, null, 4) + "\n"
        res.generatedFiles["/source/main.cpp"] = `#include "BitVM.h"\nvoid app_main() { bitvm::start(); }\n`

        let tmp = res.extensionFiles
        U.jsonCopyFrom(tmp, res.generatedFiles)

        var creq = {
            config: compileService.serviceId,
            tag: compileService.gittag,
            replaceFiles: tmp,
            dependencies: res.microbitConfig.dependencies,
        }

        let data = JSON.stringify(creq)
        res.sha = U.sha256(data)
        res.compileData = btoa(U.toUTF8(data))
        res.extensionDTs = dTs.finish()

        return res;
    }

    function fileReadAsArrayBufferAsync(f: File): Promise<ArrayBuffer> { // ArrayBuffer
        if (!f)
            return Promise.resolve<ArrayBuffer>(null);
        else {
            return new Promise<ArrayBuffer>((resolve, reject) => {
                var reader = new FileReader();
                reader.onerror = (ev) => resolve(null);
                reader.onload = (ev) => resolve(reader.result);
                reader.readAsArrayBuffer(f);
            });
        }
    }

    function fromUTF8Bytes(binstr: Uint8Array): string {
        if (!binstr) return ""

        // escape function is deprecated
        var escaped = ""
        for (var i = 0; i < binstr.length; ++i) {
            var k = binstr[i] & 0xff
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
        var r = ""
        for (var i = 0; i < str.length; i += 2)
            r = str[i] + str[i + 1] + r
        Util.assert(i == str.length)
        return r
    }

    function extractSource(hexfile: string): { meta: string; text: Uint8Array; } {
        if (!hexfile) return undefined;

        var metaLen = 0
        var textLen = 0
        var toGo = 0
        var buf: number[];
        var ptr = 0;
        hexfile.split(/\r?\n/).forEach(ln => {
            var m = /^:10....0041140E2FB82FA2BB(....)(....)(....)(....)(..)/.exec(ln)
            if (m) {
                metaLen = parseInt(swapBytes(m[1]), 16)
                textLen = parseInt(swapBytes(m[2]), 16)
                toGo = metaLen + textLen
                buf = <any>new Uint8Array(toGo)
            } else if (toGo > 0) {
                m = /^:10....00(.*)(..)$/.exec(ln)
                if (!m) return
                var k = m[1]
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
        var bufmeta = new Uint8Array(metaLen)
        var buftext = new Uint8Array(textLen)
        for (var i = 0; i < metaLen; ++i)
            bufmeta[i] = buf[i];
        for (var i = 0; i < textLen; ++i)
            buftext[i] = buf[metaLen + i];
        // iOS Safari doesn't seem to have slice() on Uint8Array
        return {
            meta: fromUTF8Bytes(bufmeta),
            text: buftext
        }
    }

    export function unpackSourceFromHexFileAsync(file: File): Promise<{ meta?: { cloudId: string; editor: string; name: string; }; source: string; }> { // string[] (guid)
        if (!file) return undefined;

        return fileReadAsArrayBufferAsync(file)
            .then((dat: ArrayBuffer) => {
                let str = fromUTF8Bytes(new Uint8Array(dat));
                let tmp = extractSource(str || "")
                if (!tmp) return undefined

                if (!tmp.meta || !tmp.text) {
                    console.log("This .hex file doesn't contain source.")
                    return undefined;
                }

                var hd: { compression: string; headerSize: number; metaSize: number; editor: string; target?: string; } = JSON.parse(tmp.meta)
                if (!hd) {
                    console.log("This .hex file is not valid.")
                    return undefined;
                }
                else if (hd.compression == "LZMA") {
                    return lzmaDecompressAsync(tmp.text)
                        .then(res => {
                            if (!res) return null;
                            let meta = res.slice(0, hd.headerSize || hd.metaSize);
                            let text = res.slice(meta.length);
                            let metajs = JSON.parse(meta);
                            return { meta: metajs, source: text }
                        })
                } else if (hd.compression) {
                    console.log("Compression type {0} not supported.", hd.compression)
                    return undefined
                } else {
                    return { meta: undefined, source: fromUTF8Bytes(tmp.text) };
                }
            })
    }
}

namespace ks.hex {
    var downloadCache: U.Map<Promise<any>> = {};
    var cdnUrlPromise: Promise<string>;

    function downloadHexInfoAsync(extInfo: ts.ks.ExtensionInfo) {
        if (downloadCache.hasOwnProperty(extInfo.sha))
            return downloadCache[extInfo.sha]
        return (downloadCache[extInfo.sha] = downloadHexInfoCoreAsync(extInfo))
    }

    function getCdnUrlAsync() {
        if (cdnUrlPromise) return cdnUrlPromise
        else return (cdnUrlPromise = Cloud.privateGetAsync("clientconfig").then(r => r.primaryCdnUrl));
    }

    function downloadHexInfoCoreAsync(extInfo: ts.ks.ExtensionInfo) {
        let hexurl = ""
        return getCdnUrlAsync()
            .then(url => {
                hexurl = url + "/compile/" + extInfo.sha
                return U.httpGetTextAsync(hexurl + ".hex")
            })
            .then(r => r, e =>
                Cloud.privatePostAsync("compile/extension", { data: extInfo.compileData })
                    .then(ret => new Promise<string>((resolve, reject) => {
                        let tryGet = () => Util.httpGetJsonAsync(ret.hex.replace(/\.hex/, ".json"))
                            .then(json => {
                                if (!json.success)
                                    U.userError(JSON.stringify(json, null, 1))
                                else
                                    resolve(U.httpGetTextAsync(hexurl + ".hex"))
                            },
                            e => {
                                setTimeout(tryGet, 1000)
                                return null
                            })
                        tryGet();
                    })))
            .then(text =>
                Util.httpGetJsonAsync(hexurl + "-metainfo.json")
                    .then(meta => {
                        meta.hex = text.split(/\r?\n/)
                        return meta
                    }))
    }

    export function storeWithLimitAsync(host: Host, idxkey: string, newkey: string, newval: string, maxLen = 10) {
        return host.cacheStoreAsync(newkey, newval)
            .then(() => host.cacheGetAsync(idxkey))
            .then(res => {
                let keys: string[] = JSON.parse(res || "[]")
                keys = keys.filter(k => k != newkey)
                keys.unshift(newkey)
                let todel = keys.slice(maxLen)
                keys = keys.slice(0, maxLen)
                return Promise.map(todel, e => host.cacheStoreAsync(e, null))
                    .then(() => host.cacheStoreAsync(idxkey, JSON.stringify(keys)))
            })
    }

    export function recordGetAsync(host: Host, idxkey: string, newkey: string) {
        return host.cacheGetAsync(idxkey)
            .then(res => {
                let keys: string[] = JSON.parse(res || "[]")
                if (keys[0] != newkey) {
                    keys = keys.filter(k => k != newkey)
                    keys.unshift(newkey)
                    return host.cacheStoreAsync(idxkey, JSON.stringify(keys))
                } else {
                    return null
                }
            })
    }

    export function getHexInfoAsync(host: Host, extInfo: ts.ks.ExtensionInfo): Promise<any> {
        if (!extInfo.sha)
            return Promise.resolve(null)

        if (ts.ks.hex.isSetupFor(extInfo))
            return Promise.resolve(ts.ks.hex.currentHexInfo)

        console.log("get hex info: " + extInfo.sha)

        let key = "hex-" + extInfo.sha
        return host.cacheGetAsync(key)
            .then(res => {
                if (res) {
                    console.log("cache hit, size=" + res.length)
                    var meta = JSON.parse(res)
                    meta.hex = decompressHex(meta.hex)
                    return recordGetAsync(host, "hex-keys", key)
                        .then(() => meta)
                }
                else {
                    //if (!Cloud.isOnline()) return null;

                    return downloadHexInfoAsync(extInfo)
                        .then(meta => {
                            var origHex = meta.hex
                            meta.hex = compressHex(meta.hex)
                            var store = JSON.stringify(meta)
                            meta.hex = origHex
                            return storeWithLimitAsync(host, "hex-keys", key, store)
                                .then(() => meta)
                        })
                }
            })
    }

    function decompressHex(hex: string[]) {
        var outp: string[] = []

        for (var i = 0; i < hex.length; i++) {
            var m = /^([@!])(....)$/.exec(hex[i])
            if (!m) {
                outp.push(hex[i])
                continue;
            }

            var addr = parseInt(m[2], 16)
            var nxt = hex[++i]
            var buf = ""

            if (m[1] == "@") {
                buf = ""
                var cnt = parseInt(nxt, 16)
                while (cnt-- > 0) {
                    buf += "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0"
                }
            } else {
                buf = atob(nxt)
            }

            Util.assert(buf.length > 0)
            Util.assert(buf.length % 16 == 0)

            for (var j = 0; j < buf.length;) {
                var bytes = [0x10, (addr >> 8) & 0xff, addr & 0xff, 0]
                addr += 16;
                for (var k = 0; k < 16; ++k) {
                    bytes.push(buf.charCodeAt(j++))
                }

                var chk = 0
                for (var k = 0; k < bytes.length; ++k)
                    chk += bytes[k]
                bytes.push((-chk) & 0xff)

                var r = ":"
                for (var k = 0; k < bytes.length; ++k) {
                    var b = bytes[k] & 0xff
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
        var outp: string[] = []

        for (var i = 0; i < hex.length; i += j) {
            var addr = -1;
            var outln = ""
            var j = 0;
            var zeroMode = false;

            while (j < 500) {
                var m = /^:10(....)00(.{32})(..)$/.exec(hex[i + j])
                if (!m)
                    break;

                var h = m[2]
                var isZero = /^0+$/.test(h)
                var newaddr = parseInt(m[1], 16)
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
                    var bin = ""
                    for (var k = 0; k < outln.length; k += 2)
                        bin += String.fromCharCode(parseInt(outln.slice(k, k + 2), 16))
                    outp.push(btoa(bin))
                }
            }
        }

        return outp;
    }

}