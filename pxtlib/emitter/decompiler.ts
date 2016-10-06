
namespace ts.pxtc.decompiler {
    const SK = ts.SyntaxKind;

    type NextNode = ts.Node | "ScopeEnd";

    const lowerCaseAlphabetStartCode = 97;
    const lowerCaseAlphabetEndCode = 122;

    enum ShadowType {
        Boolean,
        Number,
        String
    }

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

    /*
     * Matches a single line comment and extracts the text.
     * Breakdown:
     *     ^\s*     - matches leading whitespace
     *      \/\/s*  - matches double slash
     *      (.*)    - matches rest of the comment
     */
    const singleLineCommentRegex = /^\s*\/\/\s*(.*)$/

    /*
     * Matches one line of a multi-line comment and extracts the text.
     * Breakdown:
     *      ^\s*                                        - matches leading whitespace
     *      (?:\/\*\*?)                                 - matches beginning of a multi-line comment (/* or /**)
     *      (?:\*)                                      - matches a single asterisk that might begin a line in the body of the comment
     *      (?:(?:(?:\/\*\*?)|(?:\*))(?!\/))            - combines the previous two regexes but does not match either if followed by a slash
     *      ^\s*(?:(?:(?:\/\*\*?)|(?:\*))(?!\/))?\s*    - matches all possible beginnings of a multi-line comment line (/*, /**, *, or just whitespace)
     *      (.*?)                                       - matches the text of the comment line
     *      (?:\*?\*\/)?$                               - matches the end of the multiline comment (one or two asterisks and a slash) or the end of a line within the comment
     */
    const multiLineCommentRegex = /^\s*(?:(?:(?:\/\*\*?)|(?:\*))(?!\/))?\s*(.*?)(?:\*?\*\/)?$/

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
        const fileText = file.getFullText();
        let output = ""
        const scopes: { [index: string]: string }[] = [{}];
        const takenNames: { [index: string]: boolean } = {}

        emitBlockStatement(stmts, undefined, true, true);

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
                case SK.CallExpression:
                    const callInfo: pxtc.CallInfo = (expr as any).callInfo
                    if (!callInfo) {
                        error(expr)
                    }
                    return callInfo.isExpression;
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
        function emitBlockStatement(statements: ts.Node[], next?: NextNode[], partOfCurrentBlock = false, topLevel = false, parent?: ts.Node) {
            const outputStatements: ts.Node[] = [];
            const blockStatements: NextNode[] = next || [];

            if (!partOfCurrentBlock) {
                // Push a marker indicating where this block ends (for keeping track of variable names)
                blockStatements.unshift("ScopeEnd")
            }

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

            if (blockStatements.length > (partOfCurrentBlock ? 0 : 1)) {
                emitStatementBlock(blockStatements.shift(), blockStatements, parent);
            }

            // Emit any output statements as standalone blocks
            for (const statement of outputStatements) {
                emitOutputBlock(statement, true)
            }
        }

