
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
        "===": { type: "logic_compare", op: "EQ" },
        "!=": { type: "logic_compare", op: "NEQ" },
        "!==": { type: "logic_compare", op: "NEQ" },
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

    interface Scope {
        renames: Map<string>;
        usages: Map<boolean>;
        autoDeclarations?: ts.VariableDeclaration[];
    }

    interface BlocklyNode {
        kind: string;
    }

    interface TextNode {
        kind: "text";
        value: string;
    }

    interface FieldNode extends BlocklyNode {
        kind: "field";
        name: string;
        value: string | number;
    }

    interface ValueNode extends BlocklyNode {
        kind: "value";
        name: string;
        value: OutputNode;
        shadowType?: ShadowType;
    }

    interface BlockNode extends BlocklyNode {
        type: string;
        inputs?: ValueNode[];
        fields?: FieldNode[]
        mutation?: Map<string>;
    }

    interface ExpressionNode extends BlockNode {
        kind: "expr";
    }

    interface StatementNode extends BlockNode {
        kind: "statement";
        handlers?: Handler[];
        next?: StatementNode;
        prev?: StatementNode;
    }

    interface EventHandlerNode extends BlockNode {
        kind: "event";
        handler: Handler;
    }

    interface Handler {
        name: string,
        statement: StatementNode
    }

    type OutputNode = ExpressionNode | TextNode;

    export interface DecompileBlocksOptions {
        snippetMode?: boolean; // do not emit "on start"
    }

    export function decompileToBlocks(blocksInfo: pxtc.BlocksInfo, file: ts.SourceFile, options: DecompileBlocksOptions): pxtc.CompileResult {
        let stmts: ts.Statement[] = file.statements;
        let result: pxtc.CompileResult = {
            blocksInfo: blocksInfo,
            outfiles: {}, diagnostics: [], success: true, times: {}
        }
        const fileText = file.getFullText();
        let output = ""
        const scopes: Scope[] = [getNewScope()];
        const takenNames: pxt.Map<boolean> = {}

        const unusedDeclarations: [string, ts.Node][] = []

        //emitBlockStatement(stmts, undefined, true, true);

        const n = codeBlock(stmts, undefined, true, true);
        emitStatementNode(n);

        result.outfiles[file.fileName.replace(/(\.blocks)?\.\w*$/i, '') + '.blocks'] = `<xml xmlns="http://www.w3.org/1999/xhtml">
${output}</xml>`;

        return result;

        function write(s: string, suffix = "\n") {
            output += s + suffix
        }

        function error(n: ts.Node, msg?: string) {
            const messageText = msg || `Language feature "${n.getFullText().trim()}"" not supported in blocks`;
            const diags = pxtc.patchUpDiagnostics([{
                file: file,
                start: n.getFullStart(),
                length: n.getFullWidth(),
                messageText,
                category: ts.DiagnosticCategory.Error,
                code: 1001
            }])
            pxt.debug(`decompilation error: ${messageText}`)
            U.pushRange(result.diagnostics, diags)
            result.success = false;
        }

        function isEventExpression(expr: ts.ExpressionStatement): boolean {
            if (expr.expression.kind == SK.CallExpression) {
                const call = expr.expression as ts.CallExpression;
                const callInfo: pxtc.CallInfo = (call as any).callInfo
                if (!callInfo) {
                    error(expr)
                    return false;
                }
                return !callInfo.isExpression && hasArrowFunction(callInfo);
            }
            return false;
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

        function emitStatementNode(n: StatementNode) {
            openBlockTag(n.type)

            emitBlockNodeCore(n);

            if (n.handlers) {
                n.handlers.forEach(emitHandler);
            }

            if (n.next) {
                write("<next>")
                emitStatementNode(n.next);
                write("</next>")
            }
            closeBlockTag();
        }

        function emitBlockNodeCore(n: BlockNode) {
            if (n.mutation) {
                write("<mutation ");
                for (const key in n.mutation) {
                    write(`${key}="${n.mutation[key]}" `);
                }
                write("/>");
            }

            if (n.fields) {
                n.fields.forEach(emitFieldNode)
            }

            if (n.inputs) {
                n.inputs.forEach(emitValueNode);
            }
        }

        function emitValueNode(n: ValueNode) {
            write(`<value name="${n.name}">`)

            let emitShadowOnly = false;

            if (n.value.kind === "expr") {
                const value = n.value as ExpressionNode;
                switch (value.type) {
                    case "math_number":
                    case "logic_boolean":
                    case "text":
                        emitShadowOnly = true;
                        break
                    default:
                }
            }

            if (emitShadowOnly) {
                emitOutputNode(n.value, true);
            }
            else {
                // Emit a shadow block to appear if the given input is removed
                if (n.shadowType !== undefined) {
                    switch (n.shadowType) {
                        case ShadowType.Number:
                            write(`<shadow type="math_number"><field name="NUM">0</field></shadow>`)
                            break;
                        case ShadowType.Boolean:
                            write(`<shadow type="logic_boolean"><field name="BOOL">FALSE</field></shadow>`)
                            break;
                        case ShadowType.String:
                            write(`<shadow type="text"><field name="TEXT"></field></shadow>`)
                            break;
                        default:
                    }
                }
                emitOutputNode(n.value);
            }

            write(`</value>`)
        }

        function emitFieldNode(n: FieldNode) {
            write(`<field name="${U.htmlEscape(n.name)}">${U.htmlEscape(n.value.toString())}</field>`);
        }

        function emitHandler(h: Handler) {
            write(`<statement name="${U.htmlEscape(h.name)}">`)
            emitStatementNode(h.statement);
            write(`</statement>`)
        }

        function emitOutputNode(n: OutputNode, shadow = false) {
            if (n.kind === "text") {
                const node = n as TextNode;
                write(node.value);
            }
            else {
                const node = n as ExpressionNode;
                const tag = shadow ? "shadow" : "block";

                write(`<${tag} type="${U.htmlEscape(node.type)}">`)
                emitBlockNodeCore(node);
                write(`</${tag}>`)
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
                if (statement.kind == SK.ExpressionStatement &&
                    (isOutputExpression((statement as ts.ExpressionStatement).expression) ||
                        (isEventExpression(statement as ts.ExpressionStatement) && !checkStatement(statement))
                    ) && topLevel) {
                    outputStatements.unshift(statement)
                }
                else {
                    blockStatements.unshift(statement)
                }
            });

            if (blockStatements.length > (partOfCurrentBlock ? 0 : 1)) {
                // wrap statement in "on start" if top level
                const emitOnStart = topLevel && !options.snippetMode;
                if (emitOnStart) {
                    openBlockTag(ts.pxtc.ON_START_TYPE);
                    write(`<statement name="HANDLER">`)
                }
                emitStatementBlock(blockStatements.shift(), blockStatements, parent);
                if (emitOnStart) {
                    write(`</statement>`)
                    closeBlockTag();
                }
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
            if (checkExpression(n)) {
                emitFieldBlock("typescript_expression", "EXPRESSION", n.getFullText(), false)
            }
            else {
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
            }

            function emitBinaryExpression(n: ts.BinaryExpression): void {
                const op = n.operatorToken.getText();
                const npp = ops[op];

                // Could be string concatenation
                if (isTextJoin(n)) {
                    const args: ts.Node[] = [];
                    collectTextJoinArgs(n, args);

                    openBlockTag("text_join");
                    write(`<mutation items="${args.length}"></mutation>`)

                    for (let i = 0; i < args.length; i++) {
                        emitValue("ADD" + i, args[i], ShadowType.String);
                    }


                    closeBlockTag();
                    return;
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

            function isTextJoin(n: ts.Node): n is ts.BinaryExpression {
                if (n.kind === SK.BinaryExpression) {
                    const b = n as ts.BinaryExpression;
                    if (b.operatorToken.getText() === "+") {
                        const info: BinaryExpressionInfo = (n as any).exprInfo;
                        return !!info;
                    }
                }

                return false;
            }

            function collectTextJoinArgs(n: ts.Node, result: ts.Node[]) {
                if (isTextJoin(n)) {
                    collectTextJoinArgs(n.left, result);
                    collectTextJoinArgs(n.right, result)
                }
                else {
                    result.push(n);
                }
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

            if (checkStatement(node)) {
                openTypeScriptStatementBlock(node);
            }
            else {
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
                        let isAuto = false
                        if (decl.initializer) {
                            if (decl.initializer.kind === SyntaxKind.NullKeyword || decl.initializer.kind === SyntaxKind.FalseKeyword) {
                                isAuto = true
                            }
                            else if (isStringOrNumericLiteral(decl.initializer.kind)) {
                                const text = decl.initializer.getText();
                                isAuto = text === "0" || isEmptyString(text);
                            }
                            else {
                                const callInfo: pxtc.CallInfo = (decl.initializer as any).callInfo
                                if (callInfo && callInfo.isAutoCreate)
                                    isAuto = true
                            }
                        }
                        if (isAuto) {
                            trackAutoDeclaration(decl);
                            // Don't emit null or automatic initializers;
                            // They are implicit within the blocks. But do add a name to the scope
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
                const leds = ((arg as ts.StringLiteral).text || '').replace(/\s+/g, '');
                const nc = info.attrs.imageLiteral * 5;
                if (nc * 5 != leds.length) {
                    error(node, Util.lf("Invalid image pattern"));
                    return;
                }
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
                const initializer = n.initializer as ts.VariableDeclarationList;
                const indexVar = (initializer.declarations[0].name as ts.Identifier).text;
                const condition = n.condition as ts.BinaryExpression


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

                emitStatementTag("DO", n.statement);
                popScope()
            }

            function openVariableSetOrChangeBlock(name: string, value: Node | number, changed = false, overrideName = false) {
                openBlockTag(changed ? "variables_change" : "variables_set")
                if (!overrideName) {
                    name = getVariableName(name);
                }
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

                if (ts.isFunctionLike(info.decl)) {
                    const decl = info.decl as FunctionLikeDeclaration;
                    if (decl.parameters && decl.parameters.length === 1 && ts.isRestParameter(decl.parameters[0])) {
                        openCallExpressionBlockWithRestParameter(node, info);
                        return;
                    }
                }

                const argNames: string[] = []
                info.attrs.block.replace(/%(\w+)/g, (f, n) => {
                    argNames.push(n)
                    return ""
                });

                if (info.attrs.defaultInstance) {
                    argNames.unshift("__instance__");
                }

                openBlockTag(info.attrs.blockId);
                if (extraArgs) write(extraArgs);
                info.args.forEach((e, i) => {
                    if (i === 0 && info.attrs.defaultInstance) {
                        if (e.getText() === info.attrs.defaultInstance) {
                            return;
                        }
                        else {
                            write(`<mutation showing="true"></mutation>`);
                        }
                    }

                    switch (e.kind) {
                        case SK.ArrowFunction:
                            emitDestructuringMutation(e as ArrowFunction);
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

            function openCallExpressionBlockWithRestParameter(call: ts.CallExpression, info: pxtc.CallInfo) {
                openBlockTag(info.attrs.blockId);
                write(`<mutation count="${info.args.length}" />`)
                info.args.forEach((expression, index) => {
                    emitValue("value_input_" + index, expression, ShadowType.Number);
                });
            }

            function emitDestructuringMutation(callback: ts.ArrowFunction) {
                if (callback.parameters.length === 1 && callback.parameters[0].name.kind === SK.ObjectBindingPattern) {
                    const elements = (callback.parameters[0].name as ObjectBindingPattern).elements;

                    const renames: { [index: string]: string } = {};

                    const properties = elements.map(e => {
                        if (checkName(e.propertyName) && checkName(e.name)) {
                            const name = (e.name as Identifier).text;
                            if (e.propertyName) {
                                const propName = (e.propertyName as Identifier).text;
                                renames[propName] = name;
                                return propName;
                            }
                            return name;
                        }
                        else {
                            return "";
                        }
                    });

                    write(`<mutation callbackproperties="${properties.join(",")}" renamemap="${Util.htmlEscape(JSON.stringify(renames))}"></mutation>`)
                }

                function checkName(name: Node) {
                    if (name && name.kind !== SK.Identifier) {
                        error(name, Util.lf("Only identifiers may be used for variable names in object destructuring patterns"));
                        return false;
                    }
                    return true;
                }
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
                if (n.parameters.length > 0 && !(n.parameters.length === 1 && n.parameters[0].name.kind === SK.ObjectBindingPattern)) {
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

        function openTypeScriptStatementBlock(node: ts.Node) {
            openBlockTag("typescript_statement");

            const parts = node.getText().split("\n");

            write(`<mutation numlines="${parts.length}" `);
            parts.forEach((p, i) => {
                write(`line${i}="${U.htmlEscape(p)}" `);
            });

            write(`/>`)
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

        function getOutputBlock(n: ts.Node): OutputNode {
            if (checkExpression(n)) {
                return getFieldBlock("typescript_expression", "EXPRESSION", n.getFullText())
            }
            else {
                switch (n.kind) {
                    case SK.ExpressionStatement:
                        return getOutputBlock((n as ts.ExpressionStatement).expression);
                    case SK.ParenthesizedExpression:
                        return getOutputBlock((n as ts.ParenthesizedExpression).expression);
                    case SK.Identifier:
                        return getIdentifier(n as ts.Identifier);
                    case SK.StringLiteral:
                    case SK.FirstTemplateToken:
                    case SK.NoSubstitutionTemplateLiteral:
                        return getStringLiteral((n as ts.LiteralExpression).text);
                    case SK.NumericLiteral:
                        return getNumericLiteral((n as ts.LiteralExpression).text);
                    case SK.TrueKeyword:
                        return getBooleanLiteral(true);
                    case SK.FalseKeyword:
                        return getBooleanLiteral(false);
                    case SK.BinaryExpression:
                        return getBinaryExpression(n as ts.BinaryExpression);
                    case SK.PrefixUnaryExpression:
                        return getPrefixUnaryExpression(n as ts.PrefixUnaryExpression);
                    case SK.PropertyAccessExpression:
                        return getPropertyAccessExpression(n as ts.PropertyAccessExpression);
                    case SK.CallExpression:
                        //emitStatementBlock(n);
                        break;
                    default:
                        error(n, Util.lf("Unsupported syntax kind for output expression block: {0}", SK[n.kind]));
                        break;
                }
                return undefined;
            }
        }

        function getExpressionNode(type: string): ExpressionNode {
            return { kind: "expr", type }
        }

        function getBinaryExpression(n: ts.BinaryExpression): ExpressionNode {
            const op = n.operatorToken.getText();
            const npp = ops[op];

            // Could be string concatenation
            if (isTextJoin(n)) {
                const args: ts.Node[] = [];
                collectTextJoinArgs(n, args);

                const result: ExpressionNode = {
                    kind: "expr",
                    type: "text_join",
                    mutation: {
                        "items": args.length.toString()
                    },
                    inputs: []
                };

                for (let i = 0; i < args.length; i++) {
                    result.inputs.push(getValue("ADD" + i, args[i], ShadowType.String));
                }

                return result;
            }

            const result: ExpressionNode = {
                kind: "expr",
                type: npp.type,
                fields: [],
                inputs: []
            };

            if (npp.op) {
                result.fields.push(getField("OP", npp.op))
            }

            const shadowType = (op === "&&" || op === "||") ? ShadowType.Boolean : ShadowType.Number;

            result.inputs.push(getValue(npp.leftName || "A", n.left, shadowType));
            result.inputs.push(getValue(npp.rightName || "B", n.right, shadowType));

            return result;

            function isTextJoin(n: ts.Node): n is ts.BinaryExpression {
                if (n.kind === SK.BinaryExpression) {
                    const b = n as ts.BinaryExpression;
                    if (b.operatorToken.getText() === "+") {
                        const info: BinaryExpressionInfo = (n as any).exprInfo;
                        return !!info;
                    }
                }

                return false;
            }

            function collectTextJoinArgs(n: ts.Node, result: ts.Node[]) {
                if (isTextJoin(n)) {
                    collectTextJoinArgs(n.left, result);
                    collectTextJoinArgs(n.right, result)
                }
                else {
                    result.push(n);
                }
            }
        }

        function getValue(name: string, contents: boolean | number | string | Node, shadowType?: ShadowType): ValueNode {
            let value: OutputNode;

            if (typeof contents === "number") {
                value = getNumericLiteral(contents.toString())
            }
            else if (typeof contents === "boolean") {
                value = getBooleanLiteral(contents)
            }
            else if (typeof contents === "string") {
                value = getStringLiteral(contents)
            }
            else {
                // // If this is some expression, we want to also emit a shadow block in case the expression
                // // gets pulled out of the block
                // if (shadowType && !isLiteralNode(contents)) {
                //     switch (shadowType) {
                //         case ShadowType.Number:
                //             emitNumericLiteral("0")
                //             break;
                //         case ShadowType.String:
                //             emitStringLiteral("")
                //             break;
                //         case ShadowType.Boolean:
                //             emitBooleanLiteral(true)
                //     }
                // }
                value = getOutputBlock(contents)
            }


            return { kind: "value", name, value, shadowType };
        }

        function getIdentifier(identifier: Identifier): ExpressionNode {
            return getFieldBlock("variables_get", "VAR", getVariableName(identifier.text));
        }

        function getNumericLiteral(value: string): ExpressionNode {
            return getFieldBlock("math_number", "NUM", value);
        }

        function getStringLiteral(value: string): ExpressionNode {
            return getFieldBlock("text", "TEXT", value);
        }

        function getBooleanLiteral(value: boolean): ExpressionNode {
            return getFieldBlock("logic_boolean", "BOOL", value ? "TRUE" : "FALSE");
        }

        function getFieldBlock(type: string, fieldName: string, value: string): ExpressionNode {
            return {
                kind: "expr",
                type,
                fields: [getField(fieldName, value)]
            };
        }

        function getField(name: string, value: string): FieldNode {
            return {
                kind: "field",
                name,
                value,
            };
        }

        // TODO: Add a real negation block
        function negateNumericNode(node: ts.Node): ExpressionNode {
            return {
                kind: "expr",
                type: "math_arithmetic",
                inputs: [
                    getValue("A", 0),
                    getValue("B", node, ShadowType.Number)
                ],
                fields: [
                    getField("OP", "MINUS")
                ]
            };
        }

        function getPrefixUnaryExpression(node: PrefixUnaryExpression): OutputNode {
            switch (node.operator) {
                case SK.ExclamationToken:
                    const r = getExpressionNode("logic_negate");
                    r.inputs = [getValue("BOOL", node.operand, ShadowType.Boolean)]
                    return r;
                case SK.PlusToken:
                    return getOutputBlock(node.operand);
                case SK.MinusToken:
                    if (node.operand.kind == SK.NumericLiteral) {
                        return getNumericLiteral("-" + (node.operand as ts.LiteralExpression).text)
                    } else {
                        return negateNumericNode(node.operand)
                    }
                default:
                    error(node);
                    break;
            }
            return undefined;
        }

        function getPropertyAccessExpression(n: ts.PropertyAccessExpression): OutputNode {
            let callInfo = (n as any).callInfo as pxtc.CallInfo;
            if (!callInfo) {
                error(n);
                return;
            }
            const value = U.htmlEscape(callInfo.attrs.blockId || callInfo.qName);

            if (callInfo.attrs.blockIdentity) {
                let idfn = blocksInfo.apis.byQName[callInfo.attrs.blockIdentity];
                let f = /%([a-zA-Z0-9_]+)/.exec(idfn.attributes.block);

                return {
                    kind: "expr",
                    type: U.htmlEscape(idfn.attributes.blockId),
                    fields: [{
                        kind: "field",
                        name: U.htmlEscape(f[1]),
                        value
                    }]
                };
            }
            else {
                return {
                    kind: "text",
                    value
                }
            }
        }

        function getStatementBlock(n: NextNode, next?: NextNode[], parent?: ts.Node): StatementNode {
            if (isScopeEnd(n)) {
                popScope();
                return getNext();
            }

            const node = n as ts.Node;
            let stmt: StatementNode;

            if (checkStatement(node)) {
                openTypeScriptStatementBlock(node);
            }
            else {
                switch (node.kind) {
                    case SK.Block:
                        pushScope();
                        return codeBlock((node as ts.Block).statements, next);
                    case SK.ExpressionStatement:
                        return getStatementBlock((node as ts.ExpressionStatement).expression, next, parent || node);
                    case SK.VariableStatement:
                        return codeBlock((node as ts.VariableStatement).declarationList.declarations, next, true, false, parent || node);
                    case SK.ArrowFunction:
                        return getArrowFunctionStatement(node as ts.ArrowFunction, next);
                    case SK.BinaryExpression:
                        stmt = getBinaryExpressionStatement(node as ts.BinaryExpression);
                        break;
                    case SK.PostfixUnaryExpression:
                    case SK.PrefixUnaryExpression:
                        stmt = getIncrementStatement(node as (ts.PrefixUnaryExpression | ts.PostfixUnaryExpression));
                        break;
                    case SK.VariableDeclaration:
                        const decl = node as ts.VariableDeclaration;
                        let isAuto = false
                        if (decl.initializer) {
                            if (decl.initializer.kind === SyntaxKind.NullKeyword || decl.initializer.kind === SyntaxKind.FalseKeyword) {
                                isAuto = true
                            }
                            else if (isStringOrNumericLiteral(decl.initializer.kind)) {
                                const text = decl.initializer.getText();
                                isAuto = text === "0" || isEmptyString(text);
                            }
                            else {
                                const callInfo: pxtc.CallInfo = (decl.initializer as any).callInfo
                                if (callInfo && callInfo.isAutoCreate)
                                    isAuto = true
                            }
                        }
                        if (isAuto) {
                            trackAutoDeclaration(decl);
                            // Don't emit null or automatic initializers;
                            // They are implicit within the blocks. But do add a name to the scope
                            if (addVariableDeclaration(decl)) {
                            }
                            return getNext();
                        }
                        stmt = getVariableDeclarationStatement(node as ts.VariableDeclaration);
                        break;
                    case SK.WhileStatement:
                        stmt = getWhileStatement(node as ts.WhileStatement);
                        break;
                    case SK.IfStatement:
                        stmt = getIfStatement(node as ts.IfStatement);
                        break;
                    case SK.ForStatement:
                        stmt = getForStatement(node as ts.ForStatement);
                        break;
                    case SK.CallExpression:
                        stmt = getCallStatement(node as ts.CallExpression);
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
            }

            if (stmt) {
                stmt.next = getNext();
                if (stmt.next) {
                    stmt.next.prev = stmt;
                }
            }

            // const commentRanges = ts.getLeadingCommentRangesOfNode(parent || node, file)
            // if (commentRanges) {
            //     const commentText = getCommentText(commentRanges)

            //     if (commentText) {
            //         write(`<comment pinned="false">${U.htmlEscape(commentText)}</comment>`)
            //     }
            // }

            return stmt;

            function getNext() {
                if (next && next.length) {
                    return getStatementBlock(next.shift(), next, parent);
                }
                return undefined;
            }

            function openImageLiteralExpressionBlock(node: ts.CallExpression, info: pxtc.CallInfo) {
                let arg = node.arguments[0];
                if (arg.kind != SK.StringLiteral && arg.kind != SK.NoSubstitutionTemplateLiteral) {
                    error(node)
                    return;
                }
                openBlockTag(info.attrs.blockId);
                const leds = ((arg as ts.StringLiteral).text || '').replace(/\s+/g, '');
                const nc = info.attrs.imageLiteral * 5;
                if (nc * 5 != leds.length) {
                    error(node, Util.lf("Invalid image pattern"));
                    return;
                }
                for (let r = 0; r < 5; ++r) {
                    for (let c = 0; c < nc; ++c) {
                        emitField(`LED${c}${r}`, /[#*1]/.test(leds[r * nc + c]) ? "TRUE" : "FALSE")
                    }
                }
            }

            function getBinaryExpressionStatement(n: ts.BinaryExpression): StatementNode {
                if (n.left.kind !== SK.Identifier) {
                    error(n, Util.lf("Only variable names may be assigned to"));
                    return;
                }

                const name = (n.left as ts.Identifier).text;

                switch (n.operatorToken.kind) {
                    case SK.EqualsToken:
                        return getVariableSetOrChangeBlock(name, n.right);
                    case SK.PlusEqualsToken:
                        return getVariableSetOrChangeBlock(name, n.right, true);
                    case SK.MinusEqualsToken:
                        return {
                            kind: "statement",
                            type: "variables_change",
                            inputs: [{
                                kind: "value",
                                name: "VALUE",
                                value: negateNumericNode(n.right)
                            }],
                            fields: [getField("VAR", getVariableName(name))]
                        };
                    default:
                        error(n, Util.lf("Unsupported operator token in statement {0}", SK[n.operatorToken.kind]));
                        return;
                }
            }

            function getWhileStatement(n: ts.WhileStatement): StatementNode {
                return {
                    kind: "statement",
                    type: "device_while",
                    inputs: [getValue("COND", n.expression, ShadowType.Boolean)],
                    handlers: [{ name: "DO", statement: getStatementBlock(n.statement) }]
                };
            }

            function getIfStatement(n: ts.IfStatement): StatementNode {
                let flatif = flattenIfStatement(n);

                const r: StatementNode = {
                    kind: "statement",
                    type: "controls_if",
                    mutation: {
                        "elseif": (flatif.ifStatements.length - 1).toString(),
                        "else": flatif.elseStatement ? "1" : "0"
                    },
                    inputs: [],
                    handlers: []
                };

                flatif.ifStatements.forEach((stmt, i) => {
                    r.inputs.push(getValue("IF" + i, stmt.expression, ShadowType.Boolean));
                    r.handlers.push({ name: "DO" + i, statement: getStatementBlock(stmt.thenStatement) });
                });

                if (flatif.elseStatement) {
                    r.handlers.push({ name: "ELSE", statement: getStatementBlock(flatif.elseStatement) });
                }

                return r;
            }

            function getForStatement(n: ts.ForStatement): StatementNode {
                const initializer = n.initializer as ts.VariableDeclarationList;
                const indexVar = (initializer.declarations[0].name as ts.Identifier).text;
                const condition = n.condition as ts.BinaryExpression

                pushScope();
                addVariable(indexVar);

                const r: StatementNode = {
                    kind: "statement",
                    type: "controls_simple_for",
                    fields: [getField("VAR", getVariableName(indexVar))],
                    inputs: [],
                    handlers: []
                };

                // FIXME: We never decompile repeat blocks correctly, they are always converted into a for-loop.
                // To decompile repeat, we would need to check to make sure the initialized variable is
                // never referenced in the loop body

                if (condition.operatorToken.kind === SK.LessThanToken) {
                    r.inputs.push({
                        kind: "value",
                        name: "TO",
                        shadowType: ShadowType.Number,
                        value: {
                            kind: "expr",
                            type: "math_arithmetic",
                            fields: [getField("OP", "MINUS")],
                             inputs:[
                                 getValue("A", condition.right, ShadowType.Number),
                                 getValue("B", 1)
                             ]
                        }
                    });
                }
                else if (condition.operatorToken.kind === SK.LessThanEqualsToken) {
                    r.inputs.push(getValue("TO", condition.right, ShadowType.Number));
                }

                r.handlers.push({ name: "DO", statement: getStatementBlock(n.statement) });

                popScope();

                return r;
            }

            function getVariableSetOrChangeBlock(name: string, value: Node | number, changed = false, overrideName = false): StatementNode {
                if (!overrideName) {
                    name = getVariableName(name);
                }

                // We always do a number shadow even if the variable is not of type number
                return {
                    kind: "statement",
                    type: changed ? "variables_change" : "variables_set",
                    inputs: [getValue("VALUE", value, ShadowType.Number)],
                    fields: [getField("VAR", name)]
                };
            }

            function getVariableDeclarationStatement(n: ts.VariableDeclaration): StatementNode {
                if (addVariableDeclaration(n)) {
                    return getVariableSetOrChangeBlock((n.name as ts.Identifier).text, n.initializer)
                }
                return undefined;
            }

            function getIncrementStatement(node: ts.PrefixUnaryExpression | PostfixUnaryExpression): StatementNode {
                const isPlusPlus = node.operator === SK.PlusPlusToken;

                if (!isPlusPlus && node.operator !== SK.MinusMinusToken) {
                    error(node);
                    return;
                }

                return getVariableSetOrChangeBlock((node.operand as ts.Identifier).text, isPlusPlus ? 1 : -1, true);
            }

            function getCallStatement(node: ts.CallExpression) {
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
                }

                if (info.attrs.imageLiteral) {
                    openImageLiteralExpressionBlock(node, info);
                    return;
                }

                if (ts.isFunctionLike(info.decl)) {
                    // const decl = info.decl as FunctionLikeDeclaration;
                    // if (decl.parameters && decl.parameters.length === 1 && ts.isRestParameter(decl.parameters[0])) {
                    //     openCallExpressionBlockWithRestParameter(node, info);
                    //     return;
                    // }
                }

                const argNames: string[] = []
                info.attrs.block.replace(/%(\w+)/g, (f, n) => {
                    argNames.push(n)
                    return ""
                });

                if (info.attrs.defaultInstance) {
                    argNames.unshift("__instance__");
                }

                const r: StatementNode = {
                    kind: "statement",
                    type: info.attrs.blockId
                }

                info.args.forEach((e, i) => {
                    if (i === 0 && info.attrs.defaultInstance) {
                        if (e.getText() === info.attrs.defaultInstance) {
                            return;
                        }
                        else {
                            r.mutation = { "showing": "true" };
                        }
                    }

                    switch (e.kind) {
                        case SK.ArrowFunction:
                            const m = getDestructuringMutation(e as ArrowFunction);
                            if (m) {
                                r.mutation = m;
                            }
                            (r.handlers || (r.handlers = [])).push({ name: "HANDLER", statement: getStatementBlock(e) });
                            break;
                        case SK.PropertyAccessExpression:
                            const callInfo = (e as any).callInfo as pxtc.CallInfo;
                            const shadow = callInfo && !!callInfo.attrs.blockIdentity
                            const aName = U.htmlEscape(argNames[i]);

                            if (shadow) {
                                (r.inputs || (r.inputs = [])).push(getValue(aName, e));
                            }
                            else {
                                (r.fields || (r.fields = [])).push(getField(aName, (getPropertyAccessExpression(e as PropertyAccessExpression) as TextNode).value));
                            }
                            break;
                        default:
                            let v: ValueNode;
                            const vName = U.htmlEscape(argNames[i]);

                            if (info.qName == "Math.random") {
                                v = {
                                    kind: "value",
                                    name: vName,
                                    value: getMathRandomArgumentExpresion(e)
                                };
                            }
                            else {
                                v = getValue(vName, e);
                            }

                            (r.inputs || (r.inputs = [])).push(v);
                            break;
                    }
                });

                return r;
            }

            function openCallExpressionBlockWithRestParameter(call: ts.CallExpression, info: pxtc.CallInfo) {
                openBlockTag(info.attrs.blockId);
                write(`<mutation count="${info.args.length}" />`)
                info.args.forEach((expression, index) => {
                    emitValue("value_input_" + index, expression, ShadowType.Number);
                });
            }

            function getDestructuringMutation(callback: ts.ArrowFunction): Map<string> {
                if (callback.parameters.length === 1 && callback.parameters[0].name.kind === SK.ObjectBindingPattern) {
                    const elements = (callback.parameters[0].name as ObjectBindingPattern).elements;

                    const renames: { [index: string]: string } = {};

                    const properties = elements.map(e => {
                        if (checkName(e.propertyName) && checkName(e.name)) {
                            const name = (e.name as Identifier).text;
                            if (e.propertyName) {
                                const propName = (e.propertyName as Identifier).text;
                                renames[propName] = name;
                                return propName;
                            }
                            return name;
                        }
                        else {
                            return "";
                        }
                    });

                    return {
                        "callbackproperties": properties.join(","),
                        "renamemap": Util.htmlEscape(JSON.stringify(renames))
                    };
                }

                return undefined;

                function checkName(name: Node) {
                    if (name && name.kind !== SK.Identifier) {
                        error(name, Util.lf("Only identifiers may be used for variable names in object destructuring patterns"));
                        return false;
                    }
                    return true;
                }
            }

            function getMathRandomArgumentExpresion(e: ts.Expression): OutputNode {
                switch (e.kind) {
                    case SK.NumericLiteral:
                        const n = e as LiteralExpression;
                        return getNumericLiteral((parseInt(n.text) - 1).toString());
                    case SK.BinaryExpression:
                        const op = e as BinaryExpression;
                        if (op.operatorToken.kind == SK.PlusToken && (op.right as any).text == "1") {
                            return getOutputBlock(op.left);
                        }
                    default:
                        //This will definitely lead to an error, but the above are the only two cases generated by blocks
                        return getOutputBlock(e);
                }
            }

            function getArrowFunctionStatement(n: ts.ArrowFunction, next: NextNode[]) {
                if (n.parameters.length > 0 && !(n.parameters.length === 1 && n.parameters[0].name.kind === SK.ObjectBindingPattern)) {
                    error(n);
                    return;
                }

                pushScope();
                return getStatementBlock(n.body, next)
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

        function codeBlock(statements: ts.Node[], next?: NextNode[], partOfCurrentBlock = false, topLevel = false, parent?: ts.Node) {
            const outputStatements: ts.Node[] = [];
            const blockStatements: NextNode[] = next || [];

            if (!partOfCurrentBlock) {
                // Push a marker indicating where this block ends (for keeping track of variable names)
                blockStatements.unshift("ScopeEnd")
            }

            // Go over the statements in reverse so that we can insert the nodes into the existing list if there is one
            statements.reverse().forEach(statement => {
                if (statement.kind == SK.ExpressionStatement &&
                    (isOutputExpression((statement as ts.ExpressionStatement).expression) ||
                        (isEventExpression(statement as ts.ExpressionStatement) && !checkStatement(statement))
                    ) && topLevel) {
                    outputStatements.unshift(statement)
                }
                else {
                    blockStatements.unshift(statement)
                }
            });

            if (blockStatements.length > (partOfCurrentBlock ? 0 : 1)) {
                // wrap statement in "on start" if top level
                return getStatementBlock(blockStatements.shift(), blockStatements, parent);
                // const emitOnStart = topLevel && !options.snippetMode;
                // if (emitOnStart) {
                //     openBlockTag(ts.pxtc.ON_START_TYPE);
                //     write(`<statement name="HANDLER">`)
                // }
                // if (emitOnStart) {
                //     write(`</statement>`)
                //     closeBlockTag();
                // }
            }
            return undefined;
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

        function getNewScope(): Scope {
            return { renames: {}, usages: {}, autoDeclarations: [] }
        }

        function getCurrentScope() {
            return scopes[scopes.length - 1];
        }

        function pushScope() {
            scopes.push(getNewScope())
        }

        function popScope() {
            const current = scopes.pop();
            current.autoDeclarations.forEach(v => {
                const rename = current.renames[(v.name as ts.Identifier).text];
                if (!current.usages[rename]) {
                    unusedDeclarations.push([rename, v]);
                }
            })
        }

        function addVariable(name: string) {
            getCurrentScope().renames[name] = getNewName(name);
        }

        function trackAutoDeclaration(n: ts.VariableDeclaration) {
            getCurrentScope().autoDeclarations.push(n);
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
                const rename = scopes[i].renames[name];
                if (rename) {
                    scopes[i].usages[rename] = true;
                    return rename;
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

    function checkStatement(node: ts.Node): string {
        switch (node.kind) {
            case SK.WhileStatement:
            case SK.IfStatement:
            case SK.Block:
            case SK.ExpressionStatement:
                return undefined;
            case SK.VariableStatement:
                return checkVariableStatement(node as ts.VariableStatement);
            case SK.CallExpression:
                return checkCall(node as ts.CallExpression);
            case SK.VariableDeclaration:
                return checkVariableDeclaration(node as ts.VariableDeclaration);
            case SK.PostfixUnaryExpression:
            case SK.PrefixUnaryExpression:
                return checkIncrementorExpression(node as (ts.PrefixUnaryExpression | ts.PostfixUnaryExpression));
            case SK.ArrowFunction:
                return checkArrowFunction(node as ts.ArrowFunction);
            case SK.BinaryExpression:
                return checkBinaryExpression(node as ts.BinaryExpression);
            case SK.ForStatement:
                return checkForStatement(node as ts.ForStatement);
        }

        return Util.lf("Unsupported statement in block: {0}", SK[node.kind]);

        function checkForStatement(n: ts.ForStatement) {
            if (!n.initializer || !n.incrementor || !n.condition) {
                return Util.lf("for loops must have an initializer, incrementor, and condition");
            }

            if (n.initializer.kind !== SK.VariableDeclarationList) {
                return Util.lf("only variable declarations are permitted in for loop initializers");
            }

            const initializer = n.initializer as ts.VariableDeclarationList;

            if (!initializer.declarations) {
                return Util.lf("for loop with out-of-scope variables not supported");
            }
            if (initializer.declarations.length != 1) {
                return Util.lf("for loop with multiple variables not supported");
            }

            const indexVar = (initializer.declarations[0].name as ts.Identifier).text;
            if (!incrementorIsValid(indexVar)) {
                return Util.lf("for loop incrementors may only increment the variable declared in the initializer");
            }

            if (n.condition.kind !== SK.BinaryExpression) {
                return Util.lf("for loop conditionals must be binary comparison operations")
            }

            const condition = n.condition as ts.BinaryExpression
            if (condition.left.kind !== SK.Identifier || (condition.left as ts.Identifier).text !== indexVar) {
                return Util.lf("left side of for loop conditional must be the variable declared in the initializer")
            }

            if (condition.operatorToken.kind !== SK.LessThanToken && condition.operatorToken.kind !== SK.LessThanEqualsToken) {
                return Util.lf("for loop conditional operator must be either < or <=");
            }

            return undefined;

            function incrementorIsValid(varName: string): boolean {
                if (n.incrementor.kind === SK.PostfixUnaryExpression || n.incrementor.kind === SK.PrefixUnaryExpression) {
                    const incrementor = n.incrementor as ts.PostfixUnaryExpression | ts.PrefixUnaryExpression;
                    if (incrementor.operator === SK.PlusPlusToken && incrementor.operand.kind === SK.Identifier) {
                        return (incrementor.operand as ts.Identifier).text === varName;
                    }
                }
                return false;
            }
        }

        function checkBinaryExpression(n: ts.BinaryExpression) {
            if (n.left.kind !== SK.Identifier) {
                return Util.lf("Only variable names may be assigned to")
            }

            switch (n.operatorToken.kind) {
                case SK.EqualsToken:
                case SK.PlusEqualsToken:
                case SK.MinusEqualsToken:
                    return undefined;
                default:
                    return Util.lf("Unsupported operator token in statement {0}", SK[n.operatorToken.kind]);
            }
        }

        function checkArrowFunction(n: ts.ArrowFunction) {
            if (n.parameters.length > 0 && !(n.parameters.length === 1 && n.parameters[0].name.kind === SK.ObjectBindingPattern)) {
                return Util.lf("Unsupported parameters in error function");
            }
            return undefined;
        }

        function checkIncrementorExpression(n: (ts.PrefixUnaryExpression | ts.PostfixUnaryExpression)) {
            if (n.operand.kind != SK.Identifier) {
                return Util.lf("-- and ++ may only be used on an identifier")
            }

            if (n.operator !== SK.PlusPlusToken && n.operator !== SK.MinusMinusToken) {
                return Util.lf("Only ++ and -- supported as prefix or postfix unary operators in a statement");
            }

            return undefined;
        }

        function checkVariableDeclaration(n: ts.VariableDeclaration) {
            if (n.name.kind !== SK.Identifier) {
                return Util.lf("Variable declarations may not use binding patterns");
            }
            else if (!n.initializer) {
                return Util.lf("Variable declarations must have an initializer");
            }

            return undefined;
        }

        function checkVariableStatement(n: ts.VariableStatement) {
            for (const declaration of n.declarationList.declarations) {
                const res = checkVariableDeclaration(declaration);
                if (res) {
                    return res;
                }
            }
            return undefined;
        }

        function checkCall(n: ts.CallExpression) {
            const info: pxtc.CallInfo = (n as any).callInfo;
            if (!info) {
                return Util.lf("Function call not supported in the blocks");
            }

            if (!info.attrs.blockId || !info.attrs.block) {
                const builtin = builtinBlocks[info.qName];
                if (!builtin) {
                    return Util.lf("Function call not supported in the blocks");
                }
                info.attrs.block = builtin.block;
                info.attrs.blockId = builtin.blockId;
            }

            if (info.attrs.imageLiteral) {
                let arg = n.arguments[0];
                if (arg.kind != SK.StringLiteral && arg.kind != SK.NoSubstitutionTemplateLiteral) {
                    return Util.lf("Only string literals supported for image literals")
                }
                const leds = ((arg as ts.StringLiteral).text || '').replace(/\s+/g, '');
                const nc = info.attrs.imageLiteral * 5;
                if (nc * 5 != leds.length) {
                    return Util.lf("Invalid image pattern");
                }
                return undefined;
            }

            const argNames: string[] = []
            info.attrs.block.replace(/%(\w+)/g, (f, n) => {
                argNames.push(n)
                return ""
            });

            const argumentDifference = info.args.length - argNames.length;
            if (argumentDifference > 0 && !(info.attrs.defaultInstance && argumentDifference === 1)) {
                const hasCallback = hasArrowFunction(info);
                if (argumentDifference > 1 || !hasCallback) {
                    return Util.lf("Function call has more arguments than are supported by its block");
                }
            }

            return undefined;
        }
    }

    function checkExpression(n: ts.Node): string {
        switch (n.kind) {
            case SK.StringLiteral:
            case SK.FirstTemplateToken:
            case SK.NoSubstitutionTemplateLiteral:
            case SK.NumericLiteral:
            case SK.TrueKeyword:
            case SK.FalseKeyword:
            case SK.ExpressionStatement:
            case SK.ParenthesizedExpression:
                return undefined;
            case SK.Identifier:
                return isUndefined(n) ? Util.lf("Undefined is not supported in blocks") : undefined;
            case SK.BinaryExpression:
                const op1 = (n as BinaryExpression).operatorToken.getText();
                return ops[op1] ? undefined : Util.lf("Could not find operator {0}", op1);
            case SK.PrefixUnaryExpression:
                const op2 = (n as PrefixUnaryExpression).operator;
                return op2 === SK.MinusToken || op2 === SK.PlusToken || op2 === SK.ExclamationToken ?
                    undefined : Util.lf("Unsupported prefix unary operator{0}", op2);
            case SK.PropertyAccessExpression:
                return (n as any).callInfo ? undefined : Util.lf("No call info found");
            case SK.CallExpression:
                return checkStatement(n);
        }
        return Util.lf("Unsupported syntax kind for output expression block: {0}", SK[n.kind]);
    }

    function isEmptyString(a: string) {
        return a === `""` || a === `''` || a === "``";
    }

    function isUndefined(node: ts.Node) {
        return node && node.kind === SK.Identifier && (node as ts.Identifier).text === "undefined";
    }

    function hasArrowFunction(info: CallInfo): boolean {
        const parameters = (info.decl as FunctionLikeDeclaration).parameters;
        return info.args.some((arg, index) => arg && arg.kind === SK.ArrowFunction);
    }
}