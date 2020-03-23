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
            && AssignmentOperators.some(o => s.operatorToken.kind === o)
    }
    type VarUse = VarRead | VarAssign
    type VarRef = VarRead | VarDecl | VarAssign
    interface VarScope {
        readonly refs: VarRef[],
        readonly children: VarScope[],
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
                const init = walk(s.initializer)
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
                const operandUse = walk(s.operand)
                const varName = s.operand.getText()
                const assign: VarScope = {
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
                const rightUse = walk(s.right)
                let leftUse: VarScope | undefined;
                if (s.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
                    leftUse = walk(s.left)
                }
                const varName = s.left.getText()
                const assign: VarScope = {
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
                const fnName = s.name?.getText()
                let fnDecl: VarDecl | undefined = undefined;
                if (fnName) {
                    fnDecl = {
                        kind: "decl",
                        node: s,
                        varName: fnName
                    }
                }
                const params = s.parameters
                    .map(p => walk(p))
                    .reduce(merge, EMPTY)
                const body = walk(s.body)
                const child = merge(params, body)
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
        const globalUsage: VarUse[] = []
        const nonlocalUsage: VarUse[] = []
        const localUsage: VarUse[] = []
        const environmentUsage: VarUse[] = []
        const locals: Decls = {}
        for (const r of s.refs) {
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
        const nextGlobals = globals || locals
        const nextNonlocals = globals ? [...nonlocals, locals] : []
        const children = s.children
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
        getExplicitGlobals(fn: ts.FunctionLikeDeclaration): ts.Identifier[];
        getExplicitNonlocals(fn: ts.FunctionLikeDeclaration): ts.Identifier[];
    }
    export function computeScopeVariableLookup(n: ts.Node): ScopeVariableLookup {
        const scopeInfo = computeVarScopes(n)
        const usageInfo = computeVarUsage(scopeInfo)

        const globalsByFn = new Map()
        const nonlocalsByFn = new Map()

        walk(usageInfo)

        return {
            getExplicitGlobals: (fn) => globalsByFn.get(fn) || [],
            getExplicitNonlocals: (fn) => nonlocalsByFn.get(fn) || [],
        }

        function toId(a: VarAssign): ts.Identifier | undefined {
            let i = (a.node as ts.PrefixUnaryExpression | ts.PostfixUnaryExpression).operand
                || (a.node as ts.BinaryExpression).left
            return ts.isIdentifier(i) ? i : undefined
        }
        function toIds(ns: VarAssign[]): ts.Identifier[] {
            return ns
                .map(toId)
                .filter(i => !!i)
                .map(i => i as ts.Identifier)
                .reduce((p, n) => p.find(r => r.text === n.text) ? p : [...p, n], [] as ts.Identifier[])
        }

        function walk(s: VarUsages) {
            const gs = toIds(getExplicitGlobals(s))
            globalsByFn.set(s.owner, gs)

            const ls = toIds(getExplicitNonlocals(s))
            nonlocalsByFn.set(s.owner, ls)

            s.children.forEach(walk)
        }
    }

    // printing
    function toStringVarRef(i: VarRef): string {
        return `${i.kind}:${i.varName}`
    }
    function toStringVarScopes(s: VarScope): string {
        function internalToStringVarScopes(s: VarScope): string[] {
            const refs = s.refs.map(toStringVarRef).join(", ")
            const children = s.children
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
            const gs = s.globalUsage.map(toStringVarRef).join(', ')
            const ns = s.nonlocalUsage.map(toStringVarRef).join(', ')
            const ls = s.localUsage.map(toStringVarRef).join(', ')
            const es = s.environmentUsage.map(toStringVarRef).join(', ')
            const children = s.children
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