        /**
         * Emit the given node as a block that outputs a value
         *
         * @param n     The node to emit into blocks
         */
        function emitOutputBlock(n: ts.Node, topLevel = false): void {
            switch (n.kind) {
                case SK.ExpressionStatement:
                    emitOutputBlock((n as ts.ExpressionStatement).expression, topLevel);
                    break;
                case SK.ParenthesizedExpression:
                    emitOutputBlock((n as ts.ParenthesizedExpression).expression, topLevel);
                    break;
                case SK.Identifier:
                    emitIdentifier(n as ts.Identifier);
                    break;
                case SK.StringLiteral:
                case SK.FirstTemplateToken:
                case SK.NoSubstitutionTemplateLiteral:
                    emitStringLiteral((n as ts.LiteralExpression).text, !topLevel);
                    break;
                case SK.NumericLiteral:
                    emitNumericLiteral((n as ts.LiteralExpression).text, !topLevel);
                    break;
                case SK.TrueKeyword:
                    emitBooleanLiteral(true, !topLevel);
                    break;
                case SK.FalseKeyword:
                    emitBooleanLiteral(false, !topLevel);
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

                const shadowType = (op === "&&" || op === "||") ? ShadowType.Boolean : ShadowType.Number;

                emitValue(npp.leftName || "A", n.left, shadowType);
                emitValue(npp.rightName || "B", n.right, shadowType);

                closeBlockTag()
            }

            function emitPrefixUnaryExpression(node: PrefixUnaryExpression) {
                switch (node.operator) {
                    case SK.ExclamationToken:
                        openBlockTag("logic_negate");
                        emitValue("BOOL", node.operand, ShadowType.Boolean)
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
         * @param n         The node to emit into blocks
         * @param next?     A list of nodes to be emitted as statements following this one (i.e. part of the same block of statements)
         * @param parent?   The toplevel node for this statement if this statement is not the node which would have comments adjacent in the source text
         */
        function emitStatementBlock(n: NextNode, next?: NextNode[], parent?: ts.Node) {
            if (isScopeEnd(n)) {
                popScope();
                emitNextBlock(/*withinNextTag*/false);
                return;
            }

            const node = n as ts.Node;

            switch (node.kind) {
                case SK.Block:
                    pushScope();
                    emitBlockStatement((node as ts.Block).statements, next);
                    return;
                case SK.ExpressionStatement:
                    emitStatementBlock((node as ts.ExpressionStatement).expression, next, parent || node);
                    return;
                case SK.VariableStatement:
                    emitBlockStatement((node as ts.VariableStatement).declarationList.declarations, next, true, false, parent || node);
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
                    const decl = node as ts.VariableDeclaration;
                    if (decl.initializer && decl.initializer.kind === SyntaxKind.NullKeyword) {
                        // Don't emit null initializers; They are implicit within the blocks. But do add a name to the scope
                        if (addVariableDeclaration(decl)) {
                            emitNextBlock(/*withinNextTag*/false)
                        }
                        return;
                    }
                    openVariableDeclarationBlock(node as ts.VariableDeclaration);
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

            emitNextBlock(/*withinNextTag*/true);

            const commentRanges = ts.getLeadingCommentRangesOfNode(parent || node, file)
            if (commentRanges) {
                const commentText = getCommentText(commentRanges)

                if (commentText) {
                    write(`<comment pinned="false">${U.htmlEscape(commentText)}</comment>`)
                }
            }

            closeBlockTag()

            function emitNextBlock(withinNextTag: boolean) {
                const toEmit = consumeToNextBlock();
                if (toEmit) {
                    if (withinNextTag) {
                        write("<next>")
                        emitStatementBlock(toEmit, next);
                        write("</next>")
                    }
                    else {
                        emitStatementBlock(toEmit, next);
                    }
                }

                function consumeToNextBlock(): ts.Node {
                    if (next && next.length) {
                        const toEmit = next.shift();

                        if (isScopeEnd(toEmit)) {
                            popScope();
                        }
                        else if (canBeEmitted(toEmit)) {
                            return toEmit;
                        }
                        return consumeToNextBlock();
                    }
                    return undefined;
                }

                function canBeEmitted(node: ts.Node) {
                    switch (node.kind) {
                        case SyntaxKind.VariableStatement:
                            const decl = node as ts.VariableDeclaration;
                            if (decl.initializer && decl.initializer.kind === SyntaxKind.NullKeyword) {
                                // Don't emit null initializers; They are implicit within the blocks. But do add a name to the scope
                                addVariableDeclaration(decl);
                                return false;
                            }
                        break;
                        default:
                    }
                    return true;
                }
            }

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
                        emitField("VAR", getVariableName(name));
                        write(`<value name="VALUE">`);
                        negateAndEmitExpression(n.right);
                        write(`</value>`)
                        break;
                    default:
                        error(n, Util.lf("Unsupported operator token in statement {0}", SK[n.operatorToken.kind]));
                        return;
                }
            }

            function openWhileStatementBlock(n: ts.WhileStatement): void {
                openBlockTag("device_while");
                emitValue("COND", n.expression, ShadowType.Boolean);
                emitStatementTag("DO", n.statement)
            }

            function openIfStatementBlock(n: ts.IfStatement) {
                let flatif = flattenIfStatement(n);
                openBlockTag("controls_if");
                write(`<mutation elseif="${flatif.ifStatements.length - 1}" else="${flatif.elseStatement ? 1 : 0}"></mutation>`)
                flatif.ifStatements.forEach((stmt, i) => {
                    emitValue("IF" + i, stmt.expression, ShadowType.Boolean);
                    emitStatementTag("DO" + i, stmt.thenStatement);
                });
                if (flatif.elseStatement) {
                    emitStatementTag("ELSE", flatif.elseStatement);
                }
            }

            function openForStatementBlock(n: ts.ForStatement) {
                if (!n.initializer || !n.incrementor || !n.condition) {
                    error(n, Util.lf("for loops must have an initializer, incrementor, and condition"));
                    return;
                }

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

                pushScope()
                addVariable(indexVar)
                emitField("VAR", getVariableName(indexVar));


                if (condition.operatorToken.kind === SK.LessThanToken) {
                    write(`<value name="TO">`)

                    // Emit a shadow block
                    emitNumericLiteral("0")

                    // Subtract 1 to get the same behavior as <=
                    openBlockTag("math_arithmetic")
                    emitField("OP", "MINUS")
                    emitValue("A", condition.right, ShadowType.Number)
                    emitValue("B", 1)
                    closeBlockTag()
                    write(`</value>`)
                }
                else if (condition.operatorToken.kind === SK.LessThanEqualsToken) {
                    emitValue("TO", condition.right, ShadowType.Number)
                }
                else {
                    error(n, Util.lf("for loop conditional operator must be either < or <="))
                    return;
                }

                emitStatementTag("DO", n.statement);
                popScope()

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
                name = getVariableName(name);
                emitField("VAR", name);

                // We always do a number shadow even if the variable is not of type number
                emitValue("VALUE", value, ShadowType.Number);
            }

            function openVariableDeclarationBlock(n: ts.VariableDeclaration) {
                if (addVariableDeclaration(n)) {
                    openVariableSetOrChangeBlock((n.name as ts.Identifier).text, n.initializer)
                }
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

            function emitArrowFunction(n: ts.ArrowFunction, next: NextNode[]) {
                if (n.parameters.length > 0) {
                    error(n);
                    return;
                }
                pushScope();
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
            // First emit a shadow block
            emitNumericLiteral("0");

            // Then negate the value by subtracting it from 0
            openBlockTag("math_arithmetic")
            emitField("OP", "MINUS")
            emitValue("A", 0)
            emitValue("B", node, ShadowType.Number)
            closeBlockTag()
        }

        function emitValue(name: string, contents: boolean | number | string | Node, shadowType?: ShadowType): void {
            write(`<value name="${U.htmlEscape(name)}">`)

            if (typeof contents === "number") {
                emitNumericLiteral(contents.toString())
            }
            else if (typeof contents === "boolean") {
                emitBooleanLiteral(contents)
            }
            else if (typeof contents === "string") {
                emitStringLiteral(contents)
            }
            else {
                // If this is some expression, we want to also emit a shadow block in case the expression
                // gets pulled out of the block
                if (shadowType && !isLiteralNode(contents)) {
                    switch (shadowType) {
                        case ShadowType.Number:
                            emitNumericLiteral("0")
                            break;
                        case ShadowType.String:
                            emitStringLiteral("")
                            break;
                        case ShadowType.Boolean:
                            emitBooleanLiteral(true)
                    }
                }
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
            if (isUndefined(identifier)) {
                error(identifier, Util.lf("Undefined has no block equivalent"))
                return;
            }
            emitFieldBlock("variables_get", "VAR", getVariableName(identifier.text), false)
        }

        function emitStringLiteral(value: string, shadow = true) {
            emitFieldBlock("text", "TEXT", value, shadow)
        }

        function emitNumericLiteral(value: string, shadow = true) {
            emitFieldBlock("math_number", "NUM", value, shadow);
        }

        function emitBooleanLiteral(value: boolean, shadow = true) {
            emitFieldBlock("logic_boolean", "BOOL", value ? "TRUE" : "FALSE", shadow)
        }

        function emitFieldBlock(type: string, fieldName: string, value: string, shadow: boolean) {
            if (shadow) {
                write(`<shadow type="${U.htmlEscape(type)}">`)
                emitField(fieldName, value)
                write(`</shadow>`)
            }
            else {
                openBlockTag(type)
                emitField(fieldName, value)
                closeBlockTag()
            }
        }

        function isUndefined(node: ts.Node) {
            return node && node.kind === SK.Identifier && (node as ts.Identifier).text === "undefined";
        }

        function isLiteralNode(node: ts.Node): boolean {
            if (!node) {
                return false
            }
            switch (node.kind) {
                case SK.ParenthesizedExpression:
                    return isLiteralNode((node as ts.ParenthesizedExpression).expression)
                case SK.NumericLiteral:
                case SK.StringLiteral:
                case SK.NoSubstitutionTemplateLiteral:
                case SK.TrueKeyword:
                case SK.FalseKeyword:
                    return true
                case SK.PrefixUnaryExpression:
                    const expression = (node as ts.PrefixUnaryExpression)
                    return (expression.operator === SK.PlusToken || expression.operator === SK.MinusToken) && isLiteralNode(expression.operand)
                default:
                    return false;
            }
        }

        /**
         * Takes a series of comment ranges and converts them into string suitable for a
         * comment block in blockly. All comments above a statement will be included,
         * regardless of single vs multi line and whitespace. Paragraphs are delineated
         * by empty lines between comments (a commented empty line, not an empty line
         * between two separate comment blocks)
         */
        function getCommentText(commentRanges: ts.CommentRange[]) {
            let text = ""
            let currentLine = ""

            for (const commentRange of commentRanges) {
                const commentText = fileText.substr(commentRange.pos, commentRange.end - commentRange.pos)
                if (commentRange.kind === SyntaxKind.SingleLineCommentTrivia) {
                    appendMatch(commentText, singleLineCommentRegex)
                }
                else {
                    const lines = commentText.split("\n")
                    for (const line of lines) {
                        appendMatch(line, multiLineCommentRegex)
                    }
                }
            }

            text += currentLine

            return text.trim()

            function appendMatch(line: string, regex: RegExp) {
                const match = regex.exec(line)
                if (match) {
                    const matched = match[1].trim()
                    if (matched) {
                        currentLine += currentLine ? " " + matched : matched
                    } else {
                        text += currentLine + "\n"
                        currentLine = ""
                    }
                }
            }
        }

        function pushScope() {
            scopes.push({})
        }

        function popScope() {
            scopes.pop();
        }

        function addVariable(name: string) {
            scopes[scopes.length - 1][name] = getNewName(name);
        }

        function addVariableDeclaration(node: VariableDeclaration): boolean {
            if (node.name.kind !== SK.Identifier) {
                error(node, Util.lf("Variable declarations may not use binding patterns"))
                return false;
            }
            else if (!node.initializer) {
                error(node, Util.lf("Variable declarations must have an initializer"))
                return false;
            }
            const name = (node.name as ts.Identifier).text
            addVariable(name)
            return true;
        }

        function getVariableName(name: string) {
            const existingName = findVariableName(name);
            if (existingName) {
                return existingName;
            }
            else {
                addVariable(name);
                return name;
            }
        }

        function findVariableName(name: string) {
            for (let i = scopes.length - 1; i >= 0; i--) {
                if (scopes[i][name]) {
                    return scopes[i][name];
                }
            }
            return undefined;
        }

        function isScopeEnd(n: NextNode): n is "ScopeEnd" {
            return typeof n === "string"
        }

        function getNewName(name: string) {
            if (!takenNames[name]) {
                takenNames[name] = true;
                return name;
            }

            // If the variable is a single lower case letter, try and rename it to a different letter (i.e. i -> j)
            if (name.length === 1) {
                const charCode = name.charCodeAt(0);
                if (charCode >= lowerCaseAlphabetStartCode && charCode <= lowerCaseAlphabetEndCode) {
                    const offset = charCode - lowerCaseAlphabetStartCode;
                    for (let i = 1; i < 26; i++) {
                        const newChar = String.fromCharCode(lowerCaseAlphabetStartCode + ((offset + i) % 26));
                        if (!takenNames[newChar]) {
                            takenNames[newChar] = true;
                            return newChar;
                        }
                    }
                }
            }

            // For all other names, add a number to the end. Start at 2 because it probably makes more sense for kids
            for (let i = 2; ; i++) {
                const toTest = name + i;
                if (!takenNames[toTest]) {
                    takenNames[toTest] = true;
                    return toTest;
                }
            }
        }
    }
}