namespace ts.pxtc {

    /**
     * Traverses the AST and injects information about function calls into the expression
     * nodes. The decompiler consumes this information later
     *
     * @param program The TypeScript Program representing the code to compile
     * @param entryPoint The name of the source file to annotate the AST of
     * @param compileTarget The compilation of the target
     */
    export function annotate(
        program: Program,
        entryPoint: string,
        compileTarget: CompileTarget) {

        const oldTarget = pxtc.target;
        pxtc.target = compileTarget;

        let src = program.getSourceFiles().filter(f => Util.endsWith(f.fileName, entryPoint))[0];
        let checker = program.getTypeChecker();

        recurse(src);

        pxtc.target = oldTarget;

        function recurse(parent: ts.Node) {
            ts.forEachChild(parent, child => {
                switch (child.kind) {
                    case SyntaxKind.CallExpression:
                        mkCallInfo(child, (child as ts.CallExpression).arguments.slice(0), null, getDecl((child as ts.CallExpression).expression));
                        break;
                    case SyntaxKind.PropertyAccessExpression:
                        mkCallInfo(child, []);
                        break;
                    case SyntaxKind.TaggedTemplateExpression:
                        mkCallInfo(child, [(child as ts.TaggedTemplateExpression).template], true, getDecl((child as ts.TaggedTemplateExpression).tag));
                        break;
                    case SyntaxKind.BinaryExpression:
                        annotateBinaryExpression(child as ts.BinaryExpression);
                        break;

                }

                recurse(child);
            });
        }

        function annotateBinaryExpression(node: ts.BinaryExpression) {
            const trg = node.left;
            const expr = node.right;

            let lt = typeOf(node.left)
            let rt = typeOf(node.right)

            if (node.operatorToken.kind == SK.PlusToken || node.operatorToken.kind == SK.PlusEqualsToken) {
                if (isStringType(lt) || (isStringType(rt) && node.operatorToken.kind == SK.PlusToken)) {
                    (node as any).exprInfo = { leftType: checker.typeToString(lt), rightType: checker.typeToString(rt) } as BinaryExpressionInfo;
                }
            }

            switch (node.operatorToken.kind) {
                case SyntaxKind.EqualsToken:
                case SyntaxKind.PlusEqualsToken:
                case SyntaxKind.MinusEqualsToken:
                    if (trg.kind == SK.PropertyAccessExpression) {
                        // Getter/Setter
                        let decl = getDecl(trg)
                        if (decl && decl.kind == SK.GetAccessor) {
                            decl = getDeclarationOfKind(decl.symbol, SK.SetAccessor)
                            mkCallInfo(trg, [expr], false, decl);
                        } else if (decl && (decl.kind == SK.PropertySignature || decl.kind == SK.PropertyAssignment || (target && target.switches.slowFields))) {
                            mkCallInfo(trg, [expr]);
                        }
                    }
                    break;
            }
        }

        function mkCallInfo(node: ts.Node, args: ts.Expression[], isExpression = false, d: ts.Declaration = null) {
            let hasRet = isExpression || !(typeOf(node).flags & TypeFlags.Void)
            let decl = d || getDecl(node);

            if ((node as any).expression && decl) {
                let isMethod = false;
                switch (decl.kind) {
                    // we treat properties via calls
                    // so we say they are "methods"
                    case SK.PropertySignature:
                    case SK.PropertyAssignment:
                    case SK.PropertyDeclaration:
                        if (!isStatic(decl)) {
                            isMethod = true
                        }
                        break;
                    case SK.Parameter:
                        if (isCtorField(decl as ParameterDeclaration)) {
                            isMethod = true
                        }
                        break
                    // TOTO case: case SK.ShorthandPropertyAssignment
                    // these are the real methods
                    case SK.GetAccessor:
                    case SK.SetAccessor:
                    case SK.MethodDeclaration:
                    case SK.MethodSignature:
                        isMethod = true
                        break;
                    default:
                        break;
                }

                if (isMethod) {
                    const expr: Expression = (node as any).expression;

                    // Add the "this" parameter to the call info
                    if (expr.kind === SK.PropertyAccessExpression) {
                        // If the node is a property access, the right hand side is just
                        // the function name so grab the left instead
                        args.unshift((expr as PropertyAccessExpression).expression);
                    }
                    else {
                        args.unshift((node as any).expression);
                    }
                }
            }

            let callInfo: CallInfo = {
                decl,
                qName: decl ? getFullName(checker, decl.symbol) : "?",
                args: args,
                isExpression: hasRet
            };

            (node as any).callInfo = callInfo;
        }

        function getDecl(node: Node): Declaration {
            if (!node) return null
            let sym = checker.getSymbolAtLocation(node)
            let decl: Declaration
            if (sym) {
                decl = sym.valueDeclaration
                if (!decl && sym.declarations) {
                    let decl0 = sym.declarations[0]
                    if (decl0 && decl0.kind == SyntaxKind.ImportEqualsDeclaration) {
                        sym = checker.getSymbolAtLocation((decl0 as ImportEqualsDeclaration).moduleReference)
                        if (sym)
                            decl = sym.valueDeclaration
                    }
                }
            }

            if (!decl && node.kind == SK.PropertyAccessExpression) {
                const namedNode = node as PropertyAccessExpression
                decl = {
                    kind: SK.PropertySignature,
                    symbol: { isBogusSymbol: true, name: namedNode.name.getText() },
                    isBogusFunction: true,
                    name: namedNode.name,
                } as any
            }

            return decl
        }

        function typeOf(node: Node) {
            let r: Type;
            if ((node as any).typeOverride)
                return (node as any).typeOverride as Type
            if (isExpression(node))
                r = checker.getContextualType(<Expression>node)
            if (!r) {
                r = checker.getTypeAtLocation(node);
            }
            if (!r)
                return r
            if (isStringLiteral(node))
                return r // skip checkType() - type is any for literal fragments
            return checkType(r)
        }
    }
}