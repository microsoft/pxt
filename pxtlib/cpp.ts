/// <reference path="../built/pxtarget.d.ts"/>
/// <reference path="emitter/util.ts"/>

namespace pxt {
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

namespace pxt.cpp {
    import U = pxtc.Util;
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

    export function nsWriter(nskw = "namespace") {
        let text = ""
        let currNs = ""
        let setNs = (ns: string, over = "") => {
            if (currNs == ns) return
            if (currNs) text += "}\n"
            if (ns)
                text += over || (nskw + " " + ns + " {\n")
            currNs = ns
        }
        let indent = "    "
        return {
            setNs,
            clear: () => {
                text = ""
                currNs = ""
            },
            write: (s: string) => {
                if (!s.trim()) text += "\n"
                else {
                    s = s.trim()
                        .replace(/^\s*/mg, indent)
                        .replace(/^(\s*)\*/mg, (f, s) => s + " *")
                    text += s + "\n"
                }
            },
            incrIndent: () => {
                indent += "    "
            },
            decrIndent: () => {
                indent = indent.slice(4)
            },
            finish: () => {
                setNs("")
                return text
            }
        }
    }

    export function parseCppInt(v: string): number {
        if (!v) return null
        v = v.trim()
        if (/^-?(\d+|0[xX][0-9a-fA-F]+)$/.test(v))
            return parseInt(v)
        return null
    }

    let prevExtInfo: pxtc.ExtensionInfo;
    let prevSnapshot: Map<string>;

    export class PkgConflictError extends Error {
        pkg0: Package;
        pkg1: Package;
        settingName: string;
        isUserError: boolean;

        constructor(msg: string) {
            super(msg)
            this.isUserError = true
            this.message = msg
        }
    }

