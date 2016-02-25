/// <reference path="emitter/util.ts"/>

namespace yelm.cpp {
    import U = ts.yelm.Util;
    import Y = ts.yelm;
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

    export function getExtensionInfo(mainPkg: MainPackage): Y.ExtensionInfo {
        var res = Y.emptyExtInfo();
        var fileRepl: U.StringMap<string> = {}
        var pointersInc = ""
        var includesInc = ""
        var totalConfig: DalConfig = {
            dependencies: {},
            config: {},
        }
        var thisErrors = ""
        var err = (s: string) => thisErrors += "   " + s + "\n";
        var cfginc = ""

        function parseCpp(src: string) {
            res.hasExtension = true
            var currNs = ""
            src.split(/\r?\n/).forEach(ln => {
                var m = /^\s*namespace\s+(\w+)/.exec(ln)
                if (m) {
                    if (currNs) err("more than one namespace declaration not supported")
                    currNs = m[1]
                    return;
                }

                m = /^\s*GLUE\s+(\w+)([\*\&]*\s+[\*\&]*)(\w+)\s*\(([^\(\)]*)\)\s*(;\s*$|\{|$)/.exec(ln)
                if (m) {
                    if (!currNs) err("missing namespace declaration before GLUE");
                    var retTp = (m[1] + m[2]).replace(/\s+/g, "")
                    var funName = m[3]
                    var args = m[4]
                    var numArgs = 0
                    if (args.trim())
                        numArgs = args.replace(/[^,]/g, "").length + 1;
                    var fi: Y.FuncInfo = {
                        name: currNs + "::" + funName,
                        type: retTp == "void" ? "P" : "F",
                        args: numArgs,
                        value: null
                    }
                    res.functions.push(fi)
                    pointersInc += "(uint32_t)(void*)::" + fi.name + ",\n"
                    return;
                }

                if (/^\s*GLUE\s+/.test(ln)) {
                    err("invalid GLUE line: " + ln)
                    return;
                }

                ln = ln.replace(/\/\/.*/, "")
                var isEnum = false
                m = /^\s*#define\s+(\w+)\s+(.*)/.exec(ln)
                if (!m) {
                    m = /^\s*(\w+)\s*=\s*(.*)/.exec(ln)
                    isEnum = true
                }

                if (m) {
                    var num = m[2]
                    num = num.replace(/\/\/.*/, "")
                    num = num.replace(/\/\*.*/, "")
                    num = num.trim()
                    if (isEnum)
                        num = num.replace(/,$/, "")
                    var val = parseExpr(num)
                    var nm = m[1]
                    if (isEnum)
                        nm = currNs + "::" + nm
                    //console.log(nm, num, val)
                    if (val != null) {
                        res.enums[nm] = val
                        return;
                    }
                }
            })
            if (!currNs)
                err("missing namespace declaration")
            includesInc += "#include \"" + currNs + ".cpp\"\n"
            fileRepl["/generated/" + currNs + ".cpp"] = src
        }

        function parseJson(pkg: Package) {
            let json = pkg.config.dal
            if (!json) return;

            res.hasExtension = true

            // TODO check for conflicts
            if (json.dependencies) {
                Util.jsonCopyFrom(totalConfig.dependencies, json.dependencies)
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

        if (mainPkg) {
            // TODO computeReachableNodes(pkg, true)
            for (let pkg of mainPkg.sortedDeps()) {
                thisErrors = ""
                for (let fn of pkg.getFiles()) {
                    if (U.endsWith(fn, ".cpp")) {
                        parseCpp(pkg.readFile(fn))
                    }
                }
                if (thisErrors) {
                    res.errors += lf("Packge {0}:\n", pkg.id) + thisErrors
                }
            }
        }

        if (res.errors)
            return res;

        if (cfginc)
            fileRepl["/generated/extconfig.h"] = cfginc
        fileRepl["/generated/extpointers.inc"] = pointersInc
        fileRepl["/generated/extensions.inc"] = includesInc
        var creq = {
            config: "ws",
            tag: "v75",
            replaceFiles: fileRepl,
            dependencies: totalConfig.dependencies,
        }

        let data = JSON.stringify(creq)
        res.sha = Util.sha256(data)
        res.compileData = btoa(Util.toUTF8(data))
        return res;
    }

}
