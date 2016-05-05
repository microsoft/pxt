namespace pxt {
    export function simshim(prog: ts.Program): U.Map<string> {
        let SK = ts.SyntaxKind
        let typechecker = prog.getTypeChecker()
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
        res[appTarget.corepkg + "/shims.d.ts"] = mainWr.finish()
        return res

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
            currNs += mod.name.text + "."
            doStmt(mod.body)
            currNs = prevNs
        }

        function doStmt(stmt: ts.Statement) {
            switch (stmt.kind) {
                case SK.ModuleDeclaration:
                    return emitModuleDeclaration(stmt as ts.ModuleDeclaration)
                case SK.ModuleBlock:
                    return (stmt as ts.ModuleBlock).statements.forEach(doStmt)

            }
            console.log(ts.pxt.stringKind(stmt))
            let mod = stmt as ts.ModuleDeclaration
            console.log(mod.name.text)
            /*
            if (mod.name) {
                let sym = typechecker.getSymbolAtLocation(mod.name)
                if (sym) doSymbol(sym)
            }
            */
        }


    }
}
