namespace pxt.py {
    export function decompileToPython(program: ts.Program, filename: string): pxtc.CompileResult {
        let result = emptyResult()
        try {
            let output = tsToPy(program, filename)
            let outFilename = filename.replace(/(\.py)?\.\w*$/i, '') + '.py'
            result.outfiles[outFilename] = output;
        } catch (e) {
            if (e.pyDiagnostic) result.diagnostics = [e.pyDiagnostic];
            else pxt.reportException(e);

            result.success = false;
        }
        return result
    }
    function emptyResult(): pxtc.CompileResult {
        return {
            blocksInfo: undefined,
            outfiles: {},
            diagnostics: [],
            success: true,
            times: {}
        }
    }

    function throwError(node: ts.Node, code: number, messageText: string): never {
        const diag: pxtc.KsDiagnostic = {
            fileName: node.getSourceFile().fileName,
            start: node.getStart(),
            length: node.getEnd() - node.getStart(),
            line: undefined,
            column: undefined,
            code,
            category: pxtc.DiagnosticCategory.Error,
            messageText,
        };

        const err = new Error(messageText);
        (err as any).pyDiagnostic = diag;
        throw err;
    }

    ///
    /// UTILS
    ///
    export const INDENT = "    "
    export function indent(lvl: number): (s: string) => string {
        return s => `${INDENT.repeat(lvl)}${s}`
    }
    export const indent1 = indent(1)

    // TODO handle types at initialization when ambiguous (e.g. x = [], x = None)

