namespace ts.pxtc.decompiler {
    // TODO(dz): code share with blocks decompiler
    export function decompileToPython(file: ts.SourceFile): pxtc.CompileResult {
        let result: pxtc.CompileResult = {
            blocksInfo: null,
            outfiles: {},
            diagnostics: [],
            success: true,
            times: {}
        }

        // const env: DecompilerEnv = {
        //     blocks: blocksInfo,
        //     declaredFunctions: {},
        //     declaredEnums: {},
        //     functionParamIds: {},
        //     attrs: attrs,
        //     compInfo: compInfo,
        //     localReporters: [],
        //     opts: options || {}
        // };

        let outLns = file.getChildren()
            .map(emitNode)
            .reduce((p, c) => p.concat(c), [])

        let output = outLns.join("\n");

        result.outfiles[file.fileName.replace(/(\.py)?\.\w*$/i, '') + '.py'] = output;

        return result
    }

    const INDENT = "  "
    function indent(lvl: number): (s: string) => string {
        return s => `${INDENT.repeat(lvl)}${s}`
    }
    let indent1 = indent(1)

    function emitNode(s: ts.Node): string[] {
        switch (s.kind) {
            case ts.SyntaxKind.SyntaxList:
                return (s as ts.SyntaxList)._children
                    .map(emitNode)
                    .reduce((p, c) => p.concat(c), [])
            case ts.SyntaxKind.EndOfFileToken:
            case ts.SyntaxKind.OpenBraceToken:
            case ts.SyntaxKind.CloseBraceToken:
                return []
            default:
                return emitStmtWithNewlines(s as ts.Statement)
        }
    }

