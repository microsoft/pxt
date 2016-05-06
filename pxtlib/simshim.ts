namespace pxt {
    export function simshim(prog: ts.Program): U.Map<string> {
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

        let res: U.Map<string> = {}
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
            decls[ts.pxt.getFullName(typechecker, sym)] = sym
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

        function emitFunctionDeclaration(fn: ts.FunctionDeclaration) {
            let cmts = ts.pxt.getComments(fn)
            if (!/^\s*\/\/%/m.test(cmts)) return
            let fnname = fn.name.text
            let attrs = "//% shim=" + currNs + "::" + fnname
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
            let args = fn.parameters.map(p => p.name.getText() + ": " + mapType(typeOf(p)))
            let localname = fnname.replace(/Async$/, "")

            mainWr.setNs(currNs)
            mainWr.write(cmts)
            mainWr.write(attrs)
            mainWr.write(`function ${localname}(${args.join(", ")}): ${mapType(rettp)};`)
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
            }
            //console.log("SKIP", ts.pxt.stringKind(stmt))
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
