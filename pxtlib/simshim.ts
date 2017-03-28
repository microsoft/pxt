namespace pxt {
    export function simshim(prog: ts.Program): Map<string> {
        let SK = ts.SyntaxKind
        let checker = prog.getTypeChecker()
        let mainWr = cpp.nsWriter("declare namespace")
        let currNs = ""

        for (let src of prog.getSourceFiles()) {
            if (!U.startsWith(src.fileName, "sim/"))
                continue;
            for (let stmt of src.statements) {
                let mod = stmt as ts.ModuleDeclaration
                if (stmt.kind == SK.ModuleDeclaration && mod.name.text == "pxsim") {
                    doStmt(mod.body)
                }
            }
        }

        let res: Map<string> = {}
        res[appTarget.corepkg] = mainWr.finish()
        return res

        function typeOf(node: ts.Node) {
            let r: ts.Type;
            if (ts.isExpression(node))
                r = checker.getContextualType(<ts.Expression>node)
            if (!r) r = checker.getTypeAtLocation(node);
            return r
        }

        /*
        let doSymbol = (sym: ts.Symbol) => {
            if (sym.getFlags() & ts.SymbolFlags.HasExports) {
                typechecker.getExportsOfModule(sym).forEach(doSymbol)
            }
            decls[pxtc.getFullName(typechecker, sym)] = sym
        }
        */

        function emitModuleDeclaration(mod: ts.ModuleDeclaration) {
            let prevNs = currNs
            if (currNs) currNs += "."
            currNs += mod.name.text
            doStmt(mod.body)
            currNs = prevNs
        }

        function mapType(tp: ts.Type) {
            let fn = checker.typeToString(tp, null, ts.TypeFormatFlags.UseFullyQualifiedType)
            switch (fn) {
                case "pxsim.RefAction": return "() => void";
                default:
                    return fn.replace(/^pxsim\./, "")
            }
        }

        function promiseElementType(tp: ts.Type) {
            if ((tp.flags & ts.TypeFlags.Reference) && tp.symbol.name == "Promise") {
                return (tp as ts.TypeReference).typeArguments[0]
            }
            return null
        }

        function emitClassDeclaration(cl: ts.ClassDeclaration) {
            let cmts = getExportComments(cl)
            if (!cmts) return

            mainWr.setNs(currNs)
            mainWr.write(cmts)

            let prevNs = currNs
            if (currNs) currNs += "."
            currNs += cl.name.text

            mainWr.write(`declare class ${cl.name.text} {`)
            mainWr.incrIndent()

            for (let mem of cl.members) {
                switch (mem.kind) {
                    case SK.MethodDeclaration:
                        emitFunctionDeclaration(mem as ts.MethodDeclaration)
                        break
                    case SK.PropertyDeclaration:
                        emitPropertyDeclaration(mem as ts.PropertyDeclaration)
                        break
                    case SK.Constructor:
                        emitConstructorDeclaration(mem as ts.ConstructorDeclaration)
                        break
                    default:
                        break;
                }
            }
            currNs = prevNs
            mainWr.decrIndent()
            mainWr.write(`}`)
        }

        function getExportComments(n: ts.Node) {
            let cmts = pxtc.getComments(n)
            if (!/^\s*\/\/%/m.test(cmts)) return null
            return cmts
        }

        function emitPropertyDeclaration(fn: ts.PropertyDeclaration) {
            let cmts = getExportComments(fn)
            if (!cmts) return
            let nm = fn.name.getText()
            let attrs = "//% shim=." + nm
            let tp = checker.getTypeAtLocation(fn)
            mainWr.write(cmts)
            mainWr.write(attrs)
            mainWr.write(`public ${nm}: ${mapType(tp)};`)
            mainWr.write("")
        }

        function emitConstructorDeclaration(fn: ts.ConstructorDeclaration) {
            let cmts = getExportComments(fn)
            if (!cmts) return
            let tp = checker.getTypeAtLocation(fn)
            let args = fn.parameters.map(p => p.name.getText() + ": " + mapType(typeOf(p)))
            mainWr.write(cmts)
            mainWr.write(`//% shim="new ${currNs}"`)
            mainWr.write(`constructor(${args.join(", ")});`)
            mainWr.write("")
        }

        function emitFunctionDeclaration(fn: ts.FunctionLikeDeclaration) {
            let cmts = getExportComments(fn)
            if (!cmts) return
            let fnname = fn.name.getText()
            let isMethod = fn.kind == SK.MethodDeclaration
            let attrs = "//% shim=" + (isMethod ? "." + fnname : currNs + "::" + fnname)
            let sig = checker.getSignatureFromDeclaration(fn)
            let rettp = checker.getReturnTypeOfSignature(sig)
            let asyncName = /Async$/.test(fnname)
            let prom = promiseElementType(rettp)
            if (prom) {
                attrs += " promise"
                rettp = prom
                if (!asyncName)
                    U.userError(`${currNs}::${fnname} should be called ${fnname}Async`)
            } else if (asyncName) {
                U.userError(`${currNs}::${fnname} doesn't return a promise`)
            }
            let args = fn.parameters.map(p => `${p.name.getText()}${p.questionToken ? "?" : ""}: ${mapType(typeOf(p))}`)
            let localname = fnname.replace(/Async$/, "")
            let defkw = isMethod ? "public" : "function"

            if (!isMethod)
                mainWr.setNs(currNs)
            mainWr.write(cmts)
            mainWr.write(attrs)
            mainWr.write(`${defkw} ${localname}(${args.join(", ")}): ${mapType(rettp)};`)
            mainWr.write("")
        }

        function doStmt(stmt: ts.Statement) {
            switch (stmt.kind) {
                case SK.ModuleDeclaration:
                    return emitModuleDeclaration(stmt as ts.ModuleDeclaration)
                case SK.ModuleBlock:
                    return (stmt as ts.ModuleBlock).statements.forEach(doStmt)
                case SK.FunctionDeclaration:
                    return emitFunctionDeclaration(stmt as ts.FunctionDeclaration)
                case SK.ClassDeclaration:
                    return emitClassDeclaration(stmt as ts.ClassDeclaration)
            }
            //console.log("SKIP", pxtc.stringKind(stmt))
            //let mod = stmt as ts.ModuleDeclaration
            //if (mod.name) console.log(mod.name.text)
            /*
            if (mod.name) {
                let sym = typechecker.getSymbolAtLocation(mod.name)
                if (sym) doSymbol(sym)
            }
            */
        }


    }
}