    function emitStmtWithNewlines(s: ts.Statement): string[] {
        let out: string[] = [];

        let leadingNewlines = 0
        if (s.getLeadingTriviaWidth() > 0) {
            let leading = s.getFullText().slice(0, s.getLeadingTriviaWidth())
            leadingNewlines = leading.split("\n").length - 2; // expect 1 newline, anything more is a blank line
        }
        for (let i = 0; i < leadingNewlines; i++)
            out.push("")

        out = out.concat(emitStmt(s))

        return out;
    }
    function emitStmt(s: ts.Statement): string[] {
        // TODO(dz): why does the type system not recognize this as discriminated unions?
        switch (s.kind) {
            case ts.SyntaxKind.VariableStatement:
                return emitVarStmt(s as ts.VariableStatement)
            case ts.SyntaxKind.ClassDeclaration:
                return emitClassStmt(s as ts.ClassDeclaration)
            case ts.SyntaxKind.ExpressionStatement:
                return [emitExpStmt(s as ts.ExpressionStatement)]
            case ts.SyntaxKind.FunctionDeclaration:
                return emitFuncDecl(s as ts.FunctionDeclaration)
            case ts.SyntaxKind.IfStatement:
                return emitIf(s as ts.IfStatement)
            case ts.SyntaxKind.Block:
                let block = s as ts.Block
                return block.getChildren()
                    .map(emitNode)
                    .reduce((p, c) => p.concat(c), [])
            default:
                throw Error(`Not implemented: statement kind ${s.kind}`);
        }
    }
    function emitIf(s: ts.IfStatement): string[] {
        let cond = emitExp(s.expression)
        let out = [`if ${cond}:`];

        let th = emitStmt(s.thenStatement)
            .map(indent1)
        out = out.concat(th)

        // TODO: handle else if
        // TODO: confirm else works

        if (s.elseStatement) {
            out.push("else:")
            let el = emitStmt(s.elseStatement)
                .map(indent1)
            out = out.concat(el)
        }

        return out;
    }
    function emitVarStmt(s: ts.VariableStatement): string[] {
        // console.log("s.declarationList")
        // console.log(s.declarationList)
        let decls = s.declarationList.declarations;
        return decls.map(emitVarDecl)
    }
    // TODO map names from camel case to snake case
    function emitClassStmt(s: ts.ClassDeclaration): string[] {
        let out: string[] = []

        // TODO handle inheritence

        let isEnum = s.members.every(isEnumMem) // TODO hack?
        if (isEnum)
            out.push(`class ${s.name.getText()}(Enum):`)
        else
            out.push(`class ${s.name.getText()}:`)

        let mems = s.members
            .map(emitClassMem)
            .reduce((p, c) => p.concat(c), [])
            .filter(m => m)
        if (mems.length) {
            out = out.concat(mems.map(indent1))
        }

        return out;
    }
    function isEnumMem(s: ts.ClassElement): boolean {
        if (s.kind !== ts.SyntaxKind.PropertyDeclaration)
            return false
        let prop = s as ts.PropertyDeclaration
        if (!prop.modifiers || prop.modifiers.length !== 1)
            return false
        for (let mod of prop.modifiers)
            if (mod.kind !== ts.SyntaxKind.StaticKeyword)
                return false;
        if (prop.initializer.kind !== ts.SyntaxKind.NumericLiteral)
            return false;

        return true
    }
    function emitClassMem(s: ts.ClassElement): string[] {
        switch (s.kind) {
            case ts.SyntaxKind.PropertyDeclaration:
                return [emitPropDecl(s as ts.PropertyDeclaration)]
            case ts.SyntaxKind.MethodDeclaration:
                return emitFuncDecl(s as ts.MethodDeclaration)
            default:
                return ["UNKNOWN ClassElement " + s.kind]
        }
    }
    function emitPropDecl(s: ts.PropertyDeclaration): string {
        // TODO(dz)
        let nm = s.name.getText()
        if (s.initializer) {
            let init = emitExp(s.initializer)
            return `${nm} = ${init}`
        }
        else {
            // can't do declerations without initilization in python
            return ""
        }
    }
    function emitExpStmt(s: ts.ExpressionStatement): string {
        // TODO
        let exp = emitExp(s.expression)
        return `${exp}`
    }
    function emitFuncDecl(s: ts.FunctionDeclaration | ts.MethodDeclaration): string[] {
        // TODO
        let paramList: string[] = []

        if (s.kind === ts.SyntaxKind.MethodDeclaration) {
            paramList.push("self")
        }

        paramList = paramList
            .concat(s.parameters.map(emitParamDecl))

        let params = paramList.join(", ")

        let out = []

        out.push(`def ${s.name.getText()}(${params}):`)

        let stmts = s.body.statements
            .map(emitStmt)
            .reduce((p, c) => p.concat(c), [])
            .filter(s => s)
        if (stmts.length) {
            out = out.concat(stmts.map(indent1))
        }

        return out
    }
    function emitParamDecl(s: ts.ParameterDeclaration): string {
        // TODO
        let nm = s.name.getText()
        let typ = s.type.getText()
        return `${nm}:${typ}`
    }
    function emitVarDecl(s: ts.VariableDeclaration): string {
        let decl = s.name.getText();
        if (s.initializer) {
            let exp = emitExp(s.initializer);
            return `${decl} = ${exp}`
        } else {
            // can't do declerations without initilization in python
            return ""
        }
    }
    function emitBinExp(s: ts.BinaryExpression): string {
        let left = emitExp(s.left)
        let op = s.operatorToken.getText() // TODO translate operators
        let right = emitExp(s.right)
        return `${left} ${op} ${right}`;
    }
    function emitDotExp(s: ts.PropertyAccessExpression): string {
        let left = emitExp(s.expression)
        let right = s.name.getText()
        return `${left}.${right}`;
    }
    function emitCallExp(s: ts.CallExpression): string {
        let fn = emitExp(s.expression)
        let args = s.arguments
            .map(emitExp)
            .join(", ")
        return `${fn}(${args})`
    }
    function emitExp(s: ts.Expression): string {
        switch (s.kind) {
            case ts.SyntaxKind.TrueKeyword:
                return "True"
            case ts.SyntaxKind.FalseKeyword:
                return "False"
            case ts.SyntaxKind.BinaryExpression:
                return emitBinExp(s as ts.BinaryExpression)
            case ts.SyntaxKind.PropertyAccessExpression:
                return emitDotExp(s as ts.PropertyAccessExpression)
            case ts.SyntaxKind.ThisKeyword:
                return "self"
            case ts.SyntaxKind.CallExpression:
                return emitCallExp(s as ts.CallExpression)
            default:
                // TODO handle more expressions
                return s.getText()
        }
    }
}