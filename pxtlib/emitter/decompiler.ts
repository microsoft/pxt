
namespace ts.pxtc.decompiler {
    const SK = ts.SyntaxKind;

    interface BlockSequence {
        top: number; current: number;
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
        let nexts: BlockSequence[] = [];

        emitTopStatements(stmts);

        result.outfiles[file.fileName.replace(/(\.blocks)?\.\w*$/i, '') + '.blocks'] = `<xml xmlns="http://www.w3.org/1999/xhtml">
${output}</xml>`;

        return result;

        function write(s: string) {
            output += s + "\n"
        }

        function emit(n: ts.Node): void {
            switch (n.kind) {
                case SK.ExpressionStatement:
                    emit((n as ts.ExpressionStatement).expression); break;
                case SK.ParenthesizedExpression:
                    emit((n as ts.ParenthesizedExpression).expression); break;
                case SK.VariableStatement:
                    emitVariableStatement(n as ts.VariableStatement); break;
                case SK.Identifier:
                    emitIdentifier(n as ts.Identifier); break;
                case SK.Block:
                    emitBlock(n as ts.Block); break;
                case SK.CallExpression:
                    emitCallExpression(n as ts.CallExpression); break;
                case SK.StringLiteral:
                case SK.FirstTemplateToken:
                case SK.NoSubstitutionTemplateLiteral:
                    emitStringLiteral(n as ts.StringLiteral); break;
                case SK.PrefixUnaryExpression:
                    emitPrefixUnaryExpression(n as ts.PrefixUnaryExpression); break;
                case SK.PostfixUnaryExpression:
                    emitPostfixUnaryExpression(n as ts.PostfixUnaryExpression); break;
                case SK.BinaryExpression:
                    emitBinaryExpression(n as ts.BinaryExpression); break;
                case SK.NullKeyword:
                    // don't emit anything
                    break;
                case SK.NumericLiteral:
                    emitNumberExpression(n as ts.LiteralExpression); break;
                case SK.TrueKeyword:
                case SK.FalseKeyword:
                    emitBooleanExpression(n as ts.LiteralExpression); break;
                case SK.WhileStatement:
                    emitWhileStatement(n as ts.WhileStatement); break;
                case SK.IfStatement:
                    emitIfStatement(n as ts.IfStatement); break;
                case SK.ForStatement:
                    emitForStatement(n as ts.ForStatement); break;
                case SK.ArrowFunction:
                    emitArrowFunction(n as ts.ArrowFunction); break;
                case SK.PropertyAccessExpression:
                    emitPropertyAccessExpression(n as ts.PropertyAccessExpression); break;
                default:
                    error(n);
                    break;
            }
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

        function writeBeginBlock(type: string) {
            let next = nexts[nexts.length - 1];
            if (next.top > 0) write('<next>')
            write(`<block type="${Util.htmlEscape(type)}">`);
            next.top++;
            next.current++;
        }

        function writeEndBlock() {
            let next = nexts[nexts.length - 1];
            next.current--;
        }

        function pushBlocks() {
            nexts.push({ current: 0, top: 0 });
        }

        function flushBlocks() {
            let next = nexts.pop();
            Util.assert(next && next.current == 0)
            for (let i = 0; i < next.top - 1; ++i) {
                write('</block>')
                write('</next>');
            }
            if (next.top > 0)
                write('</block>')
        }

        function emitPostfixUnaryExpression(n: ts.PostfixUnaryExpression) {
            let parent = n.parent;
            if (parent.kind != ts.SyntaxKind.ExpressionStatement ||
                n.operand.kind != ts.SyntaxKind.Identifier) {
                error(n);
                return;
            }
            let left = (n.operand as ts.Identifier).text;
            switch (n.operator) {
                case ts.SyntaxKind.PlusPlusToken:
                    emitVariableSetOrChange(left, 1, true);
                    break;
                case ts.SyntaxKind.MinusMinusToken:
                    emitVariableSetOrChange(left, -1, true);
                    break;
                default:
                    error(n);
                    break;
            }
        }

        function emitPrefixUnaryExpression(n: ts.PrefixUnaryExpression) {
            switch (n.operator) {
                case ts.SyntaxKind.ExclamationToken:
                    writeBeginBlock("logic_negate");
                    write('<value name="BOOL">');
                    pushBlocks();
                    emit(n.operand);
                    flushBlocks();
                    write('</value>')
                    writeEndBlock();
                    break;
                case ts.SyntaxKind.PlusToken:
                    emit(n.operand); break;
                case ts.SyntaxKind.MinusToken:
                    if (n.operand.kind == ts.SyntaxKind.NumericLiteral) {
                        write(`<block type="math_number"><field name="NUM">-${U.htmlEscape((n.operand as ts.LiteralExpression).text)}</field></block>`)
                    } else {
                        write(`<block type="math_arithmetic">
        <field name="OP">MINUS</field>
        <value name="A">
          <block type="math_number">
            <field name="NUM">0</field>
          </block>
        </value>
        <value name="B">
          <block type="math_number">
            <field name="NUM">`);
                        pushBlocks();
                        emit(n.operand)
                        flushBlocks();
                        write(`</field>
          </block>
        </value>
      </block>`)
                    }
                    break; // TODO add negation block
                case ts.SyntaxKind.PlusPlusToken:
                case ts.SyntaxKind.MinusMinusToken:
                    let parent = n.parent;
                    if (parent.kind != ts.SyntaxKind.ExpressionStatement ||
                        n.operand.kind != ts.SyntaxKind.Identifier) {
                        error(n);
                        return;
                    }
                    emitVariableSetOrChange((n.operand as ts.Identifier).text, n.operator == ts.SyntaxKind.PlusPlusToken ? 1 : -1, true);
                    break;
                default:
                    error(n);
                    break;
            }
        }

        function emitBinaryExpression(n: ts.BinaryExpression): void {
            let op = n.operatorToken.getText();
            if (n.left.kind == ts.SyntaxKind.Identifier) {
                switch (op) {
                    case '=':
                        emitVariableSetOrChange((n.left as ts.Identifier).text, n.right);
                        return;
                    case '+=':
                        emitVariableSetOrChange((n.left as ts.Identifier).text, n.right, true);
                        return;
                }
            }

            let npp = ops[op];
            if (!npp) return error(n);
            writeBeginBlock(npp.type)
            if (npp.op) write(`<field name="OP">${npp.op}</field>`)
            write(`<value name="${npp.leftName || "A"}">`)
            pushBlocks();
            emit(n.left);
            flushBlocks();
            write('</value>')
            write(`<value name="${npp.rightName || "B"}">`)
            pushBlocks();
            emit(n.right)
            flushBlocks();
            write('</value>')
            writeEndBlock();
        }

        function emitIdentifier(n: ts.Identifier) {
            write(`<block type="variables_get"><field name="VAR">${Util.htmlEscape(n.text)}</field></block>`)
        }

        // TODO handle special for loops
        function emitForStatement(n: ts.ForStatement) {
            let vd = n.initializer as ts.VariableDeclarationList;
            if (!vd.declarations) {
                error(n, Util.lf("for loop with out-of-scope variables not supported"));
                return;
            }
            if (vd.declarations.length != 1)
                error(n, Util.lf("for loop with multiple variables not supported"));

            writeBeginBlock("controls_simple_for");
            let id = vd.declarations[0].name as ts.Identifier;
            write(`<field name="VAR">${Util.htmlEscape(id.text)}</field>`)
            write('<value name="TO">');
            let c = n.condition;
            if (c.kind == ts.SyntaxKind.BinaryExpression) {
                let bs = c as ts.BinaryExpression;
                if (bs.left.kind == ts.SyntaxKind.Identifier &&
                    (bs.left as ts.Identifier).text == id.text)
                    if (bs.operatorToken.getText() == "<=") {
                        emit(bs.right)
                    } else if (bs.operatorToken.getText() == "<") {
                        write('<block type="math_number">')
                        if (bs.right.kind == ts.SyntaxKind.NumericLiteral)
                            write(`<field name="NUM">${parseInt((bs.right as ts.LiteralExpression).text) - 1}</field>`)
                        else {
                            write(`<block type="math_arithmetic">
        <field name="OP">MINUS</field>
        <value name="A">
          <block type="math_number">
            <field name="NUM">`)
                            emit(bs.right)
                            write(`</field>
          </block>
        </value>
        <value name="B">
          <block type="math_number">
            <field name="NUM">1</field>
          </block>
        </value>
      </block>`)
                        }
                        write('</block>')
                    }
            }
            write('</value>');
            write('<statement name="DO">')
            emit(n.statement)
            write('</statement>')
            writeEndBlock();
        }

        function emitVariableStatement(n: ts.VariableStatement) {
            n.declarationList.declarations.forEach(decl => {
                emitVariableSetOrChange((decl.name as ts.Identifier).text, decl.initializer)
            })
        }

        function emitVariableSetOrChange(name: string, value: ts.Expression | number, changed = false) {
            const isNumber = typeof value === 'number';
            if (!isNumber) {
                const valueNode = value as ts.Expression;

                // Assignments to null are not supported because there is no block value equivalent to null.
                // However, declarations that initialize to null are fine so long as they occur in the global
                // scope since blocks that have object types will regenerate the initializations in compilation
                if (valueNode.kind === SyntaxKind.NullKeyword) {
                    if (valueNode.parent.kind !== SyntaxKind.VariableDeclaration) {
                        error(valueNode, "Assigning null to a variable is not supported in blocks");
                    }
                    else if (getEnclosingBlockScopeContainer(valueNode).kind !== SyntaxKind.SourceFile) {
                        error(valueNode, "Only globally scoped initializations to null are supported in blocks");
                    }

                    // Do not emit null initializers
                    return;
                }
            }

            writeBeginBlock(changed ? "variables_change" : "variables_set")
            write(`<field name="VAR">${Util.htmlEscape(name)}</field>`)
            if (isNumber)
                write(`<value name="VALUE"><block type="math_number"><field name="NUM">${value}</field></block></value>`);
            else {
                write('<value name="VALUE">')
                pushBlocks();
                emit(value as ts.Expression);
                flushBlocks();
                write('</value>')
            }
            writeEndBlock()
        }

        function emitPropertyAccessExpression(n: ts.PropertyAccessExpression, shadow = false): void {
            let callInfo = (n as any).callInfo as pxtc.CallInfo;
            if (!callInfo) {
                error(n);
                return;
            }
            let value = callInfo.attrs.blockId || callInfo.qName
            if (callInfo.attrs.blockIdentity) {
                let idfn = blocksInfo.apis.byQName[callInfo.attrs.blockIdentity];
                let tag = shadow ? "shadow" : "block";
                let f = /%([a-zA-Z0-9_]+)/.exec(idfn.attributes.block);
                write(`<${tag} type="${idfn.attributes.blockId}"><field name="${f[1]}">${value}</field></${tag}>`)
            }
            else output += value;
        }

        function emitArrowFunction(n: ts.ArrowFunction) {
            if (n.parameters.length > 0) {
                error(n);
                return;
            }
            emit(n.body)
        }

        function emitTopStatements(stmts: ts.Statement[]) {
            const outputStatements: ts.Statement[] = [];

            // Emit statements in one chunk, but filter out output expressions
            pushBlocks();
            for (const stmt of stmts) {
                if (stmt.kind == ts.SyntaxKind.ExpressionStatement && isOutputExpression((stmt as ts.ExpressionStatement).expression)) {
                    outputStatements.push(stmt)
                }
                else {
                    emit(stmt)
                }
            }
            flushBlocks();

            // Now emit output expressions as standalone blocks
            for (const stmt of outputStatements) {
                pushBlocks();
                emit(stmt);
                flushBlocks();
            }
        }

        function emitStatements(stmts: ts.Statement[]) {
            pushBlocks();
            stmts.forEach(statement => emit(statement));
            flushBlocks();
        }

        function isOutputExpression(expr: ts.Expression): boolean {
            switch (expr.kind) {
                case ts.SyntaxKind.BinaryExpression:
                    return !/[=<>]/.test((expr as ts.BinaryExpression).operatorToken.getText());
                case ts.SyntaxKind.PrefixUnaryExpression: {
                    let op = (expr as ts.PrefixUnaryExpression).operator;
                    return op != ts.SyntaxKind.PlusPlusToken && op != ts.SyntaxKind.MinusMinusToken;
                }
                case ts.SyntaxKind.PostfixUnaryExpression: {
                    let op = (expr as ts.PostfixUnaryExpression).operator;
                    return op != ts.SyntaxKind.PlusPlusToken && op != ts.SyntaxKind.MinusMinusToken;
                }
                default: return false;
            }
        }

        function emitBlock(n: ts.Block) {
            emitStatements(n.statements);
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

        function emitIfStatement(n: ts.IfStatement) {
            let flatif = flattenIfStatement(n);
            writeBeginBlock("controls_if");
            write(`<mutation elseif="${flatif.ifStatements.length - 1}" else="${flatif.elseStatement ? 1 : 0}"></mutation>`)
            flatif.ifStatements.forEach((stmt, i) => {
                write(`<value name="IF${i}">`)
                pushBlocks();
                emit(stmt.expression)
                flushBlocks();
                write('</value>')
                write(`<statement name="DO${i}">`)
                pushBlocks();
                emit(stmt.thenStatement)
                flushBlocks();
                write('</statement>')
            })
            if (flatif.elseStatement) {
                write('<statement name="ELSE">')
                pushBlocks();
                emit(flatif.elseStatement)
                flushBlocks();
                write('</statement>')
            }
            writeEndBlock();
        }

        function emitWhileStatement(n: ts.WhileStatement): void {
            writeBeginBlock("device_while");
            write('<value name="COND">')
            pushBlocks();
            emit(n.expression)
            flushBlocks();
            write('</value>')
            write('<statement name="DO">')
            pushBlocks();
            emit(n.statement)
            flushBlocks();
            write('</statement>')
            writeEndBlock()
        }

        function emitStringLiteral(n: ts.StringLiteral) {
            write(`<block type="text"><field name="TEXT">${U.htmlEscape(n.text)}</field></block>`)
        }

        function emitNumberExpression(n: ts.LiteralExpression) {
            write(`<block type="math_number"><field name="NUM">${U.htmlEscape(n.text)}</field></block>`)
        }

        function emitBooleanExpression(n: ts.LiteralExpression) {
            write(`<block type="logic_boolean"><field name="BOOL">${U.htmlEscape(n.kind == ts.SyntaxKind.TrueKeyword ? 'TRUE' : 'FALSE')}</field></block>`)
        }

        function emitCallImageLiteralExpression(node: ts.CallExpression, info: pxtc.CallInfo) {
            let arg = node.arguments[0];
            if (arg.kind != ts.SyntaxKind.StringLiteral && arg.kind != ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
                error(node)
                return;
            }
            writeBeginBlock(info.attrs.blockId);
            let leds = ((arg as ts.StringLiteral).text || '').replace(/\s/g, '');
            let nc = info.attrs.imageLiteral * 5;
            for (let r = 0; r < 5; ++r) {
                for (let c = 0; c < nc; ++c) {
                    write(`<field name="LED${c}${r}">${/[#*1]/.test(leds[r * nc + c]) ? "TRUE" : "FALSE"}</field>`)
                }
            }
            writeEndBlock();
        }

        function emitCallExpression(node: ts.CallExpression) {
            let extraArgs = '';
            let info: pxtc.CallInfo = (node as any).callInfo
            if (!info) {
                error(node);
                return;
            }
            if (!info.attrs.blockId || !info.attrs.block) {
                let builtin = builtinBlocks[info.qName];
                if (!builtin) {
                    error(node)
                    return;
                }
                info.attrs.block = builtin.block;
                info.attrs.blockId = builtin.blockId;
                if (builtin.fields) extraArgs += builtin.fields;
            }

            if (info.attrs.imageLiteral) {
                emitCallImageLiteralExpression(node, info);
                return;
            }

            let argNames: string[] = []
            info.attrs.block.replace(/%(\w+)/g, (f, n) => {
                argNames.push(n)
                return ""
            })

            writeBeginBlock(info.attrs.blockId);
            if (extraArgs) write(extraArgs);
            info.args.forEach((e, i) => {
                switch (e.kind) {
                    case SK.ArrowFunction:
                        write('<statement name="HANDLER">');
                        pushBlocks();
                        emit(e);
                        flushBlocks();
                        write('</statement>');
                        break;
                    case SK.PropertyAccessExpression:
                        let forv = "field";
                        let callInfo = (e as any).callInfo as pxtc.CallInfo;
                        let shadow = callInfo && !!callInfo.attrs.blockIdentity
                        if (shadow)
                            forv = "value";

                        output += `<${forv} name="${argNames[i]}">`;
                        pushBlocks();
                        emitPropertyAccessExpression(e as PropertyAccessExpression, shadow);
                        flushBlocks();
                        output += `</${forv}>`;
                        break;
                    default:
                        write(`<value name="${argNames[i]}">`)
                        pushBlocks();
                        if (info.qName == "Math.random") {
                            emitMathRandomArgumentExpresion(e);
                        }
                        else {
                            emit(e);
                        }
                        flushBlocks();
                        write(`</value>`)
                        break;
                }
            })
            writeEndBlock()
        }

        function emitMathRandomArgumentExpresion(e: ts.Expression) {
            switch (e.kind) {
                case SK.NumericLiteral:
                    let n = e as LiteralExpression;
                    n.text = (parseInt(n.text) - 1).toString();
                    emitNumberExpression(n);
                    break;
                case SK.BinaryExpression:
                    let op = e as BinaryExpression;
                    if (op.operatorToken.kind == SK.PlusToken && (op.right as any).text == "1") {
                        emit(op.left);
                        //Note: break is intentionally in the if statement as we don't want to handle any other kinds of operations
                        //other than the +1 created by the block compilation because otherwise roundtripping won't work anyway
                        break;
                    }
                default:
                    //This will definitely lead to an error, but the above are the only two cases generated by blocks
                    emit(e);
                    break;
            }
        }
    }
}