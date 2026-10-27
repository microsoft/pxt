/// <reference path="../../localtypings/pxtarget.d.ts"/>
/// <reference path="../commonutil.ts"/>
/// <reference path="sha256.ts"/>
/// <reference path="../constants.ts"/>
/// <reference path="packageutils.ts"/>
/// <reference path="targetutils.ts"/>
/// <reference path="commentattrs.ts"/>
/// <reference path="githubid.ts"/>

namespace ts.pxtc {
    export const NATIVE_TYPE_THUMB = "thumb";
    export const NATIVE_TYPE_VM = "vm";

    export function emptyExtInfo(compileService: pxt.TargetCompileService): ExtensionInfo {
        let cs = compileService
        if (!cs) cs = {} as any
        const pio = !!cs.platformioIni;
        const docker = cs.buildEngine == "dockermake" || cs.buildEngine == "dockercross" || cs.buildEngine == "dockerespidf";
        const r: ExtensionInfo = {
            functions: [],
            generatedFiles: {},
            extensionFiles: {},
            sha: "",
            compileData: "",
            shimsDTS: "",
            enumsDTS: "",
            onlyPublic: true
        }
        if (pio) r.platformio = { dependencies: {} };
        else if (docker) r.npmDependencies = {};
        else r.yotta = { config: {}, dependencies: {} };
        return r;
    }
}

namespace pxt.cpp {
    import U = pxtc.Util;
    const lf = U.lf;

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

    export class PkgConflictError extends Error {
        pkg0Id: string;
        pkg1Id: string;
        settingName: string;
        isUserError: boolean;
        isVersionConflict: boolean;

        constructor(msg: string) {
            super(msg)
            this.isUserError = true
            this.message = msg
        }
    }

    interface ExtensionPackage {
        id: string;
        path: string;
        config: PackageConfig;
        files: string[];
        version: string;
    }

    export interface ExtensionInfoHost {
        cache: Map<pxtc.ExtensionInfo>;
        logger: Pick<Logger, "debug" | "log">;
        perf: {
            measureStart(name: string): void;
            measureEnd(name: string): void;
        };
    }

