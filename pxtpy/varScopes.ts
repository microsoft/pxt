namespace pxt.py {
    ///
    /// VARIABLE SCOPE ANALYSIS
    ///
    interface VarRead {
        kind: "read",
        node: ts.Identifier,
        varName: string
    }
    type VarDeclNodeType = ts.VariableDeclaration | ts.ParameterDeclaration
        | ts.FunctionExpression | ts.FunctionDeclaration | ts.ArrowFunction
        | ts.MethodDeclaration
    interface VarDecl {
        kind: "decl",
        node: VarDeclNodeType,
        varName: string
    }
    type VarAssignNodeType = ts.AssignmentExpression<ts.AssignmentOperatorToken>
        | ts.PostfixUnaryExpression | ts.PrefixUnaryExpression
    interface VarAssign {
        kind: "assign",
        node: VarAssignNodeType,
        varName: string
    }
    function isAssignmentExpression(s: ts.Node): s is ts.AssignmentExpression<ts.AssignmentOperatorToken> {
        // why is this not built in...
        const AssignmentOperators: ts.AssignmentOperator[] = [
            ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken,
            ts.SyntaxKind.MinusEqualsToken, ts.SyntaxKind.AsteriskEqualsToken,
            ts.SyntaxKind.AsteriskAsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken,
            ts.SyntaxKind.PercentEqualsToken, ts.SyntaxKind.LessThanLessThanEqualsToken,
            ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
            ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
            ts.SyntaxKind.AmpersandEqualsToken, ts.SyntaxKind.BarEqualsToken,
            ts.SyntaxKind.CaretEqualsToken
        ]
        return ts.isBinaryExpression(s)
            && !!AssignmentOperators.find(o => s.operatorToken.kind === o)
    }
    type VarUse = VarRead | VarAssign
    type VarRef = VarRead | VarDecl | VarAssign
    interface VarScope {
        refs: VarRef[],
        children: VarScope[],
        owner: ts.FunctionLikeDeclaration | undefined
    }
    function computeVarScopes(node: ts.Node): VarScope {
        const EMPTY: VarScope = { refs: [], children: [], owner: undefined }

        return walk(node)

        function walk(s: ts.Node | undefined): VarScope {
            if (!s)
                return EMPTY

            // ignore these subtrees because identifiers
            // in here are not variable usages
            if (ts.isPropertyAccessOrQualifiedName(s))
                return EMPTY

            // variable usage
            if (ts.isIdentifier(s)) {
                return {
                    refs: [{
                        kind: "read",
                        node: s,
                        varName: s.text
                    }],
                    children: [],
                    owner: undefined
                }
            }

            // variable decleration
            if (ts.isVariableDeclaration(s) || ts.isParameter(s)) {
                let init = walk(s.initializer)
                return {
                    refs: [...init.refs, {
                        kind: "decl",
                        node: s,
                        varName: s.name.getText()
                    }],
                    children: init.children,
                    owner: undefined
                }
            }

            // variable assignment
            if (ts.isPrefixUnaryExpression(s) || ts.isPostfixUnaryExpression(s)) {
                let operandUse = walk(s.operand)
                let varName = s.operand.getText()
                let assign: VarScope = {
                    refs: [{
                        kind: "assign",
                        node: s,
                        varName,
                    }],
                    children: [],
                    owner: undefined
                }
                return merge(operandUse, assign)
            }
            if (isAssignmentExpression(s)) {
                let rightUse = walk(s.right)
                let leftUse: VarScope | undefined;
                if (s.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
                    leftUse = walk(s.left)
                }
                let varName = s.left.getText()
                let assign: VarScope = {
                    refs: [{
                        kind: "assign",
                        node: s,
                        varName,
                    }],
                    children: [],
                    owner: undefined
                }
                return merge(leftUse, merge(rightUse, assign))
            }

            // new scope
            if (ts.isFunctionExpression(s)
                || ts.isArrowFunction(s)
                || ts.isFunctionDeclaration(s)
                || ts.isMethodDeclaration(s)) {
                let fnName = s.name?.getText()
                let fnDecl: VarDecl | undefined = undefined;
                if (fnName) {
                    fnDecl = {
                        kind: "decl",
                        node: s,
                        varName: fnName
                    }
                }
                let params = s.parameters
                    .map(p => walk(p))
                    .reduce(merge, EMPTY)
                let body = walk(s.body)
                let child = merge(params, body)
                child.owner = s
                return {
                    refs: fnDecl ? [fnDecl] : [],
                    children: [child],
                    owner: undefined
                }
            }

            // keep walking
            return s.getChildren()
                .map(walk)
                .reduce(merge, EMPTY)
        }

        function merge(p: VarScope | undefined, n: VarScope | undefined): VarScope {
            if (!p || !n)
                return p || n || EMPTY
            return {
                refs: [...p.refs, ...n.refs],
                children: [...p.children, ...n.children],
                owner: p.owner || n.owner
            }
        }
    }
    interface VarUsages {
        globalUsage: VarUse[],
        nonlocalUsage: VarUse[],
        localUsage: VarUse[],
        environmentUsage: VarUse[],
        children: VarUsages[],
        owner: ts.FunctionLikeDeclaration | undefined
    }
    function getExplicitGlobals(u: VarUsages): VarAssign[] {
        return [...u.globalUsage, ...u.environmentUsage]
            .filter(r => r.kind === "assign")
            .map(r => r as VarAssign)
    }
    function getExplicitNonlocals(u: VarUsages): VarAssign[] {
        return u.nonlocalUsage
            .filter(r => r.kind === "assign")
            .map(r => r as VarAssign)
    }
    type Decls = { [key: string]: VarDecl }
    function computeVarUsage(s: VarScope, globals?: Decls, nonlocals: Decls[] = []): VarUsages {
        let globalUsage: VarUse[] = []
        let nonlocalUsage: VarUse[] = []
        let localUsage: VarUse[] = []
        let environmentUsage: VarUse[] = []
        let locals: Decls = {}
        for (let r of s.refs) {
            if (r.kind === "read" || r.kind === "assign") {
                if (locals[r.varName])
                    localUsage.push(r)
                else if (lookupNonlocal(r))
                    nonlocalUsage.push(r)
                else if (globals && globals[r.varName])
                    globalUsage.push(r)
                else
                    environmentUsage.push(r)
            } else {
                locals[r.varName] = r
            }
        }
        let nextGlobals = globals || locals
        let nextNonlocals = globals ? [...nonlocals, locals] : []
        let children = s.children
            .map(s => computeVarUsage(s, nextGlobals, nextNonlocals))
        return {
            globalUsage,
            nonlocalUsage,
            localUsage,
            environmentUsage,
            children,
            owner: s.owner
        }

        function lookupNonlocal(use: VarUse): VarDecl | undefined {
            return nonlocals
                .map(d => d[use.varName])
                .reduce((p, n) => n || p, undefined)
        }
    }
    export interface ScopeVariableLookup {
        getExplicitGlobals(fn: ts.FunctionLikeDeclaration): string[];
        getExplicitNonlocals(fn: ts.FunctionLikeDeclaration): string[];
    }
    export function computeScopeVariableLookup(n: ts.Node): ScopeVariableLookup {
        const scopeInfo = computeVarScopes(n)
        const usageInfo = computeVarUsage(scopeInfo)

        const globalsByFn = new Map()
        const nonlocalsByFn = new Map()

        walk(usageInfo)

        return {
            getExplicitGlobals: (fn) => globalsByFn.get(fn),
            getExplicitNonlocals: (fn) => nonlocalsByFn.get(fn),
        }

        function walk(s: VarUsages) {
            const gs = getExplicitGlobals(s)
                .map(a => a.varName)
                .reduce(dedup, [] as string[])
            globalsByFn.set(s.owner, gs)

            const ls = getExplicitNonlocals(s)
                .map(a => a.varName)
                .reduce(dedup, [] as string[])
            nonlocalsByFn.set(s.owner, ls)

            s.children.forEach(walk)
        }
        function dedup<T>(p: T[], n: T) {
            return p.find(r => r === n) ? p : [...p, n]
        }
    }

    // printing
    function toStringVarRef(i: VarRef): string {
        return `${i.kind}:${i.varName}`
    }
    function toStringVarScopes(s: VarScope): string {
        function internalToStringVarScopes(s: VarScope): string[] {
            let refs = s.refs.map(toStringVarRef).join(", ")
            let children = s.children
                .map(internalToStringVarScopes)
                .map(c => c.map(indent1))
                .map(c => ["{", ...c, "}"])
                .reduce((p, n) => [...p, ...n], [])
            return [
                refs,
                ...children
            ]
        }
        return internalToStringVarScopes(s).join("\n")
    }
    function toStringVarUsage(s: VarUsages): string {
        function internalToStringVarUsage(s: VarUsages): string[] {
            let gs = s.globalUsage.map(toStringVarRef).join(', ')
            let ns = s.nonlocalUsage.map(toStringVarRef).join(', ')
            let ls = s.localUsage.map(toStringVarRef).join(', ')
            let es = s.environmentUsage.map(toStringVarRef).join(', ')
            let children = s.children
                .map(internalToStringVarUsage)
                .map(c => c.map(indent1))
                .map(c => ["{", ...c, "}"])
                .reduce((p, n) => [...p, ...n], [])
            return [
                gs ? "global " + gs : "",
                ns ? "nonlocal " + ns : "",
                ls ? "local " + ls : "",
                es ? "env " + es : "",
                ...children
            ].filter(i => !!i)
        }
        return internalToStringVarUsage(s).join("\n")
    }
    // for debugging
    export function toStringVariableScopes(n: ts.Node) {
        const varScopes = computeVarScopes(n)
        const varUsage = computeVarUsage(varScopes)
        return toStringVarScopes(varScopes) + "\n\n\n" + toStringVarUsage(varUsage)
    }
}