    function tsToPy(prog: ts.Program, filename: string): string {
        // helpers
        const tc = prog.getTypeChecker()
        const lhost = new ts.pxtc.LSHost(prog)
        // const ls = ts.createLanguageService(lhost) // TODO
        const file = prog.getSourceFile(filename)
        const commentMap = pxtc.decompiler.buildCommentMap(file);
        const reservedWords = pxt.U.toSet(getReservedNmes(), s => s)
        const [renameMap, globalNames] = ts.pxtc.decompiler.buildRenameMap(prog, file, reservedWords)
        const allSymbols = pxtc.getApiInfo(prog)
        const symbols = pxt.U.mapMap(allSymbols.byQName,
            // filter out symbols from the .ts corresponding to this file
            (k, v) => v.fileName == filename ? undefined : v)

        // For debugging:
        // return toStringVariableScopes(file)

        // variables analysis
        const scopeLookup = computeScopeVariableLookup(file)

        // ts->py
        return emitFile(file)
        ///
        /// ENVIRONMENT
        ///
        function getReservedNmes(): string[] {
            const reservedNames = ['ArithmeticError', 'AssertionError', 'AttributeError',
                'BaseException', 'BlockingIOError', 'BrokenPipeError', 'BufferError', 'BytesWarning',
                'ChildProcessError', 'ConnectionAbortedError', 'ConnectionError',
                'ConnectionRefusedError', 'ConnectionResetError', 'DeprecationWarning', 'EOFError',
                'Ellipsis', 'EnvironmentError', 'Exception', 'False', 'FileExistsError',
                'FileNotFoundError', 'FloatingPointError', 'FutureWarning', 'GeneratorExit', 'IOError',
                'ImportError', 'ImportWarning', 'IndentationError', 'IndexError',
                'InterruptedError', 'IsADirectoryError', 'KeyError', 'KeyboardInterrupt', 'LookupError',
                'MemoryError', 'NameError', 'None', 'NotADirectoryError', 'NotImplemented',
                'NotImplementedError', 'OSError', 'OverflowError', 'PendingDeprecationWarning',
                'PermissionError', 'ProcessLookupError', 'RecursionError', 'ReferenceError',
                'ResourceWarning', 'RuntimeError', 'RuntimeWarning', 'StopAsyncIteration',
                'StopIteration', 'SyntaxError', 'SyntaxWarning', 'SystemError', 'SystemExit',
                'TabError', 'TimeoutError', 'True', 'TypeError', 'UnboundLocalError',
                'UnicodeDecodeError', 'UnicodeEncodeError', 'UnicodeError', 'UnicodeTranslateError',
                'UnicodeWarning', 'UserWarning', 'ValueError', 'Warning', 'ZeroDivisionError', '_',
                '__build_class__', '__debug__', '__doc__', '__import__', '__loader__', '__name__',
                '__package__', '__spec__', 'abs', 'all', 'any', 'ascii', 'bin', 'bool',
                'bytearray', 'bytes', 'callable', 'chr', 'classmethod', 'compile', 'complex',
                'copyright', 'credits', 'delattr', 'dict', 'dir', 'divmod', 'enumerate', 'eval',
                'exec', 'exit', 'filter', 'float', 'format', 'frozenset', 'getattr',
                'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input', 'int',
                'isinstance', 'issubclass', 'iter', 'len', 'license', 'list', 'locals', 'map',
                'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow',
                'print', 'property', 'quit', 'range', 'repr', 'reversed', 'round', 'set',
                'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super', 'tuple',
                'type', 'vars', 'zip']
            return reservedNames;
        }
        function tryGetSymbol(exp: ts.Node) {
            if (!exp.getSourceFile())
                return null
            let tsExp = exp.getText()
            return symbols[tsExp] || null;
        }
        function tryGetPyName(exp: ts.BindingPattern | ts.PropertyName | ts.EntityName | ts.PropertyAccessExpression): string | null {
            if (!exp.getSourceFile())
                return null
            let tsExp = exp.getText()

            const tsSym = tc.getSymbolAtLocation(exp);
            if (tsSym) {
                tsExp = tc.getFullyQualifiedName(tsSym);
            }

            let sym = symbols[tsExp]
            if (sym && sym.attributes.alias) {
                return sym.attributes.alias
            }
            if (sym && sym.pyQName) {
                if (sym.isInstance) {
                    if (ts.isPropertyAccessExpression(exp)) {
                        // If this is a property access on an instance, we should bail out
                        // because the left-hand side might contain an expression
                        return null;
                    }

                    // If the pyQname is "Array.append" we just want "append"
                    const nameRegExp = new RegExp(`(?:^|\.)${sym.namespace}\.(.+)`);
                    const match = nameRegExp.exec(sym.pyQName);
                    if (match) return match[1];
                }

                return sym.pyQName
            }
            else if (tsExp in pxtc.ts2PyFunNameMap) {
                return pxtc.ts2PyFunNameMap[tsExp].n
            }
            return null
        }
        function getName(name: ts.Identifier | ts.BindingPattern | ts.PropertyName | ts.EntityName): string {
            let pyName = tryGetPyName(name)
            if (pyName)
                return pyName
            if (!ts.isIdentifier(name)) {
                return throwError(name, 3001, "Unsupported advanced name format: " + name.getText());
            }
            let outName = name.text;
            let hasSrc = name.getSourceFile()
            if (renameMap && hasSrc) {
                const rename = renameMap.getRenameForPosition(name.getStart());
                if (rename) {
                    outName = rename.name;
                }
            }
            return outName
        }
        function getNewGlobalName(nameHint: string | ts.Identifier | ts.BindingPattern | ts.PropertyName | ts.EntityName) {
            // TODO right now this uses a global name set, but really there should be options to allow shadowing
            if (typeof nameHint !== "string")
                nameHint = getName(nameHint)
            if (globalNames[nameHint]) {
                return pxtc.decompiler.getNewName(nameHint, globalNames)
            } else {
                globalNames[nameHint] = true
                return nameHint
            }
        }

        ///
        /// TYPE UTILS
        ///
        function hasTypeFlag(t: ts.Type, fs: ts.TypeFlags) {
            return (t.flags & fs) !== 0
        }
        function isType(s: ts.Expression, fs: ts.TypeFlags): boolean {
            let type = tc.getTypeAtLocation(s)
            return hasTypeFlag(type, fs)
        }
        function isStringType(s: ts.Expression): boolean {
            return isType(s, ts.TypeFlags.StringLike)
        }
        function isNumberType(s: ts.Expression): boolean {
            return isType(s, ts.TypeFlags.NumberLike)
        }

        ///
        /// NEWLINES, COMMENTS, and WRAPPERS
        ///
        function emitFile(file: ts.SourceFile): string {
            // emit file
            let outLns = file.getChildren()
                .map(emitNode)
                .reduce((p, c) => p.concat(c), [])

            // emit any comments that could not be associated with a
            // statement at the end of the file
            commentMap.filter(c => !c.owner)
                .forEach(comment => outLns.push(...emitComment(comment)))

            return outLns.join("\n")
        }
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

        function emitComment(comment: pxtc.decompiler.Comment) {
            let out: string[] = [];
            if (comment.kind === pxtc.decompiler.CommentKind.SingleLine) {
                out.push("# " + comment.text)
            }
            else {
                out.push(`"""`)
                for (const line of comment.lines) {
                    out.push(line);
                }
                out.push(`"""`)
            }
            return out;
        }

        function emitStmtWithNewlines(s: ts.Statement): string[] {
            const out = emitStmt(s);

            // get comments after emit so that child nodes get a chance to claim them
            const comments = pxtc.decompiler.getCommentsForStatement(s, commentMap)
                .map(emitComment)
                .reduce((p, c) => p.concat(c), [])

            return comments.concat(out);
        }

        ///
        /// STATEMENTS
        ///
        function emitStmt(s: ts.Statement): string[] {
            if (ts.isVariableStatement(s)) {
                return emitVarStmt(s)
            } else if (ts.isClassDeclaration(s)) {
                return emitClassStmt(s)
            } else if (ts.isEnumDeclaration(s)) {
                return emitEnumStmt(s)
            } else if (ts.isExpressionStatement(s)) {
                return emitExpStmt(s)
            } else if (ts.isFunctionDeclaration(s)) {
                return emitFuncDecl(s)
            } else if (ts.isIfStatement(s)) {
                return emitIf(s)
            } else if (ts.isForStatement(s)) {
                return emitForStmt(s)
            } else if (ts.isForOfStatement(s)) {
                return emitForOfStmt(s)
            } else if (ts.isWhileStatement(s)) {
                return emitWhileStmt(s)
            } else if (ts.isReturnStatement(s)) {
                return emitReturnStmt(s)
            } else if (ts.isBlock(s)) {
                return emitBlock(s)
            } else if (ts.isTypeAliasDeclaration(s)) {
                return emitTypeAliasDecl(s)
            } else if (ts.isEmptyStatement(s)) {
                return []
            } else if (ts.isModuleDeclaration(s)) {
                return emitModuleDeclaration(s);
            } else if (ts.isBreakStatement(s)) {
                return ['break']
            } else if (ts.isContinueStatement(s)) {
                return ['continue']
            } else {
                return throwError(s, 3002, `Not implemented: ${ts.SyntaxKind[s.kind]} (${s.kind})`);
            }
        }
        function emitModuleDeclaration(s: ts.ModuleDeclaration): string[] {
            let name = getName(s.name)
            let stmts = s.body && s.body.getChildren()
                .map(emitNode)
                .reduce((p, c) => p.concat(c), [])
                .map(n => indent1(n));

            return [`@namespace`, `class ${name}:`].concat(stmts || []);
        }
        function emitTypeAliasDecl(s: ts.TypeAliasDeclaration): string[] {
            let typeStr = pxtc.emitType(s.type)
            let name = getName(s.name)
            return [`${name} = ${typeStr}`]
        }
        function emitReturnStmt(s: ts.ReturnStatement): string[] {
            if (!s.expression)
                return ['return']

            let [exp, expSup] = emitExp(s.expression)
            let stmt = expWrap("return ", exp);
            return expSup.concat(stmt)
        }
        function emitWhileStmt(s: ts.WhileStatement): string[] {
            let [cond, condSup] = emitExp(s.expression)
            let body = emitBody(s.statement)
            let whileStmt = expWrap("while ", cond, ":");
            return condSup.concat(whileStmt).concat(body)
        }
        type RangeItr = {
            name: string,
            fromIncl: string,
            toExcl: string
        }
        function isNormalInteger(str: string) {
            let asInt = Math.floor(Number(str));
            return asInt !== Infinity && String(asInt) === str
        }
        function getSimpleForRange(s: ts.ForStatement): RangeItr | null {
            // must be (let i = X; ...)
            if (!s.initializer)
                return null
            if (s.initializer.kind !== ts.SyntaxKind.VariableDeclarationList)
                return null

            let initDecls = s.initializer as ts.VariableDeclarationList
            if (initDecls.declarations.length !== 1) {
                return null
            }

            let decl = initDecls.declarations[0]
            let result_name = getName(decl.name)

            if (!decl.initializer || !isConstExp(decl.initializer) || !isNumberType(decl.initializer)) {
                // TODO allow variables?
                // TODO restrict to numbers?
                return null
            }

            let [fromNum, fromNumSup] = emitExp(decl.initializer)
            if (fromNumSup.length)
                return null

            let result_fromIncl = expToStr(fromNum)

            // TODO body must not mutate loop variable

            // must be (...; i < Y; ...)
            if (!s.condition)
                return null
            if (!ts.isBinaryExpression(s.condition))
                return null
            if (!ts.isIdentifier(s.condition.left))
                return null
            if (getName(s.condition.left) != result_name)
                return null
            // TODO restrict initializers to expressions that aren't modified by the loop
            // e.g. isConstExp(s.condition.right) but more semantic
            if (!isNumberType(s.condition.right)) {
                return null
            }

            let [toNumExp, toNumSup] = emitExp(s.condition.right)
            if (toNumSup.length)
                return null

            let toNum = expToStr(toNumExp);
            let result_toExcl = toNum
            if (s.condition.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken
                && isNormalInteger(toNum)) {
                // Note that we have to be careful here because
                // <= 3.5 is not the same as < 4.5
                // so we only want to handle <= when the toNum is very well behaved
                result_toExcl = "" + (Number(toNum) + 1)
            }
            else if (s.condition.operatorToken.kind !== ts.SyntaxKind.LessThanToken)
                return null

            // must be (...; i++)
            // TODO allow += 1
            if (!s.incrementor)
                return null
            if (!ts.isPostfixUnaryExpression(s.incrementor)
                && !ts.isPrefixUnaryExpression(s.incrementor))
                return null
            if (s.incrementor.operator !== ts.SyntaxKind.PlusPlusToken)
                return null

            // must be X < Y
            if (!(result_fromIncl < result_toExcl))
                return null

            let result: RangeItr = {
                name: result_name,
                fromIncl: result_fromIncl,
                toExcl: result_toExcl
            }
            return result
        }
        function emitBody(s: ts.Statement): string[] {
            let body = emitStmt(s)
                .map(indent1)
            if (body.length < 1)
                body = [indent1("pass")]
            return body
        }
        function emitForOfStmt(s: ts.ForOfStatement): string[] {
            if (!ts.isVariableDeclarationList(s.initializer)) {
                return throwError(s, 3003, "Unsupported expression in for..of initializer: " + s.initializer.getText());
            }

            let names = s.initializer.declarations
                .map(d => getName(d.name))
            if (names.length !== 1) {
                return throwError(s, 3004, "Unsupported multiple declerations in for..of: " + s.initializer.getText()); // TODO
            }
            let name = names[0]

            let [exp, expSup] = emitExp(s.expression)

            let out = expSup
            out = out.concat(expWrap(`for ${name} in `, exp, ":"))

            let body = emitBody(s.statement)

            out = out.concat(body)

            return out
        }
        function emitForStmt(s: ts.ForStatement): string[] {
            let rangeItr = getSimpleForRange(s)
            if (rangeItr) {
                // special case (aka "repeat z times" block):
                // for (let x = y; x < z; x++)
                // ->
                // for x in range(y, z):
                // TODO ensure x and z can't be mutated in the loop body
                let { name, fromIncl, toExcl } = rangeItr;

                let forStmt = fromIncl === "0"
                    ? `for ${name} in range(${toExcl}):`
                    : `for ${name} in range(${fromIncl}, ${toExcl}):`;

                let body = emitBody(s.statement)

                return [forStmt].concat(body)
            }

            // general case:
            // for (<inits>; <cond>; <updates>)
            // ->
            // <inits>
            // while <cond>:
            //   # body
            //   <updates>
            let out: string[] = []

            // initializer(s)
            if (s.initializer) {
                if (ts.isVariableDeclarationList(s.initializer)) {
                    let decls = s.initializer.declarations
                        .map(emitVarDecl)
                        .reduce((p, c) => p.concat(c), [])
                    out = out.concat(decls)
                } else {
                    let [exp, expSup] = emitExp(s.initializer)
                    out = out.concat(expSup).concat(exp)
                }
            }

            // condition(s)
            let cond: string;
            if (s.condition) {
                let [condStr, condSup] = emitExp(s.condition)
                out = out.concat(condSup)
                cond = expToStr(condStr);
            } else {
                cond = "True"
            }
            let whileStmt = `while ${cond}:`
            out.push(whileStmt)

            // body
            let body = emitStmt(s.statement)
                .map(indent1)
            if (body.length === 0 && !s.incrementor)
                body = [indent1("pass")]
            out = out.concat(body)

            // updater(s)
            if (s.incrementor) {
                let unaryIncDec = tryEmitIncDecUnaryStmt(s.incrementor)
                if (unaryIncDec) {
                    // special case: ++ or --
                    out = out.concat(unaryIncDec.map(indent1))
                }
                else {
                    // general case
                    let [inc, incSup] = emitExp(s.incrementor)
                    out = out.concat(incSup)
                        .concat(inc.map(indent1))
                }
            }

            return out
        }
        function emitIf(s: ts.IfStatement): string[] {
            let { supportStmts, ifStmt, rest } = emitIfHelper(s)
            return supportStmts.concat([ifStmt]).concat(rest)
        }
        function emitIfHelper(s: ts.IfStatement): { supportStmts: string[], ifStmt: string, rest: string[] } {
            let sup: string[] = []

            let [cond, condSup] = emitExp(s.expression)
            sup = sup.concat(condSup)

            let ifStmt = `if ${expToStr(cond)}:`

            let ifRest: string[] = []
            let th = emitBody(s.thenStatement)
            ifRest = ifRest.concat(th)

            if (s.elseStatement) {
                if (ts.isIfStatement(s.elseStatement)) {
                    let { supportStmts, ifStmt, rest } = emitIfHelper(s.elseStatement)
                    let elif = `el${ifStmt}`
                    sup = sup.concat(supportStmts)
                    ifRest.push(elif)
                    ifRest = ifRest.concat(rest)
                }
                else {
                    ifRest.push("else:")
                    let el = emitBody(s.elseStatement)
                    ifRest = ifRest.concat(el)
                }
            }

            return { supportStmts: sup, ifStmt: ifStmt, rest: ifRest };
        }
        function emitVarStmt(s: ts.VariableStatement): string[] {
            let decls = s.declarationList.declarations;
            return decls
                .map(emitVarDecl)
                .reduce((p, c) => p.concat(c), [])
        }
        function emitClassStmt(s: ts.ClassDeclaration): string[] {
            let out: string[] = []

            // TODO handle inheritence

            if (!s.name) {
                return throwError(s, 3011, "Unsupported: anonymous class");
            }

            let isEnum = s.members.every(isEnumMem) // TODO hack?
            let name = getName(s.name)
            if (isEnum)
                out.push(`class ${name}(Enum):`)
            else
                out.push(`class ${name}:`)

            let mems = s.members
                .map(emitClassMem)
                .reduce((p, c) => p.concat(c), [])
                .filter(m => m)
            if (mems.length) {
                out = out.concat(mems.map(indent1))
            }

            return out;
        }
        function emitEnumStmt(s: ts.EnumDeclaration): string[] {
            let out: string[] = []

            out.push(`class ${getName(s.name)}(Enum):`)

            let allInit = s.members
                .every(m => !!m.initializer)
            let noInit = !s.members
                .every(m => !!m.initializer)

            if (!allInit && !noInit) {
                return throwError(s, 3005, "Unsupported enum decleration: has mixture of explicit and implicit initialization");
            }

            if (allInit) {
                // TODO
                // let memAndSup = s.members
                //     .map(m => [m, emitExp(m.initializer)] as [ts.EnumMember, ExpRes])
                return throwError(s, 3006, "Unsupported: explicit enum initialization");
            }

            let val = 0
            for (let m of s.members) {
                out.push(indent1(`${getName(m.name)} = ${val++}`))
            }

            return out
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
            if (!prop.initializer)
                return false;
            if (prop.initializer.kind !== ts.SyntaxKind.NumericLiteral)
                return false;

            return true
        }
        function emitClassMem(s: ts.ClassElement): string[] {
            switch (s.kind) {
                case ts.SyntaxKind.PropertyDeclaration:
                    return emitPropDecl(s as ts.PropertyDeclaration)
                case ts.SyntaxKind.MethodDeclaration:
                    return emitFuncDecl(s as ts.MethodDeclaration)
                case ts.SyntaxKind.Constructor:
                    return emitFuncDecl(s as ts.ConstructorDeclaration)
                default:
                    return ["# unknown ClassElement " + s.kind]
            }
        }
        function emitPropDecl(s: ts.PropertyDeclaration): string[] {
            let nm = getName(s.name)
            if (s.initializer) {
                let [init, initSup] = emitExp(s.initializer)
                return initSup.concat([`${nm} = ${expToStr(init)}`])
            }
            else {
                // can't do declerations without initilization in python
                return []
            }
        }
        function isUnaryPlusPlusOrMinusMinus(e: ts.Expression): e is ts.PrefixUnaryExpression | ts.PostfixUnaryExpression {
            if (!ts.isPrefixUnaryExpression(e) &&
                !ts.isPostfixUnaryExpression(e))
                return false
            if (e.operator !== ts.SyntaxKind.MinusMinusToken &&
                e.operator !== ts.SyntaxKind.PlusPlusToken)
                return false
            return true
        }
        function tryEmitIncDecUnaryStmt(e: ts.Expression): string[] | null {
            // special case ++ or -- as a statement
            if (!isUnaryPlusPlusOrMinusMinus(e))
                return null

            let [operand, sup] = emitExp(e.operand)
            let incDec = e.operator === ts.SyntaxKind.MinusMinusToken ? " -= 1" : " += 1"

            let out = sup
            out.push(`${expToStr(operand)}${incDec}`)

            return out
        }
        function emitExpStmt(s: ts.ExpressionStatement): string[] {
            let unaryExp = tryEmitIncDecUnaryStmt(s.expression);
            if (unaryExp)
                return unaryExp

            let [exp, expSup] = emitExp(s.expression)
            return expSup.concat(exp)
        }
        function emitBlock(s: ts.Block): string[] {
            let stmts = s.getChildren()
                .map(emitNode)
                .reduce((p, c) => p.concat(c), [])
            return stmts
        }
        function emitFuncDecl(s: ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression | ts.ConstructorDeclaration | ts.ArrowFunction,
            name?: string, altParams?: ts.NodeArray<ts.ParameterDeclaration>, skipTypes?: boolean): string[] {
            // TODO determine captured variables, then determine global and nonlocal directives
            // TODO helper function for determining if an expression can be a python expression
            let paramList: string[] = []

            if (s.kind === ts.SyntaxKind.MethodDeclaration ||
                s.kind === ts.SyntaxKind.Constructor) {
                paramList.push("self")
            }

            let paramDeclDefs = altParams ? mergeParamDecls(s.parameters, altParams) : s.parameters

            let paramDecls = paramDeclDefs
                .map(d => emitParamDecl(d, !skipTypes))
            paramList = paramList.concat(paramDecls)

            let params = paramList.join(", ")

            let out = []

            let fnName: string
            if (s.kind === ts.SyntaxKind.Constructor) {
                fnName = "__init__"
            }
            else {
                if (name)
                    fnName = name
                else if (s.name)
                    fnName = getName(s.name)
                else
                    return throwError(s, 3012, "Unsupported: anonymous function decleration");
            }

            out.push(`def ${fnName}(${params}):`)

            if (!s.body)
                return throwError(s, 3013, "Unsupported: function decleration without body");

            let stmts: string[] = []
            if (ts.isBlock(s.body))
                stmts = emitBlock(s.body)
            else {
                let [exp, sup] = emitExp(s.body)
                stmts = stmts.concat(sup)
                stmts.concat(exp)
            }
            if (stmts.length) {
                // global or nonlocal declerations
                let globals = scopeLookup.getExplicitGlobals(s)
                    .map(g => getName(g))
                if (globals && globals.length)
                    stmts.unshift(`global ${globals.join(", ")}`)
                let nonlocals = scopeLookup.getExplicitNonlocals(s)
                    .map(n => getName(n))
                if (nonlocals && nonlocals.length)
                    stmts.unshift(`nonlocal ${nonlocals.join(", ")}`)

                out = out.concat(stmts.map(indent1))
            } else {
                out.push(indent1("pass")) // cannot have an empty body
            }

            return out
        }
        function emitParamDecl(s: ParameterDeclarationExtended, inclTypesIfAvail = true): string {
            let nm = s.altName || getName(s.name)
            let typePart = ""
            if (s.type && inclTypesIfAvail) {
                let typ = pxtc.emitType(s.type)

                if (typ && typ.indexOf("(TODO") === -1) {
                    typePart = `: ${typ}`
                }
            }
            let initPart = ""
            if (s.initializer) {
                let [initExp, initSup] = emitExp(s.initializer)
                if (initSup.length) {
                    return throwError(s, 3007, `TODO: complex expression in parameter default value not supported. Expression: ${s.initializer.getText()}`)
                }
                initPart = ` = ${expToStr(initExp)}`
            }
            return `${nm}${typePart}${initPart}`
        }
        function emitVarDecl(s: ts.VariableDeclaration): string[] {
            let out: string[] = []
            let varNm = getName(s.name);
            // out.push(`#let ${varNm}`) // TODO debug
            // varNm = introVar(varNm, s.name)
            if (s.initializer) {
                // TODO
                // let syms = tc.getSymbolsInScope(s, ts.SymbolFlags.Variable)
                // let symTxt = "#@ " + syms.map(s => s.name).join(", ")
                // out.push(symTxt)
                let [exp, expSup] = emitExp(s.initializer);
                out = out.concat(expSup)
                let declStmt: string;
                if (s.type) {
                    let translatedType = pxtc.emitType(s.type)
                    declStmt = `${varNm}: ${translatedType} = ${expToStr(exp)}`
                } else {
                    declStmt = `${varNm} = ${expToStr(exp)}`
                }
                out.push(declStmt)
                return out
            } else {
                // can't do declerations without initilization in python
            }
            return out
        }

        ///
        /// EXPRESSIONS
        ///
        type ExpRes = [/*expression:*/string[], /*supportingStatements:*/string[]]
        function asExpRes(str: string, sup?: string[]): ExpRes {
            return [[str], sup || []]
        }
        function expToStr(exps: string[], char: string = '\n'): string {
            return exps.join(char)
        }
        function expWrap(pre: string = "", exps: string[], suff: string = ""): string[] {
            exps[0] = pre + exps[0];
            exps[exps.length - 1] = exps[exps.length - 1] + suff;
            return exps;
        }
        function emitOp(s: ts.BinaryOperator | ts.PrefixUnaryOperator | ts.PostfixUnaryOperator, node: ts.Node): string {
            switch (s) {
                case ts.SyntaxKind.BarBarToken:
                    return "or"
                case ts.SyntaxKind.AmpersandAmpersandToken:
                    return "and"
                case ts.SyntaxKind.ExclamationToken:
                    return "not"
                case ts.SyntaxKind.LessThanToken:
                    return "<"
                case ts.SyntaxKind.LessThanEqualsToken:
                    return "<="
                case ts.SyntaxKind.GreaterThanToken:
                    return ">"
                case ts.SyntaxKind.GreaterThanEqualsToken:
                    return ">="
                case ts.SyntaxKind.EqualsEqualsEqualsToken:
                case ts.SyntaxKind.EqualsEqualsToken:
                    // TODO distinguish === from == ?
                    return "=="
                case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                case ts.SyntaxKind.ExclamationEqualsToken:
                    // TODO distinguish !== from != ?
                    return "!="
                case ts.SyntaxKind.EqualsToken:
                    return "="
                case ts.SyntaxKind.PlusToken:
                    return "+"
                case ts.SyntaxKind.MinusToken:
                    return "-"
                case ts.SyntaxKind.AsteriskToken:
                    return "*"
                case ts.SyntaxKind.PlusEqualsToken:
                    return "+="
                case ts.SyntaxKind.MinusEqualsToken:
                    return "-="
                case ts.SyntaxKind.PercentToken:
                    return "%"
                case ts.SyntaxKind.SlashToken:
                    return "/"
                case ts.SyntaxKind.PlusPlusToken:
                case ts.SyntaxKind.MinusMinusToken:
                    // TODO handle "--" & "++" generally. Seperate prefix and postfix cases.
                    // This is tricky because it needs to return the value and the mutate after.
                    return throwError(node, 3008, "Unsupported ++ and -- in an expression (not a statement or for loop)");
                case ts.SyntaxKind.AmpersandToken:
                    return "&"
                case ts.SyntaxKind.CaretToken:
                    return "^"
                case ts.SyntaxKind.LessThanLessThanToken:
                    return "<<"
                case ts.SyntaxKind.GreaterThanGreaterThanToken:
                    return ">>"
                case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                    return throwError(node, 3009, "Unsupported operator: >>>");
                case ts.SyntaxKind.AsteriskAsteriskToken:
                    return "**"
                case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
                    return "**="
                case ts.SyntaxKind.PercentEqualsToken:
                    return "%="
                case ts.SyntaxKind.AsteriskEqualsToken:
                    return "*="
                case ts.SyntaxKind.SlashEqualsToken:
                    return "/="
                default:
                    pxt.tickEvent("depython.todo", { op: s })
                    return throwError(node, 3008, `Unsupported Python operator (code: ${s})`);
            }
        }
        function emitBinExp(s: ts.BinaryExpression): ExpRes {
            // handle string concatenation
            // TODO handle implicit type conversions more generally
            let isLStr = isStringType(s.left)
            let isRStr = isStringType(s.right)
            let isStrConcat = s.operatorToken.kind === ts.SyntaxKind.PlusToken
                && (isLStr || isRStr)

            let [left, leftSup] = emitExp(s.left)
            if (isStrConcat && !isLStr)
                left = expWrap("str(", left, ")")

            let op = emitOp(s.operatorToken.kind, s)

            let [right, rightSup] = emitExp(s.right)
            if (isStrConcat && !isRStr)
                right = expWrap("str(", right, ")")
            let sup = leftSup.concat(rightSup)

            return [expWrap(expToStr(left) + " " + op + " ", right), sup];
        }
        function emitDotExp(s: ts.PropertyAccessExpression): ExpRes {
            // short-circuit if the dot expression is a well-known symbol
            let pyName = tryGetPyName(s)
            if (pyName)
                return asExpRes(pyName)

            let [left, leftSup] = emitExp(s.expression)
            let right = getName(s.name)
            // special: foo.length
            if (right === "length") {
                // TODO confirm the type is correct!
                return asExpRes(`len(${expToStr(left)})`, leftSup)
            }

            return asExpRes(`${expToStr(left)}.${right}`, leftSup);
        }
        function getSimpleExpNameParts(s: ts.Expression): string[] {
            // TODO(dz): Impl skip namespaces properly. Right now we just skip the left-most part of a property access
            if (ts.isPropertyAccessExpression(s)) {
                let nmPart = getName(s.name)
                if (ts.isIdentifier(s.expression)) {
                    if (nmPart.indexOf(".") >= 0) nmPart = nmPart.substr(nmPart.lastIndexOf(".") + 1);
                    return [nmPart]
                }
                return getSimpleExpNameParts(s.expression).concat([nmPart])
            }
            else if (ts.isIdentifier(s)) {
                return [getName(s)]
            }
            else // TODO handle more cases like indexing?
                return []
        }
        function getNameHint(param?: ts.ParameterDeclaration, calleeExp?: ts.Expression, allParams?: ts.NodeArray<ts.ParameterDeclaration>, allArgs?: ReadonlyArray<ts.Expression>): string {
            // get words from the callee
            let calleePart: string = ""
            if (calleeExp)
                calleePart = getSimpleExpNameParts(calleeExp)
                    .map(pxtc.snakify)
                    .join("_")

            // get words from the previous parameter(s)/arg(s)
            let enumParamParts: string[] = []
            if (allParams && allParams.length > 1 && allArgs && allArgs.length > 1) {
                // special case: if there are enum parameters, use those as part of the hint
                for (let i = 0; i < allParams.length && i < allArgs.length; i++) {
                    let arg = allArgs[i]
                    let argType = tc.getTypeAtLocation(arg)
                    if (hasTypeFlag(argType, ts.TypeFlags.EnumLike)) {
                        let argParts = getSimpleExpNameParts(arg)
                            .map(pxtc.snakify)
                        enumParamParts = enumParamParts.concat(argParts)
                    }
                }
            }
            let otherParamsPart = enumParamParts.join("_")

            // get words from this parameter/arg as last resort
            let paramPart: string = ""
            if (!calleePart && !otherParamsPart && param)
                paramPart = getName(param.name)

            // the full hint
            let hint = [calleePart, otherParamsPart, paramPart]
                .filter(s => s)
                .map(pxtc.snakify)
                .map(s => s.toLowerCase())
                .join("_") || "my_callback"

            // sometimes the full hint is too long so shorten them using some heuristics
            // 1. remove duplicate words
            // e.g. controller_any_button_on_event_controller_button_event_pressed_callback
            //   -> controller_any_button_on_event_pressed_callback
            let allWords = hint.split("_")
            if (allWords.length > 4) {
                allWords = dedupWords(allWords)
            }
            // 2. remove less-informative words
            let lessUsefulWords = pxt.U.toDictionary(["any", "on", "event"], s => s)
            while (allWords.length > 2) {
                let newWords = removeOne(allWords, lessUsefulWords)
                if (newWords.length == allWords.length)
                    break
                allWords = newWords
            }
            // 3. add an "on_" prefix
            allWords = ["on", ...allWords]

            return allWords.join("_")
            function dedupWords(words: string[]): string[] {
                let usedWords: pxt.Map<boolean> = {}
                let out: string[] = []
                for (let w of words) {
                    if (w in usedWords)
                        continue
                    usedWords[w] = true
                    out.push(w)
                }
                return out
            }
            function removeOne(words: string[], exclude: pxt.Map<string>): string[] {
                let out: string[] = []
                let oneExcluded = false
                for (let w of words) {
                    if (w in exclude && !oneExcluded) {
                        oneExcluded = true
                        continue
                    }
                    out.push(w)
                }
                return out
            }
        }
        // determine whether a comma-separated list (array, function parameters) should
        // use newlines to separate items
        function getCommaSep(exps: string[]): string[] {
            let res = exps.join(", ");
            if (res.length > 60 && exps.length > 1) {
                return exps.map((el, i) => {
                    let sep = el.charAt(el.length - 1) == "," ? "" : ",";
                    if (i == 0) {
                        return el + sep;
                    } else if (i == exps.length - 1) {
                        return indent1(el);
                    } else {
                        return indent1(el + sep);
                    }
                })
            }
            return [res];
        }
        function emitArgExp(s: ts.Expression, param?: ts.ParameterDeclaration, calleeExp?: ts.Expression, allParams?: ts.NodeArray<ts.ParameterDeclaration>, allArgs?: ReadonlyArray<ts.Expression>): ExpRes {
            // special case: function arguments to higher-order functions
            // reason 1: if the argument is a function and the parameter it is being passed to is also a function type,
            // then we want to pass along the parameter's function parameters to emitFnExp so that the argument will fit the
            // parameter type. This is because TypeScript/Javascript allows passing a function with fewer parameters to an
            // argument that is a function with more parameters while Python does not.
            // Key example: callbacks
            // this code compiles in TS:
            //      function onEvent(callback: (a: number) => void) { ... }
            //      onEvent(function () { ... })
            // yet in python this is not allowed, we have to add more parameters to the anonymous declaration to match like this:
            //      onEvent(function (a: number) { ... })
            // see "callback_num_args.ts" test case for more details.
            // reason 2: we want to generate good names, which requires context about the function it is being passed to an other parameters
            if ((ts.isFunctionExpression(s) || ts.isArrowFunction(s)) && param) {
                if (param.type && ts.isFunctionTypeNode(param.type)) {
                    // TODO(dz): uncomment to support reason #1 above. I've disabled this for now because it generates uglier
                    // code if we don't have support in py2ts to reverse this
                    // let altParams = param.type.parameters
                    let altParams = undefined
                    let fnNameHint = getNameHint(param, calleeExp, allParams, allArgs)
                    return emitFnExp(s, fnNameHint, altParams, true)
                }
            }

            return emitExp(s)
        }
        function emitCallExp(s: ts.CallExpression | ts.NewExpression): ExpRes {
            // get callee parameter info
            let calleeType = tc.getTypeAtLocation(s.expression)
            let calleeTypeNode = tc.typeToTypeNode(calleeType)
            let calleeParameters: ts.NodeArray<ts.ParameterDeclaration> = ts.createNodeArray([])
            if (ts.isFunctionTypeNode(calleeTypeNode)) {
                calleeParameters = calleeTypeNode.parameters
                if (s.arguments && calleeParameters.length < s.arguments.length) {
                    pxt.tickEvent("depython.todo", { kind: s.kind })
                    return throwError(s, 3010, "TODO: Unsupported call site where caller the arguments outnumber the callee parameters: " + s.getText());
                }
            }

            // special case TD_ID function, don't emit them
            const sym = tryGetSymbol(s.expression);
            if (s.arguments && sym && sym.attributes.shim == "TD_ID") {
                // this function is a no-op and should not be emitted
                return emitExp(s.arguments[0])
            }

            // TODO inspect type info to rewrite things like console.log, Math.max, etc.
            let [fnExp, fnSup] = emitExp(s.expression)
            let fn = expToStr(fnExp);

            let sargs = s.arguments || ts.createNodeArray();
            let argExps = sargs
                .map((a, i, allArgs) => emitArgExp(a, calleeParameters[i], s.expression, calleeParameters, allArgs))
            let sup = argExps
                .map(([_, aSup]) => aSup)
                .reduce((p, c) => p.concat(c), fnSup)

            if (fn.indexOf("_py.py_") === 0) {
                if (argExps.length <= 0)
                    return throwError(s, 3014, "Unsupported: call expression has no arguments for _py.py_ fn");
                // The format is _py.py_type_name, so remove the type
                fn = fn.substr(7).split("_").filter((_, i) => i !== 0).join("_");
                const recv = argExps.shift()![0];
                const args = getCommaSep(argExps.map(([a, _]) => a).reduce((p, c) => p.concat(c), []))
                return [expWrap(`${recv}.${fn}(`, args, ")"), sup]
            }

            let args = getCommaSep(argExps.map(([a, _]) => a).reduce((p, c) => p.concat(c), [])) //getCommaSep(argExps.map(([a, _]) => a));
            return [expWrap(`${fn}(`, args, ")"), sup]
        }
        type ParameterDeclarationExtended = ts.ParameterDeclaration & { altName?: string }
        function mergeParamDecls(primary: ts.NodeArray<ts.ParameterDeclaration>, alt: ts.NodeArray<ts.ParameterDeclaration>): ts.NodeArray<ParameterDeclarationExtended> {
            // Note: possible name collisions between primary and alt parameters is handled by marking
            // alt parameters as "unused" so that we can generate them new names without renaming
            let decls: ParameterDeclarationExtended[] = []
            let paramNames: pxt.Map<boolean> = {}
            for (let i = 0; i < Math.max(primary.length, alt.length); i++) {
                let p: ParameterDeclarationExtended;
                if (primary[i]) {
                    p = primary[i]
                    paramNames[getName(p.name)] = true
                } else {
                    p = alt[i]
                    let name = getName(p.name)
                    if (paramNames[name]) {
                        name = pxtc.decompiler.getNewName(name, paramNames)
                        p = Object.assign({ altName: name }, alt[i])
                    }
                }
                decls.push(p)
            }
            return ts.createNodeArray(decls, false)
        }
        function emitFnExp(s: ts.FunctionExpression | ts.ArrowFunction, nameHint?: string, altParams?: ts.NodeArray<ts.ParameterDeclaration>, skipType?: boolean): ExpRes {
            // if the anonymous function is simple enough, use a lambda
            if (!ts.isBlock(s.body)) {
                // TODO we're speculatively emitting this expression. This speculation is only safe if emitExp is pure, which it's not quite today (e.g. getNewGlobalName)
                let [fnBody, fnSup] = emitExp(s.body as ts.Expression)
                if (fnSup.length === 0) {
                    let paramDefs = altParams ? mergeParamDecls(s.parameters, altParams) : s.parameters
                    let paramList = paramDefs
                        .map(p => emitParamDecl(p, false))
                        .join(", ");

                    let stmt = paramList.length
                        ? `lambda ${paramList}: ${expToStr(fnBody)}`
                        : `lambda: ${expToStr(fnBody)}`;
                    return asExpRes(stmt)
                }
            }

            // otherwise emit a standard "def myFunction(...)" declaration
            let fnName = s.name ? getName(s.name) : getNewGlobalName(nameHint || "my_function")
            let fnDef = emitFuncDecl(s, fnName, altParams, skipType)

            return asExpRes(fnName, fnDef)
        }
        function getUnaryOpSpacing(s: ts.SyntaxKind): string {
            switch (s) {
                case ts.SyntaxKind.ExclamationToken: // not
                    return " "
                case ts.SyntaxKind.PlusToken:
                case ts.SyntaxKind.MinusToken:
                    return ""
                default:
                    return " "
            }
        }
        function emitPreUnaryExp(s: ts.PrefixUnaryExpression): ExpRes {
            let op = emitOp(s.operator, s);
            let [exp, expSup] = emitExp(s.operand)
            // TODO handle order-of-operations ? parenthesis?
            let space = getUnaryOpSpacing(s.operator)
            let res = `${op}${space}${expToStr(exp)}`
            return asExpRes(res, expSup)
        }
        function emitPostUnaryExp(s: ts.PostfixUnaryExpression): ExpRes {
            let op = emitOp(s.operator, s);
            let [exp, expSup] = emitExp(s.operand)
            // TODO handle order-of-operations ? parenthesis?
            let space = getUnaryOpSpacing(s.operator)
            let res = `${expToStr(exp)}${space}${op}`
            return asExpRes(res, expSup)
        }
        function emitArrayLitExp(s: ts.ArrayLiteralExpression): ExpRes {
            let els = s.elements
                .map(emitExp);
            let sup = els
                .map(([_, sup]) => sup)
                .reduce((p, c) => p.concat(c), [])

            let inner = getCommaSep(els.map(([e, _]) => e).reduce((p, c) => p.concat(c), []));
            return [expWrap("[", inner, "]"), sup]
        }
        function emitElAccessExp(s: ts.ElementAccessExpression): ExpRes {
            if (!s.argumentExpression)
                return throwError(s, 3015, "Unsupported: element access expression without an argument expression");
            let [left, leftSup] = emitExp(s.expression)
            let [arg, argSup] = emitExp(s.argumentExpression)
            let sup = leftSup.concat(argSup)
            let exp = `${expToStr(left)}[${expToStr(arg)}]`
            return asExpRes(exp, sup)
        }
        function emitParenthesisExp(s: ts.ParenthesizedExpression): ExpRes {
            let [inner, innerSup] = emitExp(s.expression)
            return asExpRes(`(${expToStr(inner)})`, innerSup)
        }
        function emitMultiLnStrLitExp(s: ts.NoSubstitutionTemplateLiteral | ts.TaggedTemplateExpression): ExpRes {
            if (ts.isNoSubstitutionTemplateLiteral(s))
                return asExpRes(`"""${s.text}"""`)

            let [tag, tagSup] = emitExp(s.tag)
            let [temp, tempSup] = emitExp(s.template)
            let sup = tagSup.concat(tempSup)
            let exp = `${expToStr(tag)}(${expToStr(temp)})`;
            return asExpRes(exp, sup)
        }
        function emitIdentifierExp(s: ts.Identifier): ExpRes {
            // TODO disallow keywords and built-ins?
            // TODO why isn't undefined showing up as a keyword?
            // let id = s.text;
            if (s.text == "undefined")
                return asExpRes("None")
            let name = getName(s)
            return asExpRes(name);
        }
        function visitExp(s: ts.Expression, fn: (e: ts.Expression) => boolean): boolean {
            let visitRecur = (s: ts.Expression) =>
                visitExp(s, fn)

            if (ts.isBinaryExpression(s)) {
                return visitRecur(s.left) && visitRecur(s.right)
            } else if (ts.isPropertyAccessExpression(s)) {
                return visitRecur(s.expression)
            } else if (ts.isPrefixUnaryExpression(s) || ts.isPostfixUnaryExpression(s)) {
                return s.operator !== ts.SyntaxKind.PlusPlusToken
                    && s.operator !== ts.SyntaxKind.MinusMinusToken
                    && visitRecur(s.operand)
            } else if (ts.isParenthesizedExpression(s)) {
                return visitRecur(s.expression)
            } else if (ts.isArrayLiteralExpression(s)) {
                return s.elements
                    .map(visitRecur)
                    .reduce((p, c) => p && c, true)
            } else if (ts.isElementAccessExpression(s)) {
                return visitRecur(s.expression)
                    && (!s.argumentExpression || visitRecur(s.argumentExpression))
            }

            return fn(s)
        }
        function isConstExp(s: ts.Expression): boolean {
            let isConst = (s: ts.Expression): boolean => {
                switch (s.kind) {
                    case ts.SyntaxKind.PropertyAccessExpression:
                    case ts.SyntaxKind.BinaryExpression:
                    case ts.SyntaxKind.ParenthesizedExpression:
                    case ts.SyntaxKind.ArrayLiteralExpression:
                    case ts.SyntaxKind.ElementAccessExpression:
                    case ts.SyntaxKind.TrueKeyword:
                    case ts.SyntaxKind.FalseKeyword:
                    case ts.SyntaxKind.NullKeyword:
                    case ts.SyntaxKind.UndefinedKeyword:
                    case ts.SyntaxKind.NumericLiteral:
                    case ts.SyntaxKind.StringLiteral:
                    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                        return true
                    case ts.SyntaxKind.CallExpression:
                    case ts.SyntaxKind.NewExpression:
                    case ts.SyntaxKind.FunctionExpression:
                    case ts.SyntaxKind.ArrowFunction:
                    case ts.SyntaxKind.Identifier:
                    case ts.SyntaxKind.ThisKeyword:
                        return false
                    case ts.SyntaxKind.PrefixUnaryExpression:
                    case ts.SyntaxKind.PostfixUnaryExpression:
                        let e = s as ts.PrefixUnaryExpression | ts.PostfixUnaryExpression
                        return e.operator !== ts.SyntaxKind.PlusPlusToken
                            && e.operator !== ts.SyntaxKind.MinusMinusToken
                }
                return false
            }
            return visitExp(s, isConst)
        }
        function emitCondExp(s: ts.ConditionalExpression): ExpRes {
            let [cond, condSup] = emitExp(s.condition)
            let [tru, truSup] = emitExp(s.whenTrue)
            let [fls, flsSup] = emitExp(s.whenFalse)
            let sup = condSup.concat(truSup).concat(flsSup)
            let exp = `${tru} if ${expToStr(cond)} else ${expToStr(fls)}`
            return asExpRes(exp, sup)
        }
        function emitExp(s: ts.Expression): ExpRes {
            if (ts.isBinaryExpression(s))
                return emitBinExp(s)
            if (ts.isPropertyAccessExpression(s))
                return emitDotExp(s)
            if (ts.isCallExpression(s))
                return emitCallExp(s)
            if (ts.isNewExpression(s))
                return emitCallExp(s)
            if (ts.isFunctionExpression(s) || ts.isArrowFunction(s))
                return emitFnExp(s)
            if (ts.isPrefixUnaryExpression(s))
                return emitPreUnaryExp(s)
            if (ts.isPostfixUnaryExpression(s))
                return emitPostUnaryExp(s)
            if (ts.isParenthesizedExpression(s))
                return emitParenthesisExp(s)
            if (ts.isArrayLiteralExpression(s))
                return emitArrayLitExp(s)
            if (ts.isElementAccessExpression(s))
                return emitElAccessExp(s)
            if (ts.isNoSubstitutionTemplateLiteral(s) || ts.isTaggedTemplateExpression(s))
                return emitMultiLnStrLitExp(s as ts.NoSubstitutionTemplateLiteral | ts.TaggedTemplateExpression)
            switch (s.kind) {
                case ts.SyntaxKind.TrueKeyword:
                    return asExpRes("True")
                case ts.SyntaxKind.FalseKeyword:
                    return asExpRes("False")
                case ts.SyntaxKind.ThisKeyword:
                    return asExpRes("self")
                case ts.SyntaxKind.NullKeyword:
                case ts.SyntaxKind.UndefinedKeyword:
                    return asExpRes("None")
            }
            if (ts.isIdentifier(s))
                return emitIdentifierExp(s)
            if (ts.isNumericLiteral(s) || ts.isStringLiteral(s))
                // TODO handle weird syntax?
                return asExpRes(s.getText())
            if (ts.isConditionalExpression(s))
                return emitCondExp(s)

            // TODO handle more expressions
            return asExpRes(s.getText(), ["# unknown expression:  " + s.kind]) // uncomment for easier locating
            // throw Error("Unknown expression: " + s.kind)
        }
    }
}