    /**
     * Generates native extension files from pxt.json and project files, with dependencies
     * under pxt_modules/<directory>/. Dependencies resolve by directory, pxt.json name,
     * or their prefix before "---".
     * The target must not have variant overrides applied.
     * @example getExtensionInfo({ "pxt.json": config, "main.cpp": source }, target, "v2", host)
     */
    export function getExtensionInfo(files: Map<string>, target: TargetBundle, variant: string, host: ExtensionInfoHost): pxtc.ExtensionInfo {
        const appTarget = getAppTargetVariant(target, variant);
        const constsName = "dal.d.ts"
        let sourcePath = "/source/"
        let disabledDeps = ""
        const packages: Map<ExtensionPackage> = {};
        const runtimePackages: Map<boolean> = {};
        const packagePaths: Map<string[]> = Object.create(null);
        for (const path of Object.keys(files)) {
            const match = /^pxt_modules\/([^/]+)\/pxt\.json$/.exec(path);
            if (!match) continue;
            const config = JSON.parse(files[path]) as PackageConfig;
            const directory = path.slice(0, -"pxt.json".length);
            for (const id of [match[1], config.name]) {
                if (!id) continue;
                for (const alias of [id, id.replace(/---.*/, "")]) {
                    const paths = packagePaths[alias] || (packagePaths[alias] = []);
                    if (paths.indexOf(directory) < 0)
                        paths.push(directory);
                }
            }
        }
        const resolvePath = (id: string): string => {
            if (id == "this") return "";
            const path = "pxt_modules/" + id + "/";
            if (files[path + "pxt.json"] != null) return path;
            const paths = packagePaths[id];
            if (paths && paths.length > 1)
                U.userError(`extension ${id} matches multiple directories: ${paths.join(", ")}`);
            return paths && paths[0];
        };
        const readFile = (pkg: ExtensionPackage, name: string): string =>
            files[pkg.path + name];
        const dependencies = (pkg: ExtensionPackage): Map<string> => packageUtils.getConfigDependencies(
            pkg.config,
            pkg.id == "this",
            false,
            id => resolvePath(id) != null
        );
        const visit = (id: string, version: string, runtime: boolean): void => {
            const path = resolvePath(id);
            if (path == null)
                U.userError(`extension ${id} is missing pxt.json`);
            if (runtimePackages[path] || (!runtime && packages[path])) return;
            if (runtime) runtimePackages[path] = true;
            let pkg = packages[path];
            if (!pkg) {
                const configText = files[path + "pxt.json"];
                if (!configText)
                    U.userError(`extension ${id} is missing pxt.json`);
                const config = JSON.parse(configText) as PackageConfig;
                if (!config.dependencies || !Array.isArray(config.files))
                    U.userError(`Invalid pxt.json in extension ${id}`);
                const packageId = path ? path.slice("pxt_modules/".length, -1) : "this";
                pkg = packages[path] = { id: packageId, path, config, files: [], version };
            }
            const deps = dependencies(pkg);
            for (const dep of Object.keys(deps))
                visit(dep, deps[dep], runtime);
            for (const dep of Object.keys(pkg.config.cppDependencies || {}))
                visit(dep, pkg.config.cppDependencies[dep], false);
        };
        visit("this", "file:.", true);
        const mainPkg = packages[""];
        const mainPkgDeps = U.values(packages).sort((a, b) =>
            a.id == b.id ? 0 : a.id == "this" ? 1 : b.id == "this" ? -1 : U.strcmp(a.id, b.id));

        for (const pkg of mainPkgDeps) {
            pkg.files = packageUtils.getConfigFiles(
                pkg.config,
                pkg == mainPkg,
                appTarget,
                id => !!runtimePackages[resolvePath(id)],
                condition => host.logger.log(`invalid dependency expression: ${condition} in ${pkg.id}`)
            );
        }

        const mainDeps: ExtensionPackage[] = [];
        const disablesVariant = (pkg: ExtensionPackage): boolean =>
            packageUtils.isVariantDisabled(pkg.config, variant);
        for (let pkg of mainPkgDeps) {
            if (disablesVariant(pkg) ||
                Object.keys(dependencies(pkg)).some(id => disablesVariant(packages[resolvePath(id)]))) {
                if (disabledDeps)
                    disabledDeps += ", "
                disabledDeps += pkg.id
                host.logger.debug(`disable variant ${variant} due to ${pkg.id}`)
                continue
            }
            mainDeps.push(pkg)
        }

        let compileService = appTarget.compileService;
        if (!compileService)
            compileService = {
                gittag: "none",
                serviceId: "nocompile"
            }
        compileService = U.clone(compileService)

        const compile = appTarget.compile;
        if (mainPkgDeps.some(pkg => pkg.config.utf8))
            compile.utf8 = true;

        const key = JSON.stringify({
            variant: variant || "",
            targetId: appTarget.id,
            compile,
            compileService,
            mainConfig: mainPkg.config,
            packages: mainDeps.map(pkg => ({
                id: pkg.id,
                config: pkg.config,
                version: pkg.version,
                files: pkg.files.filter(fn => fn == constsName ||
                    /\.(h|cpp|c|S|s|mk)$/.test(fn) ||
                    ["Makefile", "sdkconfig.defaults", "CMakeLists.txt"].indexOf(fn) >= 0)
                    .map(fn => [fn, readFile(pkg, fn)])
            }))
        });
        const prevInfo = host.cache[key];
        if (prevInfo) {
            host.logger.debug("Using cached extinfo");
            const result = U.clone(prevInfo);
            result.disabledDeps = disabledDeps;
            return result;
        }
        host.logger.debug("Generating new extinfo");
        const res = pxtc.emptyExtInfo(compileService);
        res.disabledDeps = disabledDeps;

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
            if (pkg.files.indexOf(constsName) >= 0) {
                const src = readFile(pkg, constsName)
                Util.assert(!!src, `${constsName} not found in ${pkg.id}`)
                src.split(/\r?\n/).forEach(ln => {
                    let m = /^\s*(\w+) = (.*),/.exec(ln)
                    if (m) {
                        enumVals[m[1]] = m[2]
                    }
                })
            }

            for (const fn of pkg.files) {
                if (["Makefile", "sdkconfig.defaults", "CMakeLists.txt"].indexOf(fn) >= 0 || U.endsWith(fn, ".mk")) {
                    res.generatedFiles["/" + fn] = readFile(pkg, fn)
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
        const settingSrc: Map<ExtensionPackage> = {}
        const codalLibraries: pxt.Map<github.ParsedRepo> = {}

        function parseJson(pkg: ExtensionPackage) {
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
                    } else if (!mainPkg.config.yotta || !mainPkg.config.yotta.ignoreConflicts) {
                        let err = new PkgConflictError(lf("conflict on yotta setting {0} between extensions {1} and {2}",
                            settingName, pkg.id, prev.id))
                        err.pkg0Id = prev.id
                        err.pkg1Id = pkg.id
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
                const files = pkg.files.filter(isHeaderFn)
                    .concat(pkg.files.filter(s => !isHeaderFn(s)))
                for (let fn of files) {
                    const isHeader = isHeaderFn(fn)
                    if (isHeader || U.endsWith(fn, ext)) {
                        let fullName = pkg.config.name + "/" + fn
                        if ((pkg.config.name == "base" || /^core($|---)/.test(pkg.config.name)) && isHeader)
                            fullName = fn
                        if (isHeader)
                            includesInc += `#include "${isYotta ? sourcePath.slice(1) : ""}${fullName}"\n`
                        let src = readFile(pkg, fn)
                        if (src == null)
                            U.userError(lf("C++ file {0} is missing in extension {1}.", fn, pkg.config.name))
                        fileName = fullName

                        parseCpp(src, isHeader)
                        // src = src.replace(/^[ \t]*/mg, "") // HACK: shrink the files
                        res.extensionFiles[sourcePath + fullName] = src

                        if (pkg == mainPkg)
                            res.onlyPublic = false
                        const protocol = packageUtils.getVersionProtocol(pkg.version);
                        if (protocol && protocol != "pub" && protocol != "embed")
                            res.onlyPublic = false
                    }
                    if (U.endsWith(fn, ".c") || U.endsWith(fn, ".S") || U.endsWith(fn, ".s")) {
                        let src = readFile(pkg, fn)
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
            host.logger.debug(`codal.json: ${res.generatedFiles["/codal.json"]}`);
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
            host.logger.debug(`module.json: ${res.generatedFiles["/module.json"]}`)
        }

        for (let k of Object.keys(cpp_options)) {
            pxtConfig += `#define ${k} ${cpp_options[k]}\n`
        }

        if (compile.uf2Family)
            pxtConfig += `#define PXT_UF2_FAMILY ${compile.uf2Family}\n`

        res.generatedFiles[sourcePath + "pointers.cpp"] = includesInc + protos.finish() + abiInc +
            pointerIncPre + pointersInc + "\nPXT_SHIMS_END\n"
        res.generatedFiles[sourcePath + "pxtconfig.h"] = pxtConfig
        host.logger.debug(`pxtconfig.h: ${res.generatedFiles[sourcePath + "pxtconfig.h"]}`)
        if (isYotta) {
            res.generatedFiles["/config.json"] = JSON.stringify(configJson, null, 4) + "\n"
            host.logger.debug(`yotta config.json: ${res.generatedFiles["/config.json"]}`)
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
        host.perf.measureStart(Measurements.Sha256Buffer);
        try {
            res.sha = pxtc.BrowserImpl.sha256buffer(U.toUTF8Array(data));
        } finally {
            host.perf.measureEnd(Measurements.Sha256Buffer);
        }
        res.skipCloudBuild = !!compileService.skipCloudBuild
        res.compileData = ts.pxtc.encodeBase64(U.toUTF8(data))
        res.shimsDTS = shimsDTS.finish()
        res.enumsDTS = enumsDTS.finish()

        if (Object.keys(host.cache).length > 10) {
            for (const key of Object.keys(host.cache))
                delete host.cache[key];
        }
        host.cache[key] = U.clone(res);

        return res;
    }
}
