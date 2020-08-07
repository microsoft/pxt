namespace ts.pxtc {

    export function getParentCallExpression(tsNode: Node): ts.CallExpression | undefined {
        const pred = (n: Node) => {
            if (ts.isCallExpression(n))
                return TraverseCheck.Found
            else if (ts.isBlock(n))
                return TraverseCheck.Abort
            return TraverseCheck.Continue
        }
        return traverseUp(tsNode, pred) as ts.CallExpression
    }

    export function findCurrentCallArgIdx(call: ts.CallExpression, tsNode: Node, tsPos: number) {
        // does our cursor syntax node trivially map to an argument?
        let paramIdx = call.arguments
            .map(a => a === tsNode)
            .indexOf(true)
        if (paramIdx >= 0)
            return paramIdx

        // is our cursor within the argument range?
        const inRange = call.arguments.pos <= tsPos && tsPos < call.end
        if (!inRange)
            return -1

        // no arguments?
        if (call.arguments.length === 0)
            return 0

        // then find which argument we're refering to
        paramIdx = 0;
        for (let a of call.arguments) {
            if (a.end <= tsPos)
                paramIdx++
            else
                break
        }
        if (!call.arguments.hasTrailingComma)
            paramIdx = Math.max(0, paramIdx - 1)

        return paramIdx
    }

    export enum TraverseCheck {
        Found,
        Continue,
        Abort
    }

    export function traverseUp(node: Node, predicate: (n: Node) => TraverseCheck): Node | undefined {
        if (!node)
            return undefined
        const res = predicate(node)
        if (res === TraverseCheck.Continue)
            return traverseUp(node.parent, predicate)
        else if (res === TraverseCheck.Abort)
            return undefined
        else if (res === TraverseCheck.Found)
            return node
        let _: never = res;
        return res
    }

    export function enumMemberToQName(tc: TypeChecker, e: EnumMember) {
        if (e.name.kind === SK.Identifier) {
            return tc.getFullyQualifiedName(tc.getSymbolAtLocation(e.name));
        }
        return undefined
    }


    export function findInnerMostNodeAtPosition(n: Node, position: number): Node | null {
        for (let child of n.getChildren()) {
            if (child.kind >= ts.SyntaxKind.FirstPunctuation && child.kind <= ts.SyntaxKind.LastPunctuation)
                continue;

            let s = child.getStart()
            let e = child.getEnd()
            if (s <= position && position < e)
                return findInnerMostNodeAtPosition(child, position)
        }
        return (n && n.kind === SK.SourceFile) ? null : n;
    }

    export function getParentNamespace(n?: Node): ModuleDeclaration | undefined {
        return traverseUp(n, n => ts.isModuleDeclaration(n) ? TraverseCheck.Found : TraverseCheck.Continue) as ModuleDeclaration;
    }

    export function getCurrentNamespaces(n?: Node): string[] {
        if (!n)
            return [];
        let parent = getParentNamespace(n)
        if (!parent)
            return [];
        let ns = parent.name.getText()
        return [...getCurrentNamespaces(parent.parent), ns]
    }

    export function getEnumMembers(checker: ts.TypeChecker, t: Type): NodeArray<EnumMember> | undefined {
        if (checker && t.symbol && t.symbol.declarations && t.symbol.declarations.length) {
            for (let i = 0; i < t.symbol.declarations.length; i++) {
                const decl = t.symbol.declarations[i];
                if (decl.kind === SK.EnumDeclaration) {
                    const enumDeclaration = decl as EnumDeclaration;
                    return enumDeclaration.members
                }
            }
        }
        return undefined
    }

    export function isExported(decl: Declaration) {
        if (decl.modifiers && decl.modifiers.some(m => m.kind == SK.PrivateKeyword || m.kind == SK.ProtectedKeyword))
            return false;

        let symbol = decl.symbol

        if (!symbol)
            return false;

        while (true) {
            let parSymbol: Symbol = (symbol as any).parent
            if (parSymbol) symbol = parSymbol
            else break
        }

        let topDecl = symbol.valueDeclaration || symbol.declarations[0]

        if (topDecl.kind == SK.VariableDeclaration)
            topDecl = topDecl.parent.parent as Declaration

        if (topDecl.parent && topDecl.parent.kind == SK.SourceFile)
            return true;
        else
            return false;
    }

    export function isReadonly(decl: Declaration) {
        return decl.modifiers && decl.modifiers.some(m => m.kind == SK.ReadonlyKeyword)
    }
}