
namespace ts.pxtc.decompiler {
    const SK = ts.SyntaxKind;

    const ops: pxt.Map<{ type: string; op?: string; leftName?: string; rightName?: string }> = {
        "+": { type: "math_arithmetic", op: "ADD" },
        "-": { type: "math_arithmetic", op: "MINUS" },
        "/": { type: "math_arithmetic", op: "DIVIDE" },
        "*": { type: "math_arithmetic", op: "MULTIPLY" },
        "%": { type: "math_modulo", leftName: "DIVIDEND", rightName: "DIVISOR" },
        "<": { type: "logic_compare", op: "LT" },
        "<=": { type: "logic_compare", op: "LTE" },
        ">": { type: "logic_compare", op: "GT" },
        ">=": { type: "logic_compare", op: "GTE" },
        "==": { type: "logic_compare", op: "EQ" },
        "!=": { type: "logic_compare", op: "NEQ" },
        "&&": { type: "logic_operation", op: "AND" },
        "||": { type: "logic_operation", op: "OR" },
    }

    const builtinBlocks: pxt.Map<{ block: string; blockId: string; fields?: string }> = {
        "Math.random": { blockId: "device_random", block: "pick random 0 to %limit" },
        "Math.abs": { blockId: "math_op3", block: "absolute of %x" },
        "Math.min": { blockId: "math_op2", block: "of %x|and %y" },
        "Math.max": { blockId: "math_op2", block: "of %x|and %y", fields: `<field name="op">max</field>` }
    }

