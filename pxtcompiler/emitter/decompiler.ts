
namespace ts.pxtc.decompiler {
    const SK = ts.SyntaxKind;

    const lowerCaseAlphabetStartCode = 97;
    const lowerCaseAlphabetEndCode = 122;

    const validStringRegex = /^[^\f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$/;

    interface ParameterInfo {
        name: string;
        type?: string;
        decompileLiterals?: boolean;
        paramShadowOptions?: pxt.Map<string>;
        paramFieldEditorOptions?: pxt.Map<string>;
        paramFieldEditor?: string;
        fieldName?: string;
    }

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

    const builtinBlocks: pxt.Map<{ block: string; blockId: string; }> = {
        "Math.abs": { blockId: "math_op3", block: "absolute of %x" },
        "Math.min": { blockId: "math_op2", block: "of %x|and %y" },
        "Math.max": { blockId: "math_op2", block: "of %x|and %y" }
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
        isShadow?: boolean;
    }

    interface StatementNode extends BlockNode {
        kind: "statement";
        handlers?: Handler[];
        next?: StatementNode;
        prev?: StatementNode;
        comment?: string;
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

    export interface RenameLocation {
        name: string;
        diff: number;
        span: ts.TextSpan;
    }

    export class RenameMap {
        constructor(private renames: RenameLocation[]) {
            this.renames.sort((a, b) => a.span.start - b.span.start);
        }

        public getRenamesInSpan(start: number, end: number) {
            const res: RenameLocation[] = [];

            for (const rename of this.renames) {
                if (rename.span.start > end) {
                    break;
                }

                else if (rename.span.start >= start) {
                    res.push(rename);
                }
            }

            return res;
        }

        public getRenameForPosition(position: number) {
            for (const rename of this.renames) {
                if (rename.span.start > position) {
                    return undefined;
                }
                else if (rename.span.start === position) {
                    return rename;
                }
            }
            return undefined;
        }
    }


    class LSHost implements ts.LanguageServiceHost {
            constructor(private p: ts.Program) {}

            getCompilationSettings(): ts.CompilerOptions {
                const opts = this.p.getCompilerOptions();
                opts.noLib = true;
                return opts;
            }

            getNewLine(): string { return "\n" }

            getScriptFileNames(): string[] {
                return this.p.getSourceFiles().map(f => f.fileName);
            }

            getScriptVersion(fileName: string): string {
                return "0";
            }

            getScriptSnapshot(fileName: string): ts.IScriptSnapshot {
                const f = this.p.getSourceFile(fileName);
                return {
                    getLength: () => f.getFullText().length,
                    getText: () => f.getFullText(),
                    getChangeRange: () => undefined
                };
            }

            getCurrentDirectory(): string { return "."; }

            getDefaultLibFileName(options: ts.CompilerOptions): string { return null; }

            useCaseSensitiveFileNames(): boolean { return true; }
    }

    /**
     * Uses the language service to ensure that there are no duplicate variable
     * names in the given file. All variables in Blockly are global, so this is
     * necessary to prevent local variables from colliding.
     */
    export function buildRenameMap(p: Program, s: SourceFile): RenameMap {
        let service = ts.createLanguageService(new LSHost(p))
        const allRenames: RenameLocation[] = [];

        collectNameCollisions();


        if (allRenames.length) {
            return new RenameMap(allRenames);
        }

        return undefined;

        function collectNameCollisions(): void {
            const takenNames: Map<boolean> = {};

            checkChildren(s);

            function checkChildren(n: Node): void {
                ts.forEachChild(n, (child) => {
                    if (child.kind === SK.VariableDeclaration && (child as ts.VariableDeclaration).name.kind === SK.Identifier) {
                        const name = (child as ts.VariableDeclaration).name.getText();

                        if (takenNames[name]) {
                            const newName = getNewName(name);
                            const renames = service.findRenameLocations(s.fileName, (child as ts.VariableDeclaration).name.pos + 1, false, false);
                            if (renames) {
                                renames.forEach(r => {
                                    allRenames.push({
                                        name: newName,
                                        diff: newName.length - name.length,
                                        span: r.textSpan
                                    });
                                });
                            }
                        }
                        else {
                            takenNames[name] = true;
                        }
                    }
                    checkChildren(child);
                });
            }

            function getNewName(name: string) {

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

    export interface DecompileBlocksOptions {
        snippetMode?: boolean; // do not emit "on start"
    }

    export function decompileToBlocks(blocksInfo: pxtc.BlocksInfo, file: ts.SourceFile, options: DecompileBlocksOptions, renameMap?: RenameMap): pxtc.CompileResult {
        let stmts: ts.Statement[] = file.statements;
        let result: pxtc.CompileResult = {
            blocksInfo: blocksInfo,
            outfiles: {}, diagnostics: [], success: true, times: {}
        }
        const fileText = file.getFullText();
        let output = ""

        const varUsages: pxt.Map<boolean> = {};
        const autoDeclarations: [string, ts.Node][] = [];
        const declaredFunctions: pxt.Map<boolean> = {};

        ts.forEachChild(file, topLevelNode => {
            if (topLevelNode.kind === SK.FunctionDeclaration && !checkStatement(topLevelNode, blocksInfo, false, true)) {
                declaredFunctions[getVariableName((topLevelNode as ts.FunctionDeclaration).name)] = true;
            }
        })

        const n = codeBlock(stmts, undefined, true);
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
                return callInfo.attrs.blockId && !callInfo.isExpression && hasArrowFunction(callInfo);
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
            if (!n) {
                return;
            }

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

            if (n.comment !== undefined) {
                write(`<comment pinned="false">${U.htmlEscape(n.comment)}</comment>`)
            }

            closeBlockTag();
        }

        function emitBlockNodeCore(n: BlockNode) {
            if (n.mutation) {
                write("<mutation ", "");
                for (const key in n.mutation) {
                    write(`${key}="${n.mutation[key]}" `, "");
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
                            write(`<shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow>`)
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
                const tag = shadow || node.isShadow ? "shadow" : "block";

                write(`<${tag} type="${U.htmlEscape(node.type)}">`)
                emitBlockNodeCore(node);
                write(`</${tag}>`)
            }
        }

        function openBlockTag(type: string) {
            write(`<block type="${U.htmlEscape(type)}">`)
        }

        function closeBlockTag() {
            write(`</block>`)
        }

        function getOutputBlock(n: ts.Node): OutputNode {
            if (checkExpression(n, blocksInfo)) {
                return getTypeScriptExpressionBlock(n);
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
                    case SK.ArrayLiteralExpression:
                        return getArrayLiteralExpression(n as ts.ArrayLiteralExpression);
                    case SK.ElementAccessExpression:
                        return getElementAccessExpression(n as ts.ElementAccessExpression);
                    case SK.CallExpression:
                        return getStatementBlock(n, undefined, undefined, true) as any;
                    default:
                        error(n, Util.lf("Unsupported syntax kind for output expression block: {0}", SK[n.kind]));
                        break;
                }
                return undefined;
            }
        }

        function applyRenamesInRange(text: string, start: number, end: number) {
            if (renameMap) {
                const renames = renameMap.getRenamesInSpan(start, end);

                if (renames.length) {
                    let offset = 0;

                    renames.forEach(rename => {
                        const sIndex = rename.span.start + offset - start;
                        const eIndex = sIndex + rename.span.length;

                        offset += rename.diff;

                        text = text.slice(0, sIndex) + rename.name + text.slice(eIndex);
                    });
                }
            }

            return text;
        }

        function getTypeScriptExpressionBlock(n: ts.Node) {
            const text = applyRenamesInRange(n.getFullText(), n.getFullStart(), n.getEnd());
            return getFieldBlock(pxtc.TS_OUTPUT_TYPE, "EXPRESSION", text);
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
                value = getOutputBlock(contents)
            }


            return { kind: "value", name, value, shadowType };
        }

        function getIdentifier(identifier: Identifier): ExpressionNode {
            const name = getVariableName(identifier);
            varUsages[name] = true;
            return getFieldBlock("variables_get", "VAR", name);
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

        function getFieldBlock(type: string, fieldName: string, value: string, isShadow?: boolean): ExpressionNode {
            return {
                kind: "expr",
                type,
                fields: [getField(fieldName, value)],
                isShadow: isShadow
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
                    const r: ExpressionNode = { kind: "expr", type: "logic_negate" };
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

            if (callInfo.attrs.blockId === "lists_length") {
                return {
                    kind: "expr",
                    type: U.htmlEscape(callInfo.attrs.blockId),
                    inputs: [getValue("VALUE", n.expression)]
                };
            }

            let value = U.htmlEscape(callInfo.attrs.blockId || callInfo.qName);

            const [parent, ] = getParent(n);
            const parentCallInfo: pxtc.CallInfo = parent && (parent as any).callInfo;
            if (callInfo.attrs.blockIdentity && !(parentCallInfo && parentCallInfo.qName === callInfo.attrs.blockIdentity)) {
                if (callInfo.attrs.enumval && parentCallInfo && parentCallInfo.attrs.useEnumVal) {
                    value = callInfo.attrs.enumval;
                }

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

        function getArrayLiteralExpression(n: ts.ArrayLiteralExpression): ExpressionNode {
            return {
                kind: "expr",
                type: "lists_create_with",
                inputs: n.elements.map((e, i) => getValue("ADD" + i, e)),
                mutation: {
                    "items": n.elements.length.toString()
                }
            };
        }

        function getElementAccessExpression(n: ts.ElementAccessExpression): ExpressionNode {
            return {
                kind: "expr",
                type: "lists_index_get",
                inputs: [getValue("LIST", n.expression), getValue("INDEX", n.argumentExpression)]
            };
        }

        function getStatementBlock(n: ts.Node, next?: ts.Node[], parent?: ts.Node, asExpression = false, topLevel = false): StatementNode {
            const node = n as ts.Node;
            let stmt: StatementNode;

            if (checkStatement(node, blocksInfo, asExpression, topLevel)) {
                stmt = getTypeScriptStatementBlock(node);
            }
            else {
                switch (node.kind) {
                    case SK.Block:
                        return codeBlock((node as ts.Block).statements, next);
                    case SK.ExpressionStatement:
                        return getStatementBlock((node as ts.ExpressionStatement).expression, next, parent || node, asExpression, topLevel);
                    case SK.VariableStatement:
                        return codeBlock((node as ts.VariableStatement).declarationList.declarations, next, false, parent || node);
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
                        if (isAutoDeclaration(decl)) {
                            // Don't emit null or automatic initializers;
                            // They are implicit within the blocks. But do track them in case they
                            // never get used in the blocks (and thus won't be emitted again)

                            trackAutoDeclaration(decl);
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
                    case SK.ForOfStatement:
                        stmt = getForOfStatement(node as ts.ForOfStatement);
                        break;
                    case SK.FunctionDeclaration:
                        stmt = getFunctionDeclaration(node as ts.FunctionDeclaration);
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

            const commentRanges = ts.getLeadingCommentRangesOfNode(parent || node, file)
            if (commentRanges) {
                const commentText = getCommentText(commentRanges)

                if (commentText && stmt) {
                    stmt.comment = commentText;
                }
                else {
                    // ERROR TODO
                }
            }

            return stmt;

            function getNext() {
                if (next && next.length) {
                    return getStatementBlock(next.shift(), next, undefined, false, topLevel);
                }
                return undefined;
            }
        }

        function getTypeScriptStatementBlock(node: ts.Node): StatementNode {
            const r: StatementNode = {
                kind: "statement",
                type: pxtc.TS_STATEMENT_TYPE,
                mutation: {}
            };

            let text = node.getText();
            const start = node.getStart();
            const end = node.getEnd();

            text = applyRenamesInRange(text, start, end);

            const declaredVariables: string[] = [];
            if (node.kind === SK.VariableStatement) {
                for (const declaration of (node as ts.VariableStatement).declarationList.declarations) {
                    declaredVariables.push(getVariableName(declaration.name as ts.Identifier));
                }
            }

            if (declaredVariables.length) {
                r.mutation["declaredvars"] = declaredVariables.join(",");
            }

            const parts = text.split("\n");
            r.mutation["numlines"] = parts.length.toString();

            parts.forEach((p, i) => {
                r.mutation[`line${i}`] = U.htmlEscape(p);
            });

            return r;
        }

        function getImageLiteralStatement(node: ts.CallExpression, info: pxtc.CallInfo) {
            let arg = node.arguments[0];
            if (arg.kind != SK.StringLiteral && arg.kind != SK.NoSubstitutionTemplateLiteral) {
                error(node)
                return;
            }

            const res: StatementNode = {
                kind: "statement",
                type: info.attrs.blockId,
                fields: []
            };

            const leds = ((arg as ts.StringLiteral).text || '').replace(/\s+/g, '');
            const nc = info.attrs.imageLiteral * 5;
            if (nc * 5 != leds.length) {
                error(node, Util.lf("Invalid image pattern"));
                return;
            }
            for (let r = 0; r < 5; ++r) {
                for (let c = 0; c < nc; ++c) {
                    res.fields.push(getField(`LED${c}${r}`, /[#*1]/.test(leds[r * nc + c]) ? "TRUE" : "FALSE"))
                }
            }

            return res;
        }

        function getBinaryExpressionStatement(n: ts.BinaryExpression): StatementNode {
            const name = (n.left as ts.Identifier).text;

            switch (n.operatorToken.kind) {
                case SK.EqualsToken:
                    if (n.left.kind === SK.Identifier) {
                        return getVariableSetOrChangeBlock(n.left as ts.Identifier, n.right);
                    }
                    else {
                        return getArraySetBlock(n.left as ts.ElementAccessExpression, n.right);
                    }
                case SK.PlusEqualsToken:
                    return getVariableSetOrChangeBlock(n.left as ts.Identifier, n.right, true);
                case SK.MinusEqualsToken:
                    return {
                        kind: "statement",
                        type: "variables_change",
                        inputs: [{
                            kind: "value",
                            name: "VALUE",
                            value: negateNumericNode(n.right),
                            shadowType: ShadowType.Number
                        }],
                        fields: [getField("VAR", getVariableName(n.left as ts.Identifier))]
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

            const renamed = getVariableName(initializer.declarations[0].name as ts.Identifier);

            let r: StatementNode;

            if (condition.operatorToken.kind === SK.LessThanToken && !checkForVariableUsages(n.statement)) {
                r = {
                    kind: "statement",
                    type: "controls_repeat_ext",
                    fields: [],
                    inputs: [getValue("TIMES", condition.right, ShadowType.Number)],
                    handlers: []
                };
            }
            else {
                r = {
                    kind: "statement",
                    type: "controls_simple_for",
                    fields: [getField("VAR", renamed)],
                    inputs: [],
                    handlers: []
                };

                if (condition.operatorToken.kind === SK.LessThanToken) {
                    r.inputs.push({
                        kind: "value",
                        name: "TO",
                        shadowType: ShadowType.Number,
                        value: {
                            kind: "expr",
                            type: "math_arithmetic",
                            fields: [getField("OP", "MINUS")],
                                inputs: [
                                    getValue("A", condition.right, ShadowType.Number),
                                    getValue("B", 1)
                                ]
                        }
                    });
                }
                else if (condition.operatorToken.kind === SK.LessThanEqualsToken) {
                    r.inputs.push(getValue("TO", condition.right, ShadowType.Number));
                }
            }

            r.handlers.push({ name: "DO", statement: getStatementBlock(n.statement) });
            return r;

            function checkForVariableUsages(node: Node): boolean {
                if (node.kind === SK.Identifier && getVariableName(node as ts.Identifier) === renamed) {
                    return true;
                }

                return ts.forEachChild(node, checkForVariableUsages);
            }
        }

        function getForOfStatement(n: ts.ForOfStatement): StatementNode {
            const initializer = n.initializer as ts.VariableDeclarationList;
            const indexVar = (initializer.declarations[0].name as ts.Identifier).text;
            const renamed = getVariableName(initializer.declarations[0].name as ts.Identifier);

            return {
                kind: "statement",
                type: "controls_for_of",
                inputs: [getValue("LIST", n.expression)],
                fields: [getField("VAR", renamed)],
                handlers: [{ name: "DO", statement: getStatementBlock(n.statement) }]
            };
        }

        function getVariableSetOrChangeBlock(name: ts.Identifier, value: Node | number, changed = false, overrideName = false): StatementNode {
            const renamed = getVariableName(name);
            varUsages[renamed] = true;
            // We always do a number shadow even if the variable is not of type number
            return {
                kind: "statement",
                type: changed ? "variables_change" : "variables_set",
                inputs: [getValue("VALUE", value, ShadowType.Number)],
                fields: [getField("VAR", renamed)]
            };
        }

        function getArraySetBlock(left: ts.ElementAccessExpression, right: ts.Expression): StatementNode {
            return {
                kind: "statement",
                type: "lists_index_set",
                inputs: [
                    getValue("LIST", left.expression),
                    getValue("INDEX", left.argumentExpression, ShadowType.Number),
                    getValue("VALUE", right)
                ]
            };
        }

        function getVariableDeclarationStatement(n: ts.VariableDeclaration): StatementNode {
            if (addVariableDeclaration(n)) {
                return getVariableSetOrChangeBlock(n.name as ts.Identifier, n.initializer)
            }
            return undefined;
        }

        function getIncrementStatement(node: ts.PrefixUnaryExpression | PostfixUnaryExpression): StatementNode {
            const isPlusPlus = node.operator === SK.PlusPlusToken;

            if (!isPlusPlus && node.operator !== SK.MinusMinusToken) {
                error(node);
                return;
            }

            return getVariableSetOrChangeBlock(node.operand as ts.Identifier, isPlusPlus ? 1 : -1, true);
        }

        function getFunctionDeclaration(n: ts.FunctionDeclaration): StatementNode {
            const name = getVariableName(n.name);
            const statements = getStatementBlock(n.body);
            return {
                kind: "statement",
                type: "procedures_defnoreturn",
                fields: [getField("NAME", name)],
                handlers: [{ name: "STACK", statement: statements }]
            };
        }

        function getCallStatement(node: ts.CallExpression): StatementNode {
            const info: pxtc.CallInfo = (node as any).callInfo

            if (!info.attrs.blockId || !info.attrs.block) {
                const builtin = builtinBlocks[info.qName];
                if (!builtin) {
                    const name = getVariableName(node.expression as ts.Identifier);
                    if (declaredFunctions[name]) {
                        return {
                            kind: "statement",
                            type: "procedures_callnoreturn",
                            mutation: {"name": name}
                        };
                    }
                    else {
                        return getTypeScriptStatementBlock(node);
                    }
                }
                info.attrs.block = builtin.block;
                info.attrs.blockId = builtin.blockId;
            }

            if (info.attrs.imageLiteral) {
                return getImageLiteralStatement(node, info);
            }

            if (ts.isFunctionLike(info.decl)) {
                // const decl = info.decl as FunctionLikeDeclaration;
                // if (decl.parameters && decl.parameters.length === 1 && ts.isRestParameter(decl.parameters[0])) {
                //     openCallExpressionBlockWithRestParameter(node, info);
                //     return;
                // }
            }

            const paramInfo = getParameterInfo(info, blocksInfo);

            const r: StatementNode = {
                kind: "statement",
                type: info.attrs.blockId
            }

            if (info.qName == "Math.max") {
                (r.fields || (r.fields = [])).push({
                    kind: "field",
                    name: "op",
                    value: "max"
                });
            }


            info.args.forEach((e, i) => {
                e = unwrapNode(e) as Expression;
                if (i === 0 && info.attrs.defaultInstance) {
                    if (e.getText() === info.attrs.defaultInstance) {
                        return;
                    }
                    else {
                        r.mutation = { "showing": "true" };
                    }
                }

                if (info.attrs.mutatePropertyEnum && i === info.args.length - 2) {
                    // Implicit in the blocks
                    return;
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
                        const aName = U.htmlEscape(paramInfo[i].name);

                        if (shadow && callInfo.attrs.blockIdentity !== info.qName) {
                            (r.inputs || (r.inputs = [])).push(getValue(aName, e));
                        }
                        else {
                            const expr = getOutputBlock(e);
                            if (expr.kind === "text") {
                                (r.fields || (r.fields = [])).push(getField(aName, (expr as TextNode).value));
                            }
                            else {
                                (r.inputs || (r.inputs = [])).push({
                                    kind: "value",
                                    name: aName,
                                    value: expr
                                });
                            }
                        }
                        break;
                    default:
                        let v: ValueNode;
                        const vName = U.htmlEscape(paramInfo[i].name);
                        let defaultV = true;

                        if (info.qName == "Math.random") {
                            v = {
                                kind: "value",
                                name: vName,
                                value: getMathRandomArgumentExpresion(e)
                            };
                            defaultV = false;
                        } else if (isLiteralNode(e)) {
                            const param = paramInfo[i];

                            if (param.decompileLiterals) {
                                let fieldBlock = getFieldBlock(param.type, param.fieldName, e.getText(), true);
                                if (param.paramShadowOptions) {
                                    fieldBlock.mutation = {"customfield": Util.htmlEscape(JSON.stringify(param.paramShadowOptions))};
                                }

                                v = {
                                    kind: "value",
                                    name: vName,
                                    value: fieldBlock
                                };
                                defaultV = false;
                            }
                            else if (param.paramFieldEditorOptions && param.paramFieldEditorOptions['onParentBlock']) {
                                (r.fields || (r.fields = [])).push(getField(vName, e.getText()));
                                return;
                            }
                        }
                        if (defaultV) {
                            v = getValue(vName, e);
                        }

                        (r.inputs || (r.inputs = [])).push(v);
                        break;
                }
            });

            return r;
        }

        // function openCallExpressionBlockWithRestParameter(call: ts.CallExpression, info: pxtc.CallInfo) {
        //     openBlockTag(info.attrs.blockId);
        //     write(`<mutation count="${info.args.length}" />`)
        //     info.args.forEach((expression, index) => {
        //         emitValue("value_input_" + index, expression, ShadowType.Number);
        //     });
        // }

        function getDestructuringMutation(callback: ts.ArrowFunction): Map<string> {
            const bindings = getObjectBindingProperties(callback);
            if (bindings) {
                return {
                    "callbackproperties": bindings[0].join(","),
                    "renamemap": Util.htmlEscape(JSON.stringify(bindings[1]))
                };
            }

            return undefined;
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

        function getArrowFunctionStatement(n: ts.ArrowFunction, next: ts.Node[]) {
            if (n.parameters.length > 0 && !(n.parameters.length === 1 && n.parameters[0].name.kind === SK.ObjectBindingPattern)) {
                error(n);
                return;
            }

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

        function codeBlock(statements: ts.Node[], next?: ts.Node[], topLevel = false, parent?: ts.Node) {
            const eventStatements: ts.Node[] = [];
            const blockStatements: ts.Node[] = next || [];

            // Go over the statements in reverse so that we can insert the nodes into the existing list if there is one
            statements.reverse().forEach(statement => {
                if ((statement.kind === SK.FunctionDeclaration ||
                    (statement.kind == SK.ExpressionStatement && isEventExpression(statement as ts.ExpressionStatement))) &&
                    !checkStatement(statement, blocksInfo, false, topLevel)) {
                    eventStatements.unshift(statement)
                }
                else {
                    blockStatements.unshift(statement)
                }
            });

            eventStatements.map(n => getStatementBlock(n, undefined, undefined, false, topLevel)).forEach(emitStatementNode);

            if (blockStatements.length) {
                // wrap statement in "on start" if top level
                const stmt = getStatementBlock(blockStatements.shift(), blockStatements, parent, false, topLevel);
                const emitOnStart = topLevel && !options.snippetMode;
                if (emitOnStart) {
                    // Preserve any variable edeclarations that were never used
                    let current = stmt;
                    autoDeclarations.forEach(([name, node]) => {
                        if (varUsages[name]) {
                            return;
                        }
                        const v = getVariableSetOrChangeBlock((node as ts.VariableDeclaration).name as ts.Identifier, (node as ts.VariableDeclaration).initializer, false, true);
                        v.next = current;
                        current = v;
                    });

                    if (current) {
                        return {
                            kind: "statement",
                            type: ts.pxtc.ON_START_TYPE,
                            handlers: [{
                                name: "HANDLER",
                                statement: current
                            }]
                        } as StatementNode;
                    }
                }
                return stmt;
            }

            return undefined;
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

                    if (matched === ON_START_COMMENT) {
                        return;
                    }

                    if (matched) {
                        currentLine += currentLine ? " " + matched : matched
                    } else {
                        text += currentLine + "\n"
                        currentLine = ""
                    }
                }
            }
        }

        function trackAutoDeclaration(n: ts.VariableDeclaration) {
            autoDeclarations.push([getVariableName(n.name as ts.Identifier), n]);
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
            return true;
        }

        function getVariableName(name: ts.Identifier) {
            if (renameMap) {
                const rename = renameMap.getRenameForPosition(name.getStart());
                if (rename) {
                    return rename.name;
                }
            }
            return name.text;
        }
    }

    function checkStatement(node: ts.Node, blocksInfo: BlocksInfo, asExpression = false, topLevel = false): string {
        switch (node.kind) {
            case SK.WhileStatement:
            case SK.IfStatement:
            case SK.Block:
                return undefined;
            case SK.ExpressionStatement:
                return checkStatement((node as ts.ExpressionStatement).expression, blocksInfo, asExpression, topLevel);
            case SK.VariableStatement:
                return checkVariableStatement(node as ts.VariableStatement, blocksInfo);
            case SK.CallExpression:
                return checkCall(node as ts.CallExpression, blocksInfo, asExpression, topLevel);
            case SK.VariableDeclaration:
                return checkVariableDeclaration(node as ts.VariableDeclaration, blocksInfo);
            case SK.PostfixUnaryExpression:
            case SK.PrefixUnaryExpression:
                return checkIncrementorExpression(node as (ts.PrefixUnaryExpression | ts.PostfixUnaryExpression));
            case SK.ArrowFunction:
                return checkArrowFunction(node as ts.ArrowFunction);
            case SK.BinaryExpression:
                return checkBinaryExpression(node as ts.BinaryExpression, blocksInfo);
            case SK.ForStatement:
                return checkForStatement(node as ts.ForStatement);
            case SK.ForOfStatement:
                return checkForOfStatement(node as ts.ForOfStatement);
            case SK.FunctionDeclaration:
                return checkFunctionDeclaration(node as ts.FunctionDeclaration, topLevel);
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

            const assignment = initializer.declarations[0] as VariableDeclaration;
            if (assignment.initializer.kind !== SK.NumericLiteral || (assignment.initializer as ts.LiteralExpression).text !== "0") {
                return Util.lf("for loop initializers must be initialized to 0");
            }

            const indexVar = (assignment.name as ts.Identifier).text;
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

        function checkForOfStatement(n: ts.ForOfStatement) {
            if (n.initializer.kind !== SK.VariableDeclarationList) {
                return Util.lf("only variable declarations are permitted in for of loop initializers");
            }

            // VariableDeclarationList in ForOfStatements are guranteed to have one declaration
            return undefined;
        }

        function checkBinaryExpression(n: ts.BinaryExpression, blocksInfo: BlocksInfo) {
            if (n.left.kind !== SK.Identifier && n.left.kind !== SK.ElementAccessExpression) {
                return Util.lf("Only variable names may be assigned to")
            }

            if (n.left.kind === SK.ElementAccessExpression) {
                if (n.operatorToken.kind !== SK.EqualsToken) {
                    return Util.lf("Element access expressions may only be assigned to using the equals operator");
                }
            }
            else {
                switch (n.operatorToken.kind) {
                    case SK.EqualsToken:
                        return checkExpression(n.right, blocksInfo);
                    case SK.PlusEqualsToken:
                    case SK.MinusEqualsToken:
                        return undefined;
                    default:
                        return Util.lf("Unsupported operator token in statement {0}", SK[n.operatorToken.kind]);
                }
            }
            return undefined;
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

        function checkVariableDeclaration(n: ts.VariableDeclaration, blocksInfo: BlocksInfo) {
            let check: string;

            if (n.name.kind !== SK.Identifier) {
                check = Util.lf("Variable declarations may not use binding patterns");
            }
            else if (!n.initializer) {
                check = Util.lf("Variable declarations must have an initializer");
            }
            else if (!isAutoDeclaration(n)) {
                check = checkExpression(n.initializer, blocksInfo);
            }

            return check;
        }

        function checkVariableStatement(n: ts.VariableStatement, blocksInfo: BlocksInfo) {
            for (const declaration of n.declarationList.declarations) {
                const res = checkVariableDeclaration(declaration, blocksInfo);
                if (res) {
                    return res;
                }
            }
            return undefined;
        }

        function checkCall(n: ts.CallExpression, blocksInfo: BlocksInfo, asExpression = false, topLevel = false) {
            const info: pxtc.CallInfo = (n as any).callInfo;
            if (!info) {
                return Util.lf("Function call not supported in the blocks");
            }

            if (!asExpression && info.isExpression) {
                return Util.lf("No output expressions as statements");
            }

            const hasCallback = hasArrowFunction(info);
            if (hasCallback && !topLevel) {
                return Util.lf("Events must be top level");
            }

            if (!info.attrs.blockId || !info.attrs.block) {
                const builtin = builtinBlocks[info.qName];
                if (!builtin) {
                    if (n.arguments.length === 0 && n.expression.kind === SK.Identifier) {
                        return undefined; // Could be user defined function
                    }
                    return Util.lf("Function call not supported in the blocks");
                }
                info.attrs.block = builtin.block;
                info.attrs.blockId = builtin.blockId;
            }

            const params = getParameterInfo(info, blocksInfo);
            const argumentDifference = info.args.length - params.length;

            if (info.attrs.imageLiteral) {
                if (argumentDifference > 1) {
                    return Util.lf("Function call has more arguments than are supported by its block");
                }

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

            if (argumentDifference > 0 && !checkForDestructuringMutation()) {
                if (argumentDifference > 1 || !hasCallback) {
                    return Util.lf("Function call has more arguments than are supported by its block");
                }
            }

            const api = blocksInfo.apis.byQName[info.qName];
            if (api && api.parameters && api.parameters.length) {
                let fail: string;
                const instance = api.kind == pxtc.SymbolKind.Method || api.kind == pxtc.SymbolKind.Property;
                info.args.forEach((e, i) => {
                    e = unwrapNode(e) as Expression;
                    if (instance && i === 0) {
                        return;
                    }
                    const paramInfo = api.parameters[instance ? i - 1 : i];
                    if (paramInfo.isEnum) {
                        if (e.kind === SK.PropertyAccessExpression) {
                            const enumName = (e as PropertyAccessExpression).expression as Identifier;
                            if (enumName.kind === SK.Identifier && enumName.text === paramInfo.type) {
                                return;
                            }
                        }
                        fail = Util.lf("Enum arguments may only be literal property access expressions");
                        return;
                    }
                    else if (isLiteralNode(e)) {
                        const inf = params[i];
                        if (inf.paramFieldEditor && (!inf.paramFieldEditorOptions || !inf.paramFieldEditorOptions["decompileLiterals"])) {
                            fail = Util.lf("Field editor does not support literal arguments");
                        }
                    }
                });

                if (fail) {
                    return fail;
                }
            }

            if (api) {
                const ns = blocksInfo.apis.byQName[api.namespace];
                if (ns && ns.attributes.fixedInstances && info.args.length) {
                    const callInfo: pxtc.CallInfo = (info.args[0] as any).callInfo;
                    if (!callInfo || !callInfo.attrs.fixedInstance) {
                        return Util.lf("Fixed instance APIs can only be called directly from the fixed instance");
                    }
                }
            }

            return undefined;

            function checkForDestructuringMutation() {
                // If the mutatePropertyEnum is set, the array literal and the destructured
                // properties must have matching names
                if (info.attrs.mutatePropertyEnum && argumentDifference === 2 && info.args.length >= 2) {
                    const arrayArg = info.args[info.args.length - 2] as ArrayLiteralExpression;
                    const callbackArg = info.args[info.args.length - 1] as ArrowFunction;

                    if (arrayArg.kind === SK.ArrayLiteralExpression && callbackArg.kind === SK.ArrowFunction) {
                        const propNames: string[] = [];

                        // Make sure that all elements in the array literal are enum values
                        const allLiterals = !arrayArg.elements.some((e: PropertyAccessExpression) => {
                            if (e.kind === SK.PropertyAccessExpression && e.expression.kind === SK.Identifier) {
                                propNames.push(e.name.text);
                                return (e.expression as ts.Identifier).text !== info.attrs.mutatePropertyEnum;
                            }
                            return true;
                        });

                        if (allLiterals) {
                            // Also need to check that the array literal's values and the destructured values match
                            const bindings = getObjectBindingProperties(callbackArg);

                            if (bindings) {
                                const names = bindings[0];
                                return names.length === propNames.length && !propNames.some(p => names.indexOf(p) === -1);
                            }
                        }
                    }
                }
                return false;
            }
        }

        function checkFunctionDeclaration(n: ts.FunctionDeclaration, topLevel: boolean) {
            if (!topLevel) {
                return Util.lf("Function declarations must be top level");
            }

            if (n.parameters.length > 0) {
                return Util.lf("Functions with parameters not supported in blocks");
            }

            let fail = false;
            ts.forEachReturnStatement(n.body, stmt => {
                if (stmt.expression) {
                    fail = true;
                }
            });

            if (fail) {
                return Util.lf("Function with return value not supported in blocks")
            }

            return undefined;
        }
    }

    function isAutoDeclaration(decl: VariableDeclaration) {
        if (decl.initializer) {
            if (decl.initializer.kind === SyntaxKind.NullKeyword || decl.initializer.kind === SyntaxKind.FalseKeyword) {
                return true
            }
            else if (isStringOrNumericLiteral(decl.initializer.kind)) {
                const text = decl.initializer.getText();
                return text === "0" || isEmptyString(text);
            }
            else {
                const callInfo: pxtc.CallInfo = (decl.initializer as any).callInfo
                if (callInfo && callInfo.isAutoCreate)
                    return true
            }
        }
        return false;
    }

    function getCallInfo(checker: ts.TypeChecker, node: ts.Node, apiInfo: ApisInfo) {
        const symb = checker.getSymbolAtLocation(node);

        if (symb) {
            const qName = checker.getFullyQualifiedName(symb);

            if (qName) {
                return apiInfo.byQName[qName];
            }
        }

        return undefined;
    }

    function getObjectBindingProperties(callback: ts.ArrowFunction): [string[], Map<string>] {
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

            return [properties, renames];
        }

        return undefined;

        function checkName(name: Node) {
            if (name && name.kind !== SK.Identifier) {
                // error(name, Util.lf("Only identifiers may be used for variable names in object destructuring patterns"));
                return false;
            }
            return true;
        }
    }

    function checkExpression(n: ts.Node, blocksInfo: BlocksInfo): string {
        switch (n.kind) {
            case SK.NumericLiteral:
            case SK.TrueKeyword:
            case SK.FalseKeyword:
            case SK.ExpressionStatement:
            case SK.ArrayLiteralExpression:
            case SK.ElementAccessExpression:
                return undefined;
            case SK.ParenthesizedExpression:
                return checkExpression((n as ts.ParenthesizedExpression).expression, blocksInfo);
            case SK.StringLiteral:
            case SK.FirstTemplateToken:
            case SK.NoSubstitutionTemplateLiteral:
                return checkStringLiteral(n as ts.StringLiteral);
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
                return checkPropertyAccessExpression(n as ts.PropertyAccessExpression);
            case SK.CallExpression:
                return checkStatement(n, blocksInfo, true);
        }
        return Util.lf("Unsupported syntax kind for output expression block: {0}", SK[n.kind]);

        function checkStringLiteral(n: ts.StringLiteral) {
            const literal = n.text;
            return validStringRegex.test(literal) ? undefined : Util.lf("Only whitespace character allowed in string literals is space");
        }

        function checkPropertyAccessExpression(n: ts.PropertyAccessExpression) {
            const callInfo: pxtc.CallInfo = (n as any).callInfo;
            if (callInfo) {
                if (callInfo.attrs.blockIdentity || callInfo.attrs.blockId === "lists_length") {
                    return undefined;
                }
                else if (callInfo.decl.kind === SK.EnumMember) {
                    const [parent, child] = getParent(n);
                    let fail = true;

                    if (parent) {
                        const parentInfo: pxtc.CallInfo = (parent as any).callInfo;
                        if (parentInfo && parentInfo.args) {
                            const api = blocksInfo.apis.byQName[parentInfo.qName];
                            const instance = api.kind == pxtc.SymbolKind.Method || api.kind == pxtc.SymbolKind.Property;
                            if (api) {
                                parentInfo.args.forEach((arg, i) => {
                                    if (arg === child) {
                                        const paramInfo = api.parameters[instance ? i - 1 : i];
                                        if (paramInfo.isEnum) {
                                            fail = false;
                                        }
                                    }
                                });
                            }
                        }
                    }

                    if (fail) {
                        return Util.lf("Enum value without a corresponding block");
                    }
                    else {
                        return undefined;
                    }
                }
                else if (callInfo.attrs.fixedInstance && n.parent && n.parent.parent &&
                    n.parent.kind === SK.PropertyAccessExpression && n.parent.parent.kind === SK.CallExpression) {
                    const call = n.parent.parent as CallExpression;
                    if (call.expression === n.parent) {
                        return undefined;
                    }
                }
            }
            return Util.lf("No call info found");
        }
    }

    function getParent(node: Node): [Node, Node] {
        if (!node.parent) {
            return [undefined, node];
        }
        else if (node.parent.kind === SK.ParenthesizedExpression) {
            return getParent(node.parent);
        }
        else {
            return [node.parent, node];
        }
    }

    function unwrapNode(node: Node) {
        while (node.kind === SK.ParenthesizedExpression) {
            node = (node as ParenthesizedExpression).expression;
        }
        return node;
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

    function getParameterInfo(info: CallInfo, blocksInfo: BlocksInfo) {
        const argNames: [string, string][] = []
        info.attrs.block.replace(/%(\w+)(?:=(\w+))?/g, (f, n, v) => {
            argNames.push([n, v])
            return ""
        });

        if (info.attrs.defaultInstance) {
            argNames.unshift(["__instance__", undefined]);
        }

        return argNames.map(([name, type]) => {
            const res: ParameterInfo = { name, type }
            if (name && type) {
                const shadowBlock = blocksInfo.blocksById[type];
                if (shadowBlock) {
                    let fieldName = '';
                    shadowBlock.attributes.block.replace(/%(\w+)/g, (f, n) => {
                        fieldName = n;
                        return "";
                    });
                    res.fieldName = fieldName;
                    const shadowA = shadowBlock.attributes;
                    if (shadowA && shadowA.paramFieldEditor && shadowA.paramFieldEditor[fieldName]) {
                        if (info.attrs.paramShadowOptions && info.attrs.paramShadowOptions[name]) {
                            res.paramShadowOptions = info.attrs.paramShadowOptions[name];
                        }

                        res.decompileLiterals = !!(shadowA.paramFieldEditorOptions && shadowA.paramFieldEditorOptions[fieldName] && shadowA.paramFieldEditorOptions[fieldName]["decompileLiterals"])
                    }
                }
            }

            if (info.attrs.paramFieldEditorOptions) {
                res.paramFieldEditorOptions = info.attrs.paramFieldEditorOptions[name];
            }

            if (info.attrs.paramFieldEditor) {
                res.paramFieldEditor = info.attrs.paramFieldEditor[name];
            }

            return res;
        });
    }
}