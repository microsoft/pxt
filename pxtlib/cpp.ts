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

// preprocess C++ file to find functions exposed to pxt
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
        let sourcePath = "/source/"

        for (let pkg of mainPkg.sortedDeps()) {
            pkg.addSnapshot(pkgSnapshot, [constsName, ".h", ".cpp"])
        }

        if (prevSnapshot && U.stringMapEq(pkgSnapshot, prevSnapshot)) {
            pxt.debug("Using cached extinfo")
            return prevExtInfo
        }

        pxt.debug("Generating new extinfo")
        const res = pxtc.emptyExtInfo();
        const isPlatformio = pxt.appTarget.compileService && !!pxt.appTarget.compileService.platformioIni;
        if (isPlatformio)
            sourcePath = "/src/"

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

        const enumVals: Map<string> = {
            "true": "1",
            "false": "0",
            "null": "0",
            "NULL": "0",
        }

        // we sometimes append _ to C++ names to avoid name clashes
        function toJs(name: string) {
            return name.trim().replace(/[\_\*]$/, "")
        }

        for (const pkg of mainPkg.sortedDeps()) {
            if (pkg.getFiles().indexOf(constsName) >= 0) {
                const src = pkg.host().readFile(pkg, constsName)
                Util.assert(!!src, `${constsName} not found in ${pkg.id}`)
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
            let indexedInstanceAttrs: pxtc.CommentAttrs
            let indexedInstanceIdx = -1

            // replace #if 0 .... #endif with newlines
            src = src.replace(/^\s*#\s*if\s+0\s*$[^]*?^\s*#\s*endif\s*$/mg, f => f.replace(/[^\n]/g, ""))

            function interfaceName() {
                let n = currNs.replace(/Methods$/, "")
                if (n == currNs) return null
                return n
            }

            lineNo = 0

            // the C++ types we can map to TypeScript
            function mapType(tp: string) {
                switch (tp.replace(/\s+/g, "")) {
                    case "void": return "void";
                    // TODO: need int16_t
                    case "int32_t":
                    case "uint32_t":
                    case "unsigned":
                    case "int": return "number";

                    case "uint16_t": return "uint16";

                    case "int16_t":
                    case "short": return "int16";

                    case "uint8_t":
                    case "byte": return "uint8";

                    case "int8_t":
                    case "sbyte": return "int8";

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
                    indexedInstanceAttrs = null
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
                    if (isPlatformio)
                        pointersInc += "PXT_FNPTR(::" + fi.name + "),\n"
                    else
                        pointersInc += "(uint32_t)(void*)::" + fi.name + ",\n"
                    return;
                }

                m = /^\s*(\w+)\s+(\w+)\s*;/.exec(ln)
                if (currAttrs && m) {
                    let parsedAttrs = pxtc.parseCommentString(currAttrs)
                    if (parsedAttrs.indexedInstanceNS) {
                        indexedInstanceAttrs = parsedAttrs
                        shimsDTS.setNs(parsedAttrs.indexedInstanceNS)
                        indexedInstanceIdx = 0
                    }
                    let tp = m[1]
                    let nm = m[2]

                    if (indexedInstanceAttrs) {
                        currAttrs = currAttrs.trim()
                        currAttrs += ` fixedInstance shim=${indexedInstanceAttrs.indexedInstanceShim}(${indexedInstanceIdx++})`
                        shimsDTS.write("")
                        shimsDTS.write(currDocComment)
                        shimsDTS.write(currAttrs)
                        shimsDTS.write(`const ${nm}: ${mapType(tp)};`)
                        currDocComment = ""
                        currAttrs = ""
                        return;
                    }
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

        const currSettings: Map<any> = {}
        const optSettings: Map<any> = {}
        const settingSrc: Map<Package> = {}

        function parseJson(pkg: Package) {
            let j0 = pkg.config.platformio
            if (j0 && j0.dependencies) {
                U.jsonCopyFrom(res.platformio.dependencies, j0.dependencies)
            }

            let json = pkg.config.yotta
            if (!json) return;

            // TODO check for conflicts
            if (json.dependencies) {
                U.jsonCopyFrom(res.yotta.dependencies, json.dependencies)
            }

            if (json.config) {
                const cfg = U.jsonFlatten(json.config)
                for (const settingName of Object.keys(cfg)) {
                    const prev = U.lookup(settingSrc, settingName)
                    const settingValue = cfg[settingName]
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

            if (json.optionalConfig) {
                const cfg = U.jsonFlatten(json.optionalConfig)
                for (const settingName of Object.keys(cfg)) {
                    const settingValue = cfg[settingName];
                    // last one wins
                    optSettings[settingName] = settingValue;
                }
            }
        }


        // This is overridden on the build server, but we need it for command line build
        if (!isPlatformio && pxt.appTarget.compile && pxt.appTarget.compile.hasHex) {
            let cs = pxt.appTarget.compileService
            U.assert(!!cs.yottaCorePackage);
            U.assert(!!cs.githubCorePackage);
            U.assert(!!cs.gittag);
            let tagged = cs.githubCorePackage + "#" + compileService.gittag
            res.yotta.dependencies[cs.yottaCorePackage] = tagged;
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
                        if (pkg.config.name == "core" && isHeader)
                            fullName = fn
                        if (isHeader)
                            includesInc += `#include "${isPlatformio ? "" : sourcePath.slice(1)}${fullName}"\n`
                        let src = pkg.readFile(fn)
                        fileName = fullName
                        // parseCpp() will remove doc comments, to prevent excessive recompilation
                        src = parseCpp(src, isHeader)
                        res.extensionFiles[sourcePath + fullName] = src

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

        // merge optional settings
        U.jsonCopyFrom(optSettings, currSettings);
        const configJson = U.jsonUnFlatten(optSettings)
        if (isPlatformio) {
            const iniLines = pxt.appTarget.compileService.platformioIni.slice()
            // TODO merge configjson
            iniLines.push("lib_deps =")
            U.iterMap(res.platformio.dependencies, (pkg, ver) => {
                let pkgSpec = /[@#\/]/.test(ver) ? ver : pkg + "@" + ver
                iniLines.push("  " + pkgSpec)
            })
            res.generatedFiles["/platformio.ini"] = iniLines.join("\n") + "\n"
        } else {
            res.yotta.config = configJson;
            let name = "pxt-app"
            if (pxt.appTarget.compileService && pxt.appTarget.compileService.yottaBinary)
                name = pxt.appTarget.compileService.yottaBinary
                    .replace(/-combined/, "").replace(/\.hex$/, "")
            let moduleJson = {
                "name": name,
                "version": "0.0.0",
                "description": "Auto-generated. Do not edit.",
                "license": "n/a",
                "dependencies": res.yotta.dependencies,
                "targetDependencies": {},
                "bin": "./source"
            }
            res.generatedFiles["/module.json"] = JSON.stringify(moduleJson, null, 4) + "\n"
        }

        res.generatedFiles[sourcePath + "pointers.cpp"] = includesInc + protos.finish() + pointersInc + "\nPXT_SHIMS_END\n"
        res.generatedFiles["/config.json"] = JSON.stringify(configJson, null, 4) + "\n"
        res.generatedFiles[sourcePath + "main.cpp"] = `
#include "pxt.h"
#ifdef PXT_MAIN
PXT_MAIN
#else
int main() { 
    uBit.init(); 
    pxt::start(); 
    while (1) uBit.sleep(10000);    
    return 0; 
}
#endif
`

        let tmp = res.extensionFiles
        U.jsonCopyFrom(tmp, res.generatedFiles)

        let creq = {
            config: compileService.serviceId,
            tag: compileService.gittag,
            replaceFiles: tmp,
            dependencies: (!isPlatformio ? res.yotta.dependencies : null)
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
            targetVersions?: pxt.TargetVersions;
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

    export function unpackSourceFromHexAsync(dat: Uint8Array): Promise<HexFile> { // string[] (guid)
        let rawEmbed: RawEmbed

        let bin = ts.pxtc.UF2.toBin(dat)
        if (bin) {
            rawEmbed = extractSourceFromBin(bin)
        } else {
            let str = fromUTF8Bytes(dat);
            rawEmbed = extractSource(str || "")
        }

        if (!rawEmbed) return undefined

        if (!rawEmbed.meta || !rawEmbed.text) {
            pxt.debug("This .hex file doesn't contain source.")
            return undefined;
        }

        let hd: {
            compression: string;
            headerSize: number;
            metaSize: number;
            editor: string;
            target?: string;
        } = JSON.parse(rawEmbed.meta)
        if (!hd) {
            pxt.debug("This .hex file is not valid.")
            return undefined;
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
            pxt.debug(`Compression type ${hd.compression} not supported.`)
            return undefined
        } else {
            return Promise.resolve({ source: fromUTF8Bytes(rawEmbed.text) });
        }
    }
}

namespace pxt.hex {
    let downloadCache: Map<Promise<any>> = {};
    let cdnUrlPromise: Promise<string>;

    function downloadHexInfoAsync(extInfo: pxtc.ExtensionInfo) {
        let cachePromise = Promise.resolve();

        if (!downloadCache.hasOwnProperty(extInfo.sha)) {
            cachePromise = downloadHexInfoCoreAsync(extInfo)
                .then((hexFile) => {
                    downloadCache[extInfo.sha] = hexFile;
                });
        }

        return cachePromise
            .then(() => {
                return downloadCache[extInfo.sha];
            });
    }

    function getCdnUrlAsync() {
        if (cdnUrlPromise) return cdnUrlPromise
        else {
            let curr = getOnlineCdnUrl()
            if (curr) return (cdnUrlPromise = Promise.resolve(curr))
            return (cdnUrlPromise = Cloud.privateGetAsync("clientconfig").then(r => r.primaryCdnUrl));
        }
    }

    function downloadHexInfoCoreAsync(extInfo: pxtc.ExtensionInfo) {
        let hexurl = ""

        return downloadHexInfoLocalAsync(extInfo)
            .then((hex) => {
                if (hex) {
                    // Found the hex image in the local server cache, use that
                    return hex;
                }

                return getCdnUrlAsync()
                    .then(url => {
                        hexurl = url + "/compile/" + extInfo.sha
                        return U.httpGetTextAsync(hexurl + ".hex")
                    })
                    .then(r => r, e =>
                        Cloud.privatePostAsync("compile/extension", { data: extInfo.compileData })
                            .then(ret => new Promise<string>((resolve, reject) => {
                                let tryGet = () => {
                                    let url = ret.hex.replace(/\.hex/, ".json")
                                    pxt.log("polling at " + url)
                                    return Util.httpGetJsonAsync(url)
                                        .then(json => {
                                            if (!json.success)
                                                U.userError(JSON.stringify(json, null, 1))
                                            else {
                                                pxt.log("fetching " + hexurl + ".hex")
                                                resolve(U.httpGetTextAsync(hexurl + ".hex"))
                                            }
                                        },
                                        e => {
                                            setTimeout(tryGet, 1000)
                                            return null
                                        })
                                }
                                tryGet();
                            })))
                    .then(text => {
                        return {
                            enums: [],
                            functions: [],
                            hex: text.split(/\r?\n/)
                        };
                    })
            })
    }

    function downloadHexInfoLocalAsync(extInfo: pxtc.ExtensionInfo): Promise<any> {
        if (!Cloud.localToken || !window || !Cloud.isLocalHost()) {
            return Promise.resolve();
        }

        return apiAsync("compile/" + extInfo.sha)
            .then((json) => {
                if (!json || json.notInOfflineCache || !json.hex) {
                    return Promise.resolve();
                }

                json.hex = json.hex.split(/\r?\n/);
                return json;
            })
            .catch((e) => {
                return Promise.resolve();
            });
    }

    function apiAsync(path: string, data?: any) {
        return U.requestAsync({
            url: "/api/" + path,
            headers: { "Authorization": Cloud.localToken },
            method: data ? "POST" : "GET",
            data: data || undefined,
            allowHttpErrors: true
        }).then(r => r.json);
    }

    export function storeWithLimitAsync(host: Host, idxkey: string, newkey: string, newval: string, maxLen = 10) {
        return host.cacheStoreAsync(newkey, newval)
            .then(() => host.cacheGetAsync(idxkey))
            .then(res => {
                let keys: string[];
                try { keys = JSON.parse(res || "[]") }
                catch (e) {
                    // cache entry is corrupted, clear cache so that it gets rebuilt
                    console.error('invalid cache entry, clearing entry');
                    keys = [];
                }
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
                let keys: string[];
                try { keys = JSON.parse(res || "[]") }
                catch (e) {
                    // cache entry is corrupted, clear cache so that it gets rebuilt
                    console.error('invalid cache entry, clearing entry');
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

    export function getHexInfoAsync(host: Host, extInfo: pxtc.ExtensionInfo, cloudModule?: any): Promise<pxtc.HexInfo> {
        if (!extInfo.sha)
            return Promise.resolve<any>(null)

        if (pxtc.hex.isSetupFor(extInfo))
            return Promise.resolve(pxtc.hex.currentHexInfo)

        pxt.debug("get hex info: " + extInfo.sha)

        let key = "hex-" + extInfo.sha
        return host.cacheGetAsync(key)
            .then(res => {
                let cachedMeta: any;
                try { cachedMeta = res ? JSON.parse(res) : null }
                catch (e) {
                    // cache entry is corrupted, clear cache so that it gets rebuilt
                    console.log('invalid cache entry, clearing entry');
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