    export function decompileToBlocks(blocksInfo: pxtc.BlocksInfo, file: ts.SourceFile): pxtc.CompileResult {
        let stmts: ts.Statement[] = file.statements;
        let result: pxtc.CompileResult = {
            blocksInfo: blocksInfo,
            outfiles: {}, diagnostics: [], success: true, times: {}
        }
        let output = ""

        emitBlockStatement(stmts, undefined, true);

        result.outfiles[file.fileName.replace(/(\.blocks)?\.\w*$/i, '') + '.blocks'] = `<xml xmlns="http://www.w3.org/1999/xhtml">
${output}</xml>`;

        return result;

        function write(s: string, suffix = "\n") {
            output += s + suffix
        }

        function error(n: ts.Node, msg?: string) {
            let diags = pxtc.patchUpDiagnostics([{
                file: file,
                start: n.getFullStart(),
                length: n.getFullWidth(),
                messageText: msg || `Language feature "${n.getFullText().trim()}"" not supported in blocks`,
                category: ts.DiagnosticCategory.Error,
                code: 1001
            }])
            U.pushRange(result.diagnostics, diags)
            result.success = false;
        }

        function isOutputExpression(expr: ts.Expression): boolean {

            switch (expr.kind) {
                case SK.BinaryExpression:
                    return !/[=<>]/.test((expr as ts.BinaryExpression).operatorToken.getText());
                case SK.PrefixUnaryExpression: {
                    let op = (expr as ts.PrefixUnaryExpression).operator;
                    return op != SK.PlusPlusToken && op != SK.MinusMinusToken;
                }
                case SK.PostfixUnaryExpression: {
                    let op = (expr as ts.PostfixUnaryExpression).operator;
                    return op != SK.PlusPlusToken && op != SK.MinusMinusToken;
                }
                case SK.ParenthesizedExpression:
                case SK.NumericLiteral:
                case SK.StringLiteral:
                case SK.NoSubstitutionTemplateLiteral:
                case SK.TrueKeyword:
                case SK.FalseKeyword:
                case SK.NullKeyword:
                    return true;
                default: return false;
            }
        }

        /**
         * Emits a block of statements
         *
         * @param statements    The statements or expressions to emit
         * @param next?         Statements to be emitted after the block being emitted
         * @param topLevel?     Indicates whether this block statement is at the top level scope (i.e. the source file) or not.
         *                      If false, an error will be thrown if any output expressions are encountered. False by default
         */
        function emitBlockStatement(statements: ts.Node[], next?: ts.Node[], topLevel = false) {
            const outputStatements: ts.Node[] = [];
            const blockStatements: ts.Node[] = next || [];

            // Go over the statements in reverse so that we can insert the nodes into the existing list if there is one
            statements.reverse().forEach(statement => {
                if (statement.kind == SK.ExpressionStatement && isOutputExpression((statement as ts.ExpressionStatement).expression)) {
                    if (!topLevel) {
                        error(statement, Util.lf("Output expressions can only exist in the top level scope"))
                    }
                    outputStatements.unshift(statement)
                }
                else {
                    blockStatements.unshift(statement)
                }
            });

            if (blockStatements.length) {
                emitStatementBlock(blockStatements.shift(), blockStatements);
            }

            // Emit any output statements as standalone blocks
            for (const statement of outputStatements) {
                emitOutputBlock(statement)
            }
        }

        /**
         * Emit the given node as a block that outputs a value
         *
         * @param n     The node to emit into blocks
         */
        function emitOutputBlock(n: ts.Node): void {
            switch (n.kind) {
                case SK.ExpressionStatement:
                    emitOutputBlock((n as ts.ExpressionStatement).expression);
                    break;
                case SK.ParenthesizedExpression:
                    emitOutputBlock((n as ts.ParenthesizedExpression).expression);
                    break;
                case SK.Identifier:
                    emitIdentifier(n as ts.Identifier);
                    break;
                case SK.StringLiteral:
                case SK.FirstTemplateToken:
                case SK.NoSubstitutionTemplateLiteral:
                    emitStringLiteral((n as ts.LiteralExpression).text);
                    break;
                case SK.NullKeyword:
                    // don't emit anything
                    break;
                case SK.NumericLiteral:
                    emitNumericLiteral((n as ts.LiteralExpression).text);
                    break;
                case SK.TrueKeyword:
                    emitBooleanLiteral(true);
                    break;
                case SK.FalseKeyword:
                    emitBooleanLiteral(false);
                    break;
                case SK.BinaryExpression:
                    emitBinaryExpression(n as ts.BinaryExpression);
                    break;
                case SK.PrefixUnaryExpression:
                    emitPrefixUnaryExpression(n as ts.PrefixUnaryExpression);
                    break;
                case SK.PropertyAccessExpression:
                    emitPropertyAccessExpression(n as ts.PropertyAccessExpression);
                    break;
                case SK.CallExpression:
                    emitStatementBlock(n);
                    break;
                default:
                    error(n, Util.lf("Unsupported syntax kind for output expression block: {0}", SK[n.kind]));
                    break;
            }

            function emitBinaryExpression(n: ts.BinaryExpression): void {
                const op = n.operatorToken.getText();
                const npp = ops[op];
                if (!npp) {
                    return error(n, Util.lf("Could not find operator {0}", op))
                }

                openBlockTag(npp.type)

                if (npp.op) {
                    emitField("OP", npp.op)
                }

                emitValue(npp.leftName || "A", n.left);
                emitValue(npp.rightName || "B", n.right);

                closeBlockTag()
            }

            function emitPrefixUnaryExpression(node: PrefixUnaryExpression) {
                switch (node.operator) {
                    case SK.ExclamationToken:
                        openBlockTag("logic_negate");
                        emitValue("BOOL", node.operand)
                        closeBlockTag();
                        break;
                    case SK.PlusToken:
                        emitOutputBlock(node.operand);
                        break;
                    case SK.MinusToken:
                        if (node.operand.kind == SK.NumericLiteral) {
                            emitNumericLiteral("-" + (node.operand as ts.LiteralExpression).text)
                        } else {
                            negateAndEmitExpression(node.operand)
                        }
                        break;
                    default:
                        error(node);
                        break;
                }
            }
        }

        /**
         * Emit the given node as a statement block
         *
         * @param n     The node to emit into blocks
         * @param next? A list of nodes to be emitted as statements following this one (i.e. part of the same block of statements)
         */
        function emitStatementBlock(node: ts.Node, next?: ts.Node[]) {
            switch (node.kind) {
                case SK.Block:
                    emitBlockStatement((node as ts.Block).statements, next);
                    return;
                case SK.ExpressionStatement:
                    emitStatementBlock((node as ts.ExpressionStatement).expression, next);
                    return;
                case SK.VariableStatement:
                    emitBlockStatement((node as ts.VariableStatement).declarationList.declarations, next);
                    return;
                case SK.ArrowFunction:
                    emitArrowFunction(node as ts.ArrowFunction, next);
                    return;

                case SK.BinaryExpression:
                    openBinaryExpressionBlock(node as ts.BinaryExpression)
                    break;
                case SK.PostfixUnaryExpression:
                case SK.PrefixUnaryExpression:
                    openIncrementExpressionBlock(node as (ts.PrefixUnaryExpression | ts.PostfixUnaryExpression))
                    break;
                case SK.VariableDeclaration:
                    openVaraiableDeclarationBlock(node as ts.VariableDeclaration);
                    break;
                case SK.WhileStatement:
                    openWhileStatementBlock(node as ts.WhileStatement);
                    break;
                case SK.IfStatement:
                    openIfStatementBlock(node as ts.IfStatement);
                    break;
                case SK.ForStatement:
                    openForStatementBlock(node as ts.ForStatement);
                    break;
                case SK.CallExpression:
                    openCallExpressionBlock(node as ts.CallExpression);
                    break;
                default:
                    if (next) {
                        error(node, Util.lf("Unsupported statement in block: {0}", SK[node.kind]))
                    }
                    else {
                        error(node, Util.lf("Statement kind unsupported in blocks: {0}", SK[node.kind]))
                    }
                    return;
            }

            if (next && next.length) {
                write("<next>")
                emitStatementBlock(next.shift(), next);
                write("</next>")
            }

            closeBlockTag()

            function openImageLiteralExpressionBlock(node: ts.CallExpression, info: pxtc.CallInfo) {
                let arg = node.arguments[0];
                if (arg.kind != SK.StringLiteral && arg.kind != SK.NoSubstitutionTemplateLiteral) {
                    error(node)
                    return;
                }
                openBlockTag(info.attrs.blockId);
                let leds = ((arg as ts.StringLiteral).text || '').replace(/\s/g, '');
                let nc = info.attrs.imageLiteral * 5;
                for (let r = 0; r < 5; ++r) {
                    for (let c = 0; c < nc; ++c) {
                        emitField(`LED${c}${r}`, /[#*1]/.test(leds[r * nc + c]) ? "TRUE" : "FALSE")
                    }
                }
            }

            function openBinaryExpressionBlock(n: ts.BinaryExpression): void {
                if (n.left.kind !== SK.Identifier) {
                    error(n, Util.lf("Only variable names may be assigned to"));
                    return;
                }

                const name = (n.left as ts.Identifier).text;

                switch (n.operatorToken.kind) {
                    case SK.EqualsToken:
                        openVariableSetOrChangeBlock(name, n.right);
                        break;
                    case SK.PlusEqualsToken:
                        openVariableSetOrChangeBlock(name, n.right, true);
                        break;
                    case SK.MinusEqualsToken:
                        openBlockTag("variables_change");
                        emitField("VAR", name);
                        write(`<value name="VALUE">`);
                        negateAndEmitExpression(n.right);
                        write(`</value>`)
                        break;

                }
            }

            function openWhileStatementBlock(n: ts.WhileStatement): void {
                openBlockTag("device_while");
                emitValue("COND", n.expression);
                emitStatementTag("DO", n.statement)
            }

            function openIfStatementBlock(n: ts.IfStatement) {
                let flatif = flattenIfStatement(n);
                openBlockTag("controls_if");
                write(`<mutation elseif="${flatif.ifStatements.length - 1}" else="${flatif.elseStatement ? 1 : 0}"></mutation>`)
                flatif.ifStatements.forEach((stmt, i) => {
                    emitValue("IF" + i, stmt.expression);
                    emitStatementTag("DO" + i, stmt.thenStatement);
                });
                if (flatif.elseStatement) {
                    emitStatementTag("ELSE", flatif.elseStatement);
                }
            }

            function openForStatementBlock(n: ts.ForStatement) {
                if (n.initializer.kind !== SK.VariableDeclarationList) {
                    error(n, Util.lf("only variable declarations are permitted in for loop initializers"));
                    return;
                }

                const initializer = n.initializer as ts.VariableDeclarationList;

                if (!initializer.declarations) {
                    error(n, Util.lf("for loop with out-of-scope variables not supported"));
                    return;
                }
                if (initializer.declarations.length != 1) {
                    error(n, Util.lf("for loop with multiple variables not supported"));
                    return;
                }

                const indexVar = (initializer.declarations[0].name as ts.Identifier).text;
                if (!incrementorIsValid(indexVar)) {
                    error(n, Util.lf("for loop incrementors may only increment the variable declared in the initializer"));
                }

                if (n.condition.kind !== SK.BinaryExpression) {
                    error(n, Util.lf("for loop conditionals must be binary comparison operations"))
                    return;
                }

                const condition = n.condition as ts.BinaryExpression
                if (condition.left.kind !== SK.Identifier || (condition.left as ts.Identifier).text !== indexVar) {
                    error(n, Util.lf("left side of for loop conditional must be the variable declared in the initializer"))
                    return;
                }

                // FIXME: We never decompile repeat blocks correctly, they are always converted into a for-loop.
                // To decompile repeat, we would need to check to make sure the initialized variable is
                // never referenced in the loop body
                openBlockTag("controls_simple_for");
                emitField("VAR", indexVar);


                if (condition.operatorToken.kind === SK.LessThanToken) {
                    write(`<value name="TO">`)
                    openBlockTag("math_arithmetic")
                    emitField("OP", "MINUS")
                    emitValue("A", condition.right)
                    emitValue("B", 1)
                    closeBlockTag()
                    write(`</value>`)
                }
                else if (condition.operatorToken.kind === SK.LessThanEqualsToken) {
                    emitValue("TO", condition.right)
                }
                else {
                    error(n, Util.lf("for loop conditional operator must be either < or <="))
                    return;
                }
                emitStatementTag("DO", n.statement);

                function incrementorIsValid(varName: string): boolean {
                    if (n.incrementor.kind === SK.PostfixUnaryExpression) {
                        const incrementor = n.incrementor as ts.PostfixUnaryExpression;
                        if (incrementor.operator === SK.PlusPlusToken && incrementor.operand.kind === SK.Identifier) {
                            return (incrementor.operand as ts.Identifier).text === varName;
                        }
                    }
                    return false;
                }
            }

            function openVariableSetOrChangeBlock(name: string, value: Node | number, changed = false) {
                openBlockTag(changed ? "variables_change" : "variables_set")
                emitField("VAR", name);
                emitValue("VALUE", value);
            }

            function openVaraiableDeclarationBlock(n: ts.VariableDeclaration) {
                if (n.name.kind !== SK.Identifier) {
                    error(n, Util.lf("Variable declarations may not use binding patterns"))
                    return;
                }
                else if (!n.initializer) {
                    error(n, Util.lf("Variable declarations must have an initializer"))
                    return;
                }
                openVariableSetOrChangeBlock((n.name as ts.Identifier).text, n.initializer)
            }

            function openIncrementExpressionBlock(node: ts.PrefixUnaryExpression | PostfixUnaryExpression) {
                if (node.operand.kind != SK.Identifier) {
                    error(node, Util.lf("-- and ++ may only be used on an identifier"));
                    return;
                }
                const isPlusPlus = node.operator === SK.PlusPlusToken;

                if (!isPlusPlus && node.operator !== SK.MinusMinusToken) {
                    error(node);
                    return;
                }

                openVariableSetOrChangeBlock((node.operand as ts.Identifier).text, isPlusPlus ? 1 : -1, true)
            }

            function openCallExpressionBlock(node: ts.CallExpression) {
                let extraArgs = '';
                const info: pxtc.CallInfo = (node as any).callInfo
                if (!info) {
                    error(node);
                    return;
                }

                if (!info.attrs.blockId || !info.attrs.block) {
                    const builtin = builtinBlocks[info.qName];
                    if (!builtin) {
                        error(node)
                        return;
                    }
                    info.attrs.block = builtin.block;
                    info.attrs.blockId = builtin.blockId;
                    if (builtin.fields) extraArgs += builtin.fields;
                }

                if (info.attrs.imageLiteral) {
                    openImageLiteralExpressionBlock(node, info);
                    return;
                }

                const argNames: string[] = []
                info.attrs.block.replace(/%(\w+)/g, (f, n) => {
                    argNames.push(n)
                    return ""
                })

                openBlockTag(info.attrs.blockId);
                if (extraArgs) write(extraArgs);
                info.args.forEach((e, i) => {
                    switch (e.kind) {
                        case SK.ArrowFunction:
                            emitStatementTag("HANDLER", e);
                            break;
                        case SK.PropertyAccessExpression:
                            let forv = "field";
                            const callInfo = (e as any).callInfo as pxtc.CallInfo;
                            const shadow = callInfo && !!callInfo.attrs.blockIdentity
                            if (shadow)
                                forv = "value";

                            write(`<${forv} name="${U.htmlEscape(argNames[i])}">`, "");
                            emitPropertyAccessExpression(e as PropertyAccessExpression, shadow);
                            write(`</${forv}>`);
                            break;
                        default:
                            write(`<value name="${U.htmlEscape(argNames[i])}">`)
                            if (info.qName == "Math.random") {
                                emitMathRandomArgumentExpresion(e);
                            }
                            else {
                                emitOutputBlock(e);
                            }
                            write(`</value>`)
                            break;
                    }
                });
            }

            function emitMathRandomArgumentExpresion(e: ts.Expression) {
                switch (e.kind) {
                    case SK.NumericLiteral:
                        const n = e as LiteralExpression;
                        emitNumericLiteral((parseInt(n.text) - 1).toString());
                        break;
                    case SK.BinaryExpression:
                        const op = e as BinaryExpression;
                        if (op.operatorToken.kind == SK.PlusToken && (op.right as any).text == "1") {
                            emitOutputBlock(op.left);
                            //Note: break is intentionally in the if statement as we don't want to handle any other kinds of operations
                            //other than the +1 created by the block compilation because otherwise roundtripping won't work anyway
                            break;
                        }
                    default:
                        //This will definitely lead to an error, but the above are the only two cases generated by blocks
                        emitOutputBlock(e);
                        break;
                }
            }

            function emitArrowFunction(n: ts.ArrowFunction, next: ts.Node[]) {
                if (n.parameters.length > 0) {
                    error(n);
                    return;
                }
                emitStatementBlock(n.body, next)
            }

            function flattenIfStatement(n: ts.IfStatement): {
                ifStatements: {
                    expression: ts.Expression;
                    thenStatement: ts.Statement;
                }[];
                elseStatement: ts.Statement;
            } {
                let r = {
                    ifStatements: [{
                        expression: n.expression,
                        thenStatement: n.thenStatement
                    }],
                    elseStatement: n.elseStatement
                }
                if (n.elseStatement && n.elseStatement.kind == SK.IfStatement) {
                    let flat = flattenIfStatement(n.elseStatement as ts.IfStatement);
                    r.ifStatements = r.ifStatements.concat(flat.ifStatements);
                    r.elseStatement = flat.elseStatement;
                }
                return r;
            }
        }

        function emitPropertyAccessExpression(n: ts.PropertyAccessExpression, shadow = false): void {
            let callInfo = (n as any).callInfo as pxtc.CallInfo;
            if (!callInfo) {
                error(n);
                return;
            }
            let value = U.htmlEscape(callInfo.attrs.blockId || callInfo.qName)
            if (callInfo.attrs.blockIdentity) {
                let idfn = blocksInfo.apis.byQName[callInfo.attrs.blockIdentity];
                let tag = shadow ? "shadow" : "block";
                let f = /%([a-zA-Z0-9_]+)/.exec(idfn.attributes.block);
                write(`<${tag} type="${U.htmlEscape(idfn.attributes.blockId)}"><field name="${U.htmlEscape(f[1])}">${value}</field></${tag}>`)
            }
            else write(value, "")
        }

        // TODO: Add a real negation block
        function negateAndEmitExpression(node: ts.Node) {
            openBlockTag("math_arithmetic")
            emitField("OP", "MINUS")
            emitValue("A", 0)
            emitValue("B", node)
            closeBlockTag()
        }

        function emitValue(name: string, contents: boolean | number | string | Node): void {
            write(`<value name="${U.htmlEscape(name)}">`)

            if (typeof contents === "number") {
                emitNumericLiteral(contents.toString())
            }
            else if (typeof contents === "boolean") {
                emitBooleanLiteral(contents)
            }
            else if (typeof contents === "string") {
                emitStringLiteral(contents);
            }
            else {
                emitOutputBlock(contents)
            }

            write(`</value>`)
        }

        function emitField(name: string, value: string) {
            write(`<field name="${U.htmlEscape(name)}">${U.htmlEscape(value)}</field>`)
        }

        function openBlockTag(type: string) {
            write(`<block type="${U.htmlEscape(type)}">`)
        }

        function closeBlockTag() {
            write(`</block>`)
        }

        function emitStatementTag(name: string, contents: ts.Statement | ts.Expression) {
            write(`<statement name="${U.htmlEscape(name)}">`)
            emitStatementBlock(contents)
            write(`</statement>`)
        }

        function emitIdentifier(identifier: Identifier) {
            emitFieldBlock("variables_get", "VAR", identifier.text)
        }

        function emitStringLiteral(value: string) {
            emitFieldBlock("text", "TEXT", value)
        }

        function emitNumericLiteral(value: string) {
            emitFieldBlock("math_number", "NUM", value);
        }

        function emitBooleanLiteral(value: boolean) {
            emitFieldBlock("logic_boolean", "BOOL", value ? "TRUE" : "FALSE")
        }

        function emitFieldBlock(type: string, fieldName: string, value: string) {
            openBlockTag(type)
            emitField(fieldName, value)
            closeBlockTag()
        }
    }
}