    export function getExtensionInfo(mainPkg: MainPackage): pxtc.ExtensionInfo {
        let pkgSnapshot: Map<string> = {}
        let constsName = "dal.d.ts"

        for (let pkg of mainPkg.sortedDeps()) {
            pkg.addSnapshot(pkgSnapshot, [constsName, ".h", ".cpp"])
        }

        if (prevSnapshot && U.stringMapEq(pkgSnapshot, prevSnapshot)) {
            pxt.debug("Using cached extinfo")
            return prevExtInfo
        }

        pxt.debug("Generating new extinfo")

        let res = pxtc.emptyExtInfo();
        let pointersInc = "\nPXT_SHIMS_BEGIN\n"
        let includesInc = `#include "pxt.h"\n`
        let thisErrors = ""
        let dTsNamespace = ""
        let err = (s: string) => thisErrors += `   ${fileName}(${lineNo}): ${s}\n`;
        let lineNo = 0
        let fileName = ""
        let protos = nsWriter("namespace")
        let shimsDTS = nsWriter("declare namespace")
        let enumsDTS = nsWriter("declare namespace")
        let allErrors = ""

        let compileService = appTarget.compileService;
        if (!compileService)
            compileService = {
                gittag: "none",
                serviceId: "nocompile"
            }

        let enumVals: Map<string> = {
            "true": "1",
            "false": "0",
            "null": "0",
            "NULL": "0",
        }

        // we sometimes append _ to C++ names to avoid name clashes
        function toJs(name: string) {
            return name.trim().replace(/_$/, "")
        }

        for (let pkg of mainPkg.sortedDeps()) {
            if (pkg.getFiles().indexOf(constsName) >= 0) {
                let src = pkg.host().readFile(pkg, constsName)
                src.split(/\r?\n/).forEach(ln => {
                    let m = /^\s*(\w+) = (.*),/.exec(ln)
                    if (m) {
                        enumVals[m[1]] = m[2]
                    }
                })
            }
        }

        function parseCpp(src: string, isHeader: boolean) {
            let currNs = ""
            let currDocComment = ""
            let currAttrs = ""
            let inDocComment = false

            function interfaceName() {
                let n = currNs.replace(/Methods$/, "")
                if (n == currNs) return null
                return n
            }

            lineNo = 0

            function mapType(tp: string) {
                switch (tp.replace(/\s+/g, "")) {
                    case "void": return "void";
                    case "int32_t":
                    case "uint32_t":
                    case "int": return "number";
                    case "bool": return "boolean";
                    case "StringData*": return "string";
                    case "ImageLiteral": return "string";
                    case "Action": return "() => void";
                    default:
                        return toJs(tp);
                    //err("Don't know how to map type: " + tp)
                    //return "any"
                }
            }

            let outp = ""
            let inEnum = false
            let enumVal = 0

            enumsDTS.setNs("")
            shimsDTS.setNs("")

            src.split(/\r?\n/).forEach(ln => {
                ++lineNo

                let lnNC = ln.replace(/\/\/.*/, "").replace(/\/\*/, "")

                if (inEnum && lnNC.indexOf("}") >= 0) {
                    inEnum = false
                    enumsDTS.write("}")
                }

                if (inEnum) {
                    let mm = /^\s*(\w+)\s*(=\s*(.*?))?,?\s*$/.exec(lnNC)
                    if (mm) {
                        let nm = mm[1]
                        let v = mm[3]
                        let opt = ""
                        if (v) {
                            v = v.trim()
                            let curr = U.lookup(enumVals, v)
                            if (curr != null) {
                                opt = "  // " + v
                                v = curr
                            }
                            enumVal = parseCppInt(v)
                            if (enumVal == null)
                                err("cannot determine value of " + lnNC)
                        } else {
                            enumVal++
                            v = enumVal + ""
                        }
                        enumsDTS.write(`    ${toJs(nm)} = ${v},${opt}`)
                    } else {
                        enumsDTS.write(ln)
                    }
                }

                let enM = /^\s*enum\s+(|class\s+|struct\s+)(\w+)\s*({|$)/.exec(lnNC)
                if (enM) {
                    inEnum = true
                    enumVal = -1
                    enumsDTS.write("")
                    enumsDTS.write("")
                    if (currAttrs || currDocComment) {
                        enumsDTS.write(currDocComment)
                        enumsDTS.write(currAttrs)
                        currAttrs = ""
                        currDocComment = ""
                    }
                    enumsDTS.write(`declare enum ${toJs(enM[2])} ${enM[3]}`)

                    if (!isHeader) {
                        protos.setNs(currNs)
                        protos.write(`enum ${enM[2]} : int;`)
                    }
                }

                if (inEnum) {
                    outp += ln + "\n"
                    return
                }

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

                if (/^typedef.*;\s*$/.test(ln)) {
                    protos.setNs(currNs);
                    protos.write(ln);
                }

                let m = /^\s*namespace\s+(\w+)/.exec(ln)
                if (m) {
                    //if (currNs) err("more than one namespace declaration not supported")
                    currNs = m[1]
                    if (interfaceName()) {
                        shimsDTS.setNs("");
                        shimsDTS.write("")
                        shimsDTS.write("")
                        if (currAttrs || currDocComment) {
                            shimsDTS.write(currDocComment)
                            shimsDTS.write(currAttrs)
                            currAttrs = ""
                            currDocComment = ""
                        }
                        let tpName = interfaceName()
                        shimsDTS.setNs(currNs, `declare interface ${tpName} {`)
                    } else if (currAttrs || currDocComment) {
                        shimsDTS.setNs("");
                        shimsDTS.write("")
                        shimsDTS.write("")
                        shimsDTS.write(currDocComment)
                        shimsDTS.write(currAttrs)
                        shimsDTS.setNs(toJs(currNs))
                        enumsDTS.setNs(toJs(currNs))
                        currAttrs = ""
                        currDocComment = ""
                    }
                    return;
                }

                m = /^\s*(\w+)([\*\&]*\s+[\*\&]*)(\w+)\s*\(([^\(\)]*)\)\s*(;\s*$|\{|$)/.exec(ln)
                if (currAttrs && m) {
                    let parsedAttrs = pxtc.parseCommentString(currAttrs)
                    if (!currNs) err("missing namespace declaration");
                    let retTp = (m[1] + m[2]).replace(/\s+/g, "")
                    let funName = m[3]
                    let origArgs = m[4]
                    currAttrs = currAttrs.trim().replace(/ \w+\.defl=\w+/g, "")
                    let args = origArgs.split(/,/).filter(s => !!s).map(s => {
                        s = s.trim()
                        let m = /(.*)=\s*(-?\w+)$/.exec(s)
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

                        let argName = m[2]

                        if (parsedAttrs.paramDefl[argName]) {
                            defl = parsedAttrs.paramDefl[argName]
                            qm = "?"
                        }

                        let numVal = defl ? U.lookup(enumVals, defl) : null
                        if (numVal != null)
                            defl = numVal

                        if (defl) {
                            if (parseCppInt(defl) == null)
                                err("Invalid default value (non-integer): " + defl)
                            currAttrs += ` ${argName}.defl=${defl}`
                        }

                        return `${argName}${qm}: ${mapType(m[1])}`
                    })
                    let numArgs = args.length
                    let fi: pxtc.FuncInfo = {
                        name: currNs + "::" + funName,
                        type: retTp == "void" ? "P" : "F",
                        args: numArgs,
                        value: null
                    }
                    if (currDocComment) {
                        shimsDTS.setNs(toJs(currNs))
                        shimsDTS.write("")
                        shimsDTS.write(currDocComment)
                        if (/ImageLiteral/.test(m[4]) && !/imageLiteral=/.test(currAttrs))
                            currAttrs += ` imageLiteral=1`
                        currAttrs += ` shim=${fi.name}`
                        shimsDTS.write(currAttrs)
                        funName = toJs(funName)
                        if (interfaceName()) {
                            let tp0 = (args[0] || "").replace(/^.*:\s*/, "").trim()
                            if (tp0.toLowerCase() != interfaceName().toLowerCase()) {
                                err(lf("Invalid first argument; should be of type '{0}', but is '{1}'", interfaceName(), tp0))
                            }
                            args.shift()
                            if (args.length == 0 && /\bproperty\b/.test(currAttrs))
                                shimsDTS.write(`${funName}: ${mapType(retTp)};`)
                            else
                                shimsDTS.write(`${funName}(${args.join(", ")}): ${mapType(retTp)};`)
                        } else {
                            shimsDTS.write(`function ${funName}(${args.join(", ")}): ${mapType(retTp)};`)
                        }

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
                    currAttrs = ""
                    currDocComment = ""
                    return;
                }
            })

            return outp
        }

        let currSettings: Map<any> = {}
        let settingSrc: Map<Package> = {}

        function parseJson(pkg: Package) {
            let json = pkg.config.yotta
            if (!json) return;

            // TODO check for conflicts
            if (json.dependencies) {
                U.jsonCopyFrom(res.yotta.dependencies, json.dependencies)
            }

            if (json.config) {
                let cfg = U.jsonFlatten(json.config)
                for (let settingName of Object.keys(cfg)) {
                    let prev = U.lookup(settingSrc, settingName)
                    let settingValue = cfg[settingName]
                    if (!prev || prev.config.yotta.configIsJustDefaults) {
                        settingSrc[settingName] = pkg
                        currSettings[settingName] = settingValue
                    } else if (currSettings[settingName] === settingValue) {
                        // OK
                    } else if (!pkg.parent.config.yotta || !pkg.parent.config.yotta.ignoreConflicts) {
                        let err = new PkgConflictError(lf("conflict on yotta setting {0} between packages {1} and {2}",
                            settingName, pkg.id, prev.id))
                        err.pkg0 = prev
                        err.pkg1 = pkg
                        err.settingName = settingName
                        throw err;
                    }
                }
            }
        }


        // This is overridden on the build server, but we need it for command line build
        if (pxt.appTarget.compile && pxt.appTarget.compile.hasHex) {
            U.assert(!!pxt.appTarget.compileService.yottaCorePackage);
            U.assert(!!pxt.appTarget.compileService.githubCorePackage);
            U.assert(!!pxt.appTarget.compileService.gittag);
            res.yotta.dependencies[pxt.appTarget.compileService.yottaCorePackage] = pxt.appTarget.compileService.githubCorePackage + "#" + compileService.gittag;
        }

        if (mainPkg) {
            let seenMain = false

            // TODO computeReachableNodes(pkg, true)
            for (let pkg of mainPkg.sortedDeps()) {
                thisErrors = ""
                parseJson(pkg)
                if (pkg == mainPkg) {
                    seenMain = true
                    // we only want the main package in generated .d.ts
                    shimsDTS.clear()
                    enumsDTS.clear()
                } else {
                    U.assert(!seenMain)
                }
                for (let fn of pkg.getFiles()) {
                    let isHeader = U.endsWith(fn, ".h")
                    if (isHeader || U.endsWith(fn, ".cpp")) {
                        let fullName = pkg.config.name + "/" + fn
                        if (isHeader)
                            includesInc += `#include "source/${fullName}"\n`
                        let src = pkg.readFile(fn)
                        fileName = fullName
                        // parseCpp() will remove doc comments, to prevent excessive recompilation
                        src = parseCpp(src, isHeader)
                        res.extensionFiles["/source/" + fullName] = src

                        if (pkg.level == 0)
                            res.onlyPublic = false
                        if (pkg.verProtocol() && pkg.verProtocol() != "pub" && pkg.verProtocol() != "embed")
                            res.onlyPublic = false
                    }
                }
                if (thisErrors) {
                    allErrors += lf("Package {0}:\n", pkg.id) + thisErrors
                }
            }
        }

        if (allErrors)
            U.userError(allErrors)

        res.yotta.config = U.jsonUnFlatten(currSettings)
        let configJson = res.yotta.config
        let moduleJson = {
            "name": "pxt-microbit-app",
            "version": "0.0.0",
            "description": "Auto-generated. Do not edit.",
            "license": "n/a",
            "dependencies": res.yotta.dependencies,
            "targetDependencies": {},
            "bin": "./source"
        }
        res.generatedFiles["/source/pointers.cpp"] = includesInc + protos.finish() + pointersInc + "\nPXT_SHIMS_END\n"
        res.generatedFiles["/module.json"] = JSON.stringify(moduleJson, null, 4) + "\n"
        res.generatedFiles["/config.json"] = JSON.stringify(configJson, null, 4) + "\n"
        res.generatedFiles["/source/main.cpp"] = `
#include "pxt.h"
int main() { 
    uBit.init(); 
    pxt::start(); 
    while (1) uBit.sleep(10000);    
    return 0; 
}
`

        let tmp = res.extensionFiles
        U.jsonCopyFrom(tmp, res.generatedFiles)

        let creq = {
            config: compileService.serviceId,
            tag: compileService.gittag,
            replaceFiles: tmp,
            dependencies: res.yotta.dependencies,
        }

        let data = JSON.stringify(creq)
        res.sha = U.sha256(data)
        res.compileData = btoa(U.toUTF8(data))
        res.shimsDTS = shimsDTS.finish()
        res.enumsDTS = enumsDTS.finish()

        prevSnapshot = pkgSnapshot
        prevExtInfo = res

        return res;
    }

    function fileReadAsArrayBufferAsync(f: File): Promise<ArrayBuffer> { // ArrayBuffer
        if (!f)
            return Promise.resolve<ArrayBuffer>(null);
        else {
            return new Promise<ArrayBuffer>((resolve, reject) => {
                let reader = new FileReader();
                reader.onerror = (ev) => resolve(null);
                reader.onload = (ev) => resolve(reader.result);
                reader.readAsArrayBuffer(f);
            });
        }
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

    function extractSource(hexfile: string): { meta: string; text: Uint8Array; } {
        if (!hexfile) return undefined;

        let metaLen = 0
        let textLen = 0
        let toGo = 0
        let buf: number[];
        let ptr = 0;
        hexfile.split(/\r?\n/).forEach(ln => {
            let m = /^:10....0041140E2FB82FA2BB(....)(....)(....)(....)(..)/.exec(ln)
            if (m) {
                metaLen = parseInt(swapBytes(m[1]), 16)
                textLen = parseInt(swapBytes(m[2]), 16)
                toGo = metaLen + textLen
                buf = <any>new Uint8Array(toGo)
            } else if (toGo > 0) {
                m = /^:10....00(.*)(..)$/.exec(ln)
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

    export interface HexFile {
        meta?: {
            cloudId: string;
            targetVersion?: string;
            editor: string;
            name: string;
        };
        source: string;
    }

    export function unpackSourceFromHexFileAsync(file: File): Promise<HexFile> { // string[] (guid)
        if (!file) return undefined;

        return fileReadAsArrayBufferAsync(file).then(data => {
            let a = new Uint8Array(data);
            return unpackSourceFromHexAsync(a);
        });
    }

    export function unpackSourceFromHexAsync(dat: ArrayLike<number>): Promise<HexFile> { // string[] (guid)
        let str = fromUTF8Bytes(dat);
        let tmp = extractSource(str || "")
        if (!tmp) return undefined

        if (!tmp.meta || !tmp.text) {
            pxt.debug("This .hex file doesn't contain source.")
            return undefined;
        }

        let hd: { compression: string; headerSize: number; metaSize: number; editor: string; target?: string; } = JSON.parse(tmp.meta)
        if (!hd) {
            pxt.debug("This .hex file is not valid.")
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
            pxt.debug(lf("Compression type {0} not supported.", hd.compression))
            return undefined
        } else {
            return Promise.resolve({ source: fromUTF8Bytes(tmp.text) });
        }
    }
}

namespace pxt.hex {
    let downloadCache: Map<Promise<any>> = {};
    let cdnUrlPromise: Promise<string>;

    function downloadHexInfoAsync(extInfo: pxtc.ExtensionInfo) {
        if (downloadCache.hasOwnProperty(extInfo.sha))
            return downloadCache[extInfo.sha]
        return (downloadCache[extInfo.sha] = downloadHexInfoCoreAsync(extInfo))
    }

    function getCdnUrlAsync() {
        if (cdnUrlPromise) return cdnUrlPromise
        else return (cdnUrlPromise = Cloud.privateGetAsync("clientconfig").then(r => r.primaryCdnUrl));
    }

    function downloadHexInfoCoreAsync(extInfo: pxtc.ExtensionInfo) {
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

    export function getHexInfoAsync(host: Host, extInfo: pxtc.ExtensionInfo): Promise<any> {
        if (!extInfo.sha)
            return Promise.resolve(null)

        if (pxtc.hex.isSetupFor(extInfo))
            return Promise.resolve(pxtc.hex.currentHexInfo)

        pxt.debug("get hex info: " + extInfo.sha)

        let key = "hex-" + extInfo.sha
        return host.cacheGetAsync(key)
            .then(res => {
                if (res) {
                    pxt.debug("cache hit, size=" + res.length)
                    let meta = JSON.parse(res)
                    meta.hex = decompressHex(meta.hex)
                    return recordGetAsync(host, "hex-keys", key)
                        .then(() => meta)
                }
                else {
                    return downloadHexInfoAsync(extInfo)
                        .then(meta => {
                            let origHex = meta.hex
                            meta.hex = compressHex(meta.hex)
                            let store = JSON.stringify(meta)
                            meta.hex = origHex
                            return storeWithLimitAsync(host, "hex-keys", key, store)
                                .then(() => meta)
                        }).catch(e => {
                            pxt.reportException(e, { sha: extInfo.sha });
                            return Promise.resolve(null);
                        })
                }
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
                    buf += "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0"
                }
            } else {
                buf = pxtc.decodeBase64(nxt)
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
                    outp.push(btoa(bin))
                }
            }
        }

        return outp;
    }

}