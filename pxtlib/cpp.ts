/// <reference path="../localtypings/pxtarget.d.ts"/>

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

    const vmKeepFunctions: pxt.Map<number> = {
        "pxt::mkAction": 1,
        "pxt::dumpPerfCounters": 1,
        "pxt::deepSleep": 1,
        "pxt::getConfig": 1,

        "pxtrt::mkMap": 1,
        "pxtrt::mapSet": 1,
        "pxtrt::stclo": 1,
        "pxtrt::mklocRef": 1,
        "pxtrt::stlocRef": 1,
        "pxtrt::ldlocRef": 1,
        "pxtrt::panic": 1,
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
        let mm = /^\((.*)\)/.exec(v)
        if (mm) v = mm[1]
        if (/^-?(\d+|0[xX][0-9a-fA-F]+)$/.test(v))
            return parseInt(v)
        return null
    }

    let prevExtInfos: Map<pxtc.ExtensionInfo> = {};

    export class PkgConflictError extends Error {
        pkg0: Package;
        pkg1: Package;
        settingName: string;
        isUserError: boolean;
        isVersionConflict: boolean;

        constructor(msg: string) {
            super(msg)
            this.isUserError = true
            this.message = msg
        }
    }

    export function getExtensionInfo(mainPkg: MainPackage): pxtc.ExtensionInfo {
        const pkgSnapshot: Map<string> = {
            "__appVariant": pxt.appTargetVariant || ""
        }
        const constsName = "dal.d.ts"
        let sourcePath = "/source/"
        let disabledDeps = ""
        let mainDeps: Package[] = []

        // order shouldn't matter for c++ compilation,
        // so use a stable order to prevent order changes from fetching a new hex file
        const mainPkgDeps = mainPkg.sortedDeps(true)
            .sort((a, b) => {
                if (a.id == "this") return 1;
                else if (b.id == "this") return -1;
                else return U.strcmp(a.id, b.id);
            });

        for (let pkg of mainPkgDeps) {
            if (pkg.disablesVariant(pxt.appTargetVariant) ||
                pkg.resolvedDependencies().some(d => d.disablesVariant(pxt.appTargetVariant))) {
                if (disabledDeps)
                    disabledDeps += ", "
                disabledDeps += pkg.id
                pxt.debug(`disable variant ${pxt.appTargetVariant} due to ${pkg.id}`)
                continue
            }
            mainDeps.push(pkg)
            pkg.addSnapshot(pkgSnapshot, [constsName, ".h", ".cpp"])
        }

        const key = JSON.stringify(pkgSnapshot)
        const prevInfo = prevExtInfos[key]
        if (prevInfo) {
            pxt.debug("Using cached extinfo")
            const r = U.flatClone(prevInfo)
            r.disabledDeps = disabledDeps
            return r
        }

        pxt.debug("Generating new extinfo")
        const res = pxtc.emptyExtInfo();

        res.disabledDeps = disabledDeps

        let compileService = appTarget.compileService;
        if (!compileService)
            compileService = {
                gittag: "none",
                serviceId: "nocompile"
            }
        compileService = U.clone(compileService)

        let compile = mainPkg.getTargetOptions()
        if (!compile)
            compile = {
                isNative: false,
                hasHex: false,
                switches: {}
            }

        const isPlatformio = !!compileService.platformioIni;
        const isCodal = compileService.buildEngine == "codal" || compileService.buildEngine == "dockercodal"
        const isDockerMake = compileService.buildEngine == "dockermake" || compileService.buildEngine == "dockercross"
        const isEspIdf = compileService.buildEngine == "dockerespidf"
        const isYotta = !isPlatformio && !isCodal && !isDockerMake && !isEspIdf
        const isVM = compile.nativeType == pxtc.NATIVE_TYPE_VM
        if (isPlatformio)
            sourcePath = "/src/"
        else if (isCodal || isDockerMake)
            sourcePath = "/pxtapp/"
        else if (isEspIdf)
            sourcePath = "/main/"

        let pxtConfig = "// Configuration defines\n"
        let pointersInc = "\nPXT_SHIMS_BEGIN\n"
        let pointerIncPre = ""
        let abiInc = ""
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
        let knownEnums: Map<boolean> = {}
        let vmVisitedFunctions: Map<boolean> = {}


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

        for (const pkg of mainDeps) {
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

            for (const fn of pkg.getFiles()) {
                if (["Makefile", "sdkconfig.defaults", "CMakeLists.txt"].indexOf(fn) >= 0 || U.endsWith(fn, ".mk")) {
                    res.generatedFiles["/" + fn] = pkg.host().readFile(pkg, fn)
                }
            }
        }

        let hash_if_options = ["0", "false", "PXT_UTF8"]

        let cpp_options: pxt.Map<number> = {}
        if (compile.switches.boxDebug)
            cpp_options["PXT_BOX_DEBUG"] = 1

        if (compile.utf8)
            cpp_options["PXT_UTF8"] = 1

        if (compile.switches.profile)
            cpp_options["PXT_PROFILE"] = 1

        if (compile.switches.gcDebug)
            cpp_options["PXT_GC_DEBUG"] = 1

        if (compile.switches.numFloat)
            cpp_options["PXT_USE_FLOAT"] = 1

        if (compile.nativeType == pxtc.NATIVE_TYPE_VM)
            cpp_options["PXT_VM"] = 1

        function stripComments(ln: string) {
            return ln.replace(/\/\/.*/, "").replace(/\/\*/, "")
        }

        let enumVal = 0
        let inEnum = false
        let currNs = ""
        let currDocComment = ""
        let currAttrs = ""
        let inDocComment = false

        function handleComments(ln: string) {
            if (inEnum)
                return true

            if (/^\s*\/\*\*/.test(ln)) {
                inDocComment = true
                currDocComment = ln + "\n"
                if (/\*\//.test(ln)) inDocComment = false
                return true
            }

            if (inDocComment) {
                currDocComment += ln + "\n"
                if (/\*\//.test(ln)) {
                    inDocComment = false
                }
                return true
            }

            if (/^\s*\/\/%/.test(ln)) {
                currAttrs += ln + "\n"
                return true
            }

            return false
        }

        function enterEnum(cpname: string, brace: string) {
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
            enumsDTS.write(`declare const enum ${toJs(cpname)} ${brace}`)

            knownEnums[cpname] = true
        }

        function processEnumLine(ln: string) {
            let lnNC = stripComments(ln)
            if (inEnum && lnNC.indexOf("}") >= 0) {
                inEnum = false
                enumsDTS.write("}")
            }

            if (!inEnum)
                return

            // parse the enum case, with lots of optional stuff (?)
            let mm = /^\s*(\w+)\s*(=\s*(.*?))?,?\s*$/.exec(lnNC)
            if (mm) {
                let nm = mm[1]
                let v = mm[3]
                let opt = ""
                if (v) {
                    // user-supplied value
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
                    // no user-supplied value
                    enumVal++
                    v = enumVal + ""
                }
                enumsDTS.write(`    ${toJs(nm)} = ${v},${opt}`)
            } else {
                enumsDTS.write(ln)
            }
        }

        function finishNamespace() {
            shimsDTS.setNs("");
            shimsDTS.write("")
            shimsDTS.write("")
            if (currAttrs || currDocComment) {
                shimsDTS.write(currDocComment)
                shimsDTS.write(currAttrs)
                currAttrs = ""
                currDocComment = ""
            }
        }

        function parseArg(parsedAttrs: pxtc.CommentAttrs, s: string) {
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
                return {
                    name: "???",
                    type: "int"
                }
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

            return {
                name: argName + qm,
                type: m[1]
            }
        }


        function parseCpp(src: string, isHeader: boolean) {
            currNs = ""
            currDocComment = ""
            currAttrs = ""
            inDocComment = false

            let indexedInstanceAttrs: pxtc.CommentAttrs
            let indexedInstanceIdx = -1

            // replace #if 0 .... #endif with newlines
            src = src.replace(/^(\s*#\s*if\s+(\w+)\s*$)([^]*?)(^\s*#\s*(elif|else|endif)\s*$)/mg,
                (f, _if, arg, middle, _endif) =>
                    hash_if_options.indexOf(arg) >= 0 && !cpp_options[arg] ?
                        _if + middle.replace(/[^\n]/g, "") + _endif : f)

            // special handling of C++ namespace that ends with Methods (e.g. FooMethods)
            // such a namespace will be converted into a TypeScript interface
            // this enables simple objects with methods to be defined. See, for example:
            // https://github.com/microsoft/pxt-microbit/blob/master/libs/core/buffer.cpp
            // within that namespace, the first parameter of each function should have
            // the type Foo
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
                    case "int":
                        return "int32";

                    case "uint32_t":
                    case "unsigned":
                        return "uint32";

                    case "TNumber":
                    case "float":
                    case "double":
                        return "number";

                    case "uint16_t": return "uint16";

                    case "int16_t":
                    case "short": return "int16";

                    case "uint8_t":
                    case "byte": return "uint8";

                    case "int8_t":
                    case "sbyte": return "int8";

                    case "bool":
                        if (compile.shortPointers)
                            err("use 'boolean' not 'bool' on 8 bit targets")
                        return "boolean";
                    case "StringData*": return "string";
                    case "String": return "string";
                    case "ImageLiteral_": return "string";
                    case "ImageLiteral": return "string";
                    case "Action": return "() => void";

                    case "TValue": return "any";
                    default:
                        return toJs(tp);
                    //err("Don't know how to map type: " + tp)
                    //return "any"
                }
            }

            function mapRunTimeType(tp: string) {
                tp = tp.replace(/\s+/g, "")
                switch (tp) {
                    case "int32_t":
                    case "uint32_t":
                    case "unsigned":
                    case "uint16_t":
                    case "int16_t":
                    case "short":
                    case "uint8_t":
                    case "byte":
                    case "int8_t":
                    case "sbyte":
                    case "int":
                    case "ramint_t":
                        return "I";

                    case "void": return "V";
                    case "float": return "F";
                    case "TNumber": return "N";
                    case "TValue": return "T";
                    case "bool": return "B";
                    case "double": return "D"

                    case "ImageLiteral_":
                        return "T"

                    case "String":
                        return "S"

                    default:
                        if (U.lookup(knownEnums, tp))
                            return "I"
                        return "_" + tp.replace(/[\*_]+$/, "");
                }
            }

            function generateVMWrapper(fi: pxtc.FuncInfo, argTypes: string[]) {
                if (argTypes[0] == "FiberContext*")
                    return "::" + fi.name // no wrapper

                let wrap = "_wrp_" + fi.name.replace(/:/g, "_")
                if (vmVisitedFunctions[fi.name])
                    return wrap
                vmVisitedFunctions[fi.name] = true
                /*
                void call_getConfig(FiberContext *ctx) {
                    int a0 = toInt(ctx->sp[0]);
                    int a1 = toInt(ctx->r0); // last argument in r0
                    int r = getConfig(a0, a1);
                    ctx->r0 = fromInt(r);
                    ctx->sp += 1;
                }
                */
                pointerIncPre += `\nvoid ${wrap}(FiberContext *ctx) {\n`
                const numArgs = argTypes.length
                let refs: string[] = []
                let needsStackSave = false

                let allConvs = ""

                for (let i = 0; i < numArgs; ++i) {
                    const ind = fi.argsFmt[i + 1]
                    const tp = argTypes[i]
                    let conv =
                        ind == "I" ? "toInt" :
                            ind == "B" ? "numops::toBool" :
                                ""
                    const inp = i == numArgs - 1 ? "ctx->r0" : `ctx->sp[${numArgs - i - 2}]`
                    let argPref = ""

                    switch (tp) {
                        case "TValue":
                        case "TNumber":
                            break
                        case "Action":
                            conv = "asRefAction"
                            break
                        case "String":
                            conv = "convertToString"
                            argPref = "ctx, "
                            needsStackSave = true
                            break
                        default:
                            if (!conv) conv = "as" + tp.replace(/\*/g, "")
                            break
                    }

                    allConvs += `  ${tp} a${i} = (${tp}) ${conv}(${argPref}${inp});\n`
                    refs.push("a" + i)
                }

                if (needsStackSave)
                    pointerIncPre += "  auto prevSP = ctx->sp;\n"

                pointerIncPre += allConvs

                if (needsStackSave)
                    pointerIncPre += "  if (panicCode) { ctx->sp = prevSP; return; }\n"

                const call = `::${fi.name}(${refs.join(", ")})`

                if (fi.argsFmt[0] == "V") {
                    pointerIncPre += `  ${call};\n`
                    pointerIncPre += `  ctx->r0 = NULL;\n`
                } else if (fi.argsFmt[0] == "I") {
                    pointerIncPre += `  ctx->r0 = fromInt(${call});\n`
                } else if (fi.argsFmt[0] == "B") {
                    pointerIncPre += `  ctx->r0 = fromBool(${call});\n`
                } else {
                    pointerIncPre += `  ctx->r0 = (TValue)${call};\n`
                }

                if (needsStackSave)
                    pointerIncPre += "  ctx->sp = prevSP;\n"

                if (numArgs > 1)
                    pointerIncPre += `  ctx->sp += ${numArgs - 1};\n`
                pointerIncPre += `}\n`

                return wrap
            }

            inEnum = false
            enumVal = 0

            enumsDTS.setNs("")
            shimsDTS.setNs("")

            src.split(/\r?\n/).forEach(ln => {
                ++lineNo

                // remove comments (NC = no comments)
                let lnNC = stripComments(ln)

                processEnumLine(ln)

                // "enum class" and "enum struct" is C++ syntax to force scoping of
                // enum members
                let enM = /^\s*enum\s+(|class\s+|struct\s+)(\w+)\s*({|$)/.exec(lnNC)
                if (enM) {
                    enterEnum(enM[2], enM[3])

                    if (!isHeader) {
                        protos.setNs(currNs)
                        protos.write(`enum ${enM[2]} : int;`)
                    }
                }

                if (handleComments(ln))
                    return

                if (/^typedef.*;\s*$/.test(ln)) {
                    protos.setNs(currNs);
                    protos.write(ln);
                }

                let m = /^\s*namespace\s+(\w+)/.exec(ln)
                if (m) {
                    //if (currNs) err("more than one namespace declaration not supported")
                    currNs = m[1]
                    if (interfaceName()) {
                        finishNamespace()
                        let tpName = interfaceName()
                        shimsDTS.setNs(currNs, `declare interface ${tpName} {`)
                    } else if (currAttrs || currDocComment) {
                        finishNamespace()
                        shimsDTS.setNs(toJs(currNs))
                        enumsDTS.setNs(toJs(currNs))
                    }
                    return
                }

                m = /^PXT_ABI\((\w+)\)/.exec(ln)
                if (m && !isVM) {
                    pointersInc += `PXT_FNPTR(::${m[1]}),\n`
                    abiInc += `extern "C" void ${m[1]}();\n`
                    res.functions.push({
                        name: m[1],
                        argsFmt: [],
                        value: 0
                    })
                }

                m = /^\s*PXT_EXPORT\(([:\&\w]+)\)/.exec(ln)
                if (m) {
                    if (!res.vmPointers)
                        res.vmPointers = []
                    res.vmPointers.push(m[1])
                }

                m = /^#define\s+PXT_COMM_BASE\s+([0-9a-fx]+)/.exec(ln)
                if (m)
                    res.commBase = parseInt(m[1])

                // function definition
                m = /^\s*(\w+)([\*\&]*\s+[\*\&]*)(\w+)\s*\(([^\(\)]*)\)\s*(;\s*$|\{|$)/.exec(ln)
                if (currAttrs && m) {
                    indexedInstanceAttrs = null
                    let parsedAttrs = pxtc.parseCommentString(currAttrs)
                    // top-level functions (outside of a namespace) are not permitted
                    if (!currNs) err("missing namespace declaration");
                    let retTp = (m[1] + m[2]).replace(/\s+/g, "")
                    let funName = m[3]
                    let origArgs = m[4]
                    currAttrs = currAttrs.trim().replace(/ \w+\.defl=\w+/g, "")
                    let argsFmt = [mapRunTimeType(retTp)]
                    let argTypes: string[] = []
                    let args = origArgs.split(/,/).filter(s => !!s).map(s => {
                        let r = parseArg(parsedAttrs, s)
                        argsFmt.push(mapRunTimeType(r.type))
                        argTypes.push(r.type.replace(/ /g, ""))
                        return `${r.name}: ${mapType(r.type)}`
                    })
                    let fi: pxtc.FuncInfo = {
                        name: currNs + "::" + funName,
                        argsFmt,
                        value: null
                    }
                    //pxt.log(`${ln.trim()} : ${argsFmt}`)
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
                    if (isYotta)
                        pointersInc += "(uint32_t)(void*)::" + fi.name + ",\n"
                    else if (isVM) {
                        if (U.startsWith(fi.name, "pxt::op_") ||
                            vmKeepFunctions[fi.name] ||
                            parsedAttrs.expose ||
                            (!U.startsWith(fi.name, "pxt::") && !U.startsWith(fi.name, "pxtrt::"))) {
                            const wrap = generateVMWrapper(fi, argTypes)
                            const nargs = fi.argsFmt.length - 1
                            pointersInc += `{ "${fi.name}", (OpFun)(void*)${wrap}, ${nargs} },\n`
                        }
                    } else
                        pointersInc += "PXT_FNPTR(::" + fi.name + "),\n"
                    return;
                }

                m = /^\s*extern const (\w+) (\w+);/.exec(ln)
                if (currAttrs && m) {
                    let fi: pxtc.FuncInfo = {
                        name: currNs + "::" + m[2],
                        argsFmt: [],
                        value: null
                    }
                    res.functions.push(fi)
                    if (!isVM)
                        pointersInc += "PXT_FNPTR(&::" + fi.name + "),\n"
                    currAttrs = ""
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
        }

        const currSettings: Map<any> = U.clone(compileService.yottaConfig || {})
        const optSettings: Map<any> = {}
        const settingSrc: Map<Package> = {}
        const codalLibraries: pxt.Map<github.ParsedRepo> = {}

        function parseJson(pkg: Package) {
            const j0 = pkg.config.platformio
            if (j0 && j0.dependencies) {
                U.jsonCopyFrom(res.platformio.dependencies, j0.dependencies)
            }

            if (res.npmDependencies && pkg.config.npmDependencies)
                U.jsonCopyFrom(res.npmDependencies, pkg.config.npmDependencies)

            const codal = pkg.config.codal
            if (isCodal && codal) {
                for (const lib of codal.libraries || []) {
                    const repo = github.parseRepoId(lib)
                    if (!repo)
                        U.userError(lf("codal library {0} doesn't look like github repo", lib))
                    const canonical = github.stringifyRepo(repo)
                    const existing = U.lookup(codalLibraries, repo.project)
                    if (existing) {
                        if (github.stringifyRepo(existing) != canonical)
                            U.userError(lf("conflict between codal libraries: {0} and {1}", github.stringifyRepo(existing), canonical))
                    } else {
                        codalLibraries[repo.project] = repo
                    }
                }
            }

            const json = pkg.config.yotta
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
                        let err = new PkgConflictError(lf("conflict on yotta setting {0} between extensions {1} and {2}",
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
        if (isYotta && compile.hasHex) {
            let cs = compileService
            U.assert(!!cs.yottaCorePackage);
            U.assert(!!cs.githubCorePackage);
            U.assert(!!cs.gittag);
            let tagged = cs.githubCorePackage + "#" + compileService.gittag
            res.yotta.dependencies[cs.yottaCorePackage] = tagged;
        }

        if (mainPkg) {
            let seenMain = false

            for (let pkg of mainDeps) {
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
                // Generally, headers need to be processed before sources, as they contain definitions
                // (in particular of enums, which are needed to decide if we're doing conversions for
                // function arguments). This can still fail if one header uses another and they are
                // listed in invalid order...
                const isHeaderFn = (fn: string) => U.endsWith(fn, ".h")
                const ext = ".cpp"
                const files = pkg.getFiles().filter(isHeaderFn)
                    .concat(pkg.getFiles().filter(s => !isHeaderFn(s)))
                for (let fn of files) {
                    const isHeader = isHeaderFn(fn)
                    if (isHeader || U.endsWith(fn, ext)) {
                        let fullName = pkg.config.name + "/" + fn
                        if ((pkg.config.name == "base" || /^core($|---)/.test(pkg.config.name)) && isHeader)
                            fullName = fn
                        if (isHeader)
                            includesInc += `#include "${isYotta ? sourcePath.slice(1) : ""}${fullName}"\n`
                        let src = pkg.readFile(fn)
                        if (src == null)
                            U.userError(lf("C++ file {0} is missing in extension {1}.", fn, pkg.config.name))
                        fileName = fullName

                        parseCpp(src, isHeader)
                        // src = src.replace(/^[ \t]*/mg, "") // HACK: shrink the files
                        res.extensionFiles[sourcePath + fullName] = src

                        if (pkg.level == 0)
                            res.onlyPublic = false
                        if (pkg.verProtocol() && pkg.verProtocol() != "pub" && pkg.verProtocol() != "embed")
                            res.onlyPublic = false
                    }
                    if (U.endsWith(fn, ".c") || U.endsWith(fn, ".S") || U.endsWith(fn, ".s")) {
                        let src = pkg.readFile(fn)
                        res.extensionFiles[sourcePath + pkg.config.name + "/" + fn.replace(/\.S$/, ".s")] = src
                    }
                }
                if (thisErrors) {
                    allErrors += lf("Extension {0}:\n", pkg.id) + thisErrors
                }
            }

            if (!seenMain) {
                // this can happen if the main package is disabled in current variant
                shimsDTS.clear()
                enumsDTS.clear()
            }
        }

        if (allErrors)
            U.userError(allErrors)

        // merge optional settings
        U.jsonCopyFrom(optSettings, currSettings);
        U.iterMap(optSettings, (k, v) => {
            if (v === null) {
                delete optSettings[k];
            }
        })
        // fix keys - ==> _
        Object.keys(optSettings)
            .filter(k => /-/.test(k)).forEach(k => {
                const v = optSettings[k];
                delete optSettings[k];
                optSettings[k.replace(/-/g, '_')] = v;
            })
        if (!isYotta && compileService.yottaConfigCompatibility) { // yotta automatically adds YOTTA_CFG_
            Object.keys(optSettings)
                .forEach(k => optSettings["YOTTA_CFG_" + k] = optSettings[k]);
        }

        optSettings["PXT_TARGET"] = JSON.stringify(appTarget.id)

        function allFilesWithExt(ext: string) {
            let allfiles = Object.keys(res.extensionFiles).concat(Object.keys(res.generatedFiles))
            return allfiles.filter(f => U.endsWith(f, ext)).map(s => s.slice(1))
        }

        const configJson = U.jsonUnFlatten(optSettings)
        if (isDockerMake) {
            let packageJson = {
                name: "pxt-app",
                private: true,
                dependencies: res.npmDependencies,
            }
            res.generatedFiles["/package.json"] = JSON.stringify(packageJson, null, 4) + "\n"
        } else if (isEspIdf) {
            const files = U.concatArrayLike<string>([
                allFilesWithExt(".c"),
                allFilesWithExt(".cpp"),
                allFilesWithExt(".s")
            ]).map(s => s.slice(sourcePath.length - 1)).concat(["main.cpp"])
            files.push("pointers.cpp")
            res.generatedFiles[sourcePath + "CMakeLists.txt"] =
                `idf_component_register(\n  SRCS\n` +
                files.map(f => `    "${f}"\n`).join("") +
                `  INCLUDE_DIRS\n    "."\n)\n`
        } else if (isCodal) {
            let cs = compileService
            let cfg = U.clone(cs.codalDefinitions) || {}
            let trg = cs.codalTarget
            if (typeof trg == "string") trg = trg + ".json"
            let codalJson = {
                "target": trg,
                "definitions": cfg,
                "config": cfg,
                "application": "pxtapp",
                "output_folder": "build",
                // include these, because we use hash of this file to see if anything changed
                "pxt_gitrepo": cs.githubCorePackage,
                "pxt_gittag": cs.gittag,
                "libraries": U.values(codalLibraries).map(r => ({
                    "name": r.project,
                    "url": "https://github.com/" + r.fullName,
                    "branch": r.tag || "master",
                    "type": "git"
                }))
            }
            if (codalJson.libraries.length == 0)
                delete codalJson.libraries
            U.iterMap(U.jsonFlatten(configJson), (k, v) => {
                k = k.replace(/^codal\./, "device.").toUpperCase().replace(/\./g, "_")
                cfg[k] = v
            })
            res.generatedFiles["/codal.json"] = JSON.stringify(codalJson, null, 4) + "\n"
            pxt.debug(`codal.json: ${res.generatedFiles["/codal.json"]}`);
            res.codal = codalJson
        } else if (isPlatformio) {
            const iniLines = compileService.platformioIni.slice()
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
            if (compileService.yottaBinary)
                name = compileService.yottaBinary.replace(/-combined/, "").replace(/\.hex$/, "")
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
            pxt.debug(`module.json: ${res.generatedFiles["/module.json"]}`)
        }

        for (let k of Object.keys(cpp_options)) {
            pxtConfig += `#define ${k} ${cpp_options[k]}\n`
        }

        if (compile.uf2Family)
            pxtConfig += `#define PXT_UF2_FAMILY ${compile.uf2Family}\n`

        res.generatedFiles[sourcePath + "pointers.cpp"] = includesInc + protos.finish() + abiInc +
            pointerIncPre + pointersInc + "\nPXT_SHIMS_END\n"
        res.generatedFiles[sourcePath + "pxtconfig.h"] = pxtConfig
        pxt.debug(`pxtconfig.h: ${res.generatedFiles[sourcePath + "pxtconfig.h"]}`)
        if (isYotta) {
            res.generatedFiles["/config.json"] = JSON.stringify(configJson, null, 4) + "\n"
            pxt.debug(`yotta config.json: ${res.generatedFiles["/config.json"]}`)
        }
        res.generatedFiles[sourcePath + "main.cpp"] = `
#include "pxt.h"
#ifdef PXT_MAIN
PXT_MAIN
#else
int main() {
    uBit.init();
    pxt::start();
    release_fiber();
    return 0;   // your program will never reach this line.
}
#endif
`
        if (res.generatedFiles["/Makefile"]) {
            let inc = ""
            let add = (name: string, ext: string) => {
                inc += `${name} = ${allFilesWithExt(ext).join(" ")}\n`
            }
            add("PXT_C", ".c")
            add("PXT_CPP", ".cpp")
            add("PXT_S", ".s")
            add("PXT_HEADERS", ".h")
            inc += "PXT_SOURCES := $(PXT_C) $(PXT_S) $(PXT_CPP)\n"
            inc += "PXT_OBJS := $(addprefix bld/, $(PXT_C:.c=.o) $(PXT_S:.s=.o) $(PXT_CPP:.cpp=.o))\n"
            res.generatedFiles["/Makefile.inc"] = inc
        }

        res.generatedFiles["/functions.json"] = JSON.stringify(res.functions, null, 1)

        let tmp = res.extensionFiles
        U.jsonCopyFrom(tmp, res.generatedFiles)

        let creq = {
            config: compileService.serviceId,
            tag: compileService.gittag,
            replaceFiles: tmp,
            dependencies: (isYotta ? res.yotta.dependencies : null)
        }

        let data = JSON.stringify(creq)
        res.sha = U.sha256(data)
        res.skipCloudBuild = !!compileService.skipCloudBuild
        res.compileData = ts.pxtc.encodeBase64(U.toUTF8(data))
        res.shimsDTS = shimsDTS.finish()
        res.enumsDTS = enumsDTS.finish()

        if (Object.keys(prevExtInfos).length > 10)
            prevExtInfos = {}
        prevExtInfos[key] = res

        return res;
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
                textLen = parseInt(swapBytes(m[2]), 16)
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
