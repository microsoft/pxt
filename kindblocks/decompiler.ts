/// <reference path="../built/kindlib.d.ts" />

namespace ks.blocks {
    let SK = ts.SyntaxKind;

    interface BlockSequence {
        top: number; current: number;
    }

    var ops: U.Map<{ type: string; op: string; }> = {
        "+": { type: "math_arithmetic", op: "ADD" },
        "-": { type: "math_arithmetic", op: "MINUS" },
        "/": { type: "math_arithmetic", op: "DIVIDE" },
        "*": { type: "math_arithmetic", op: "MULTIPLY" },
        "<": { type: "logic_compare", op: "LT" },
        "<=": { type: "logic_compare", op: "LTE" },
        ">": { type: "logic_compare", op: "GT" },
        ">=": { type: "logic_compare", op: "GTE" },
        "==": { type: "logic_compare", op: "EQ" },
        "!=": { type: "logic_compare", op: "NEQ" },
        "&&": { type: "logic_operation", op: "AND" },
        "||": { type: "logic_operation", op: "OR" },
    }

    export function decompileToBlocks(blocksInfo: ts.ks.BlocksInfo, file: ts.SourceFile): ts.ks.CompileResult {
        let stmts : ts.Statement[] = file.statements;
        let result: ts.ks.CompileResult = {
            outfiles: {}, diagnostics: undefined, success: true, times: {}, enums: {}
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
            console.error(`unsupported node ${ts.ks.stringKind(n)}`);
            if (!result.diagnostics) result.diagnostics = [];
            result.diagnostics.push({
                file: file,
                start: n.getFullStart(),
                length: n.getFullWidth(),
                messageText: lf(`Language feature cannot be converted in blocks.`) || msg,
                category: ts.DiagnosticCategory.Error,
                code: 1001
            })
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
                default:
                    error(n);
                    break;
            }
        }

        function emitBinaryExpression(n: ts.BinaryExpression): void {
            let op = n.operatorToken.getText();
            let npp = ops[op];
            if (!npp) return error(n);
            writeBeginBlock(npp.type)
            write(`<field name="OP">${npp.op}</field>`)
            write('<value name="A">')
            pushBlocks();
            emit(n.left);
            flushBlocks();
            write('</value>')
            write('<value name="B">')
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
            writeBeginBlock("controls_simple_for");
            let vd = n.initializer as ts.VariableDeclarationList;
            if (vd.declarations.length != 1) {
                error(n, lf("for loop with multiple variables not supported"));
            }
            let id = vd.declarations[0].name as ts.Identifier;
            write(`<field name="VAR">${Util.htmlEscape(id.text)}</field>`)
            write('<value name="TO">');
            let c = n.condition;
            if (c.kind == ts.SyntaxKind.BinaryExpression) {
                let bs = c as ts.BinaryExpression;
                if (bs.left.kind == ts.SyntaxKind.Identifier &&
                    (bs.left as ts.Identifier).text == id.text &&
                    bs.operatorToken.getText() == "<") {
                    write('<block type="math_number">')
                    if (bs.right.kind == ts.SyntaxKind.NumericLiteral)
                        write(`<field name="NUM">${parseInt((bs.right as ts.LiteralExpression).text) - 1}</field>`)
                    else {
                        write(`
      <block type="math_arithmetic">
        <field name="OP">MINUS</field>
        <value name="A">
          <shadow type="math_number">
            <field name="NUM">`)
                        emit(bs.right)
                        write(`</field>
          </shadow>
        </value>
        <value name="B">
          <shadow type="math_number">
            <field name="NUM">0</field>
          </shadow>
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
                writeBeginBlock("variables_set")
                write(`<field name="VAR">${(decl.name as ts.Identifier).text}</field>`)
                write('<value name="VALUE">')
                emit(decl.initializer);
                write('</value>')
                writeEndBlock()
            })
        }

        function emitPropertyAccessExpression(n: ts.PropertyAccessExpression): void {
            let callInfo = (n as any).callInfo as ts.ks.CallInfo;
            if (!callInfo) {
                error(n);
                return;
            }
            output += (callInfo.attrs.blockId || callInfo.qName);
        }

        function emitArrowFunction(n: ts.ArrowFunction) {
            if (n.parameters.length > 0) {
                error(n);
                return;
            }
            emit(n.body)
        }

        function emitTopStatements(stmts: ts.Statement[]) {
            // chunk statements
            let chunks: ts.Statement[][] = [[]];
            stmts.forEach(stmt => {
                if (isHat(stmt)) chunks.push([]);
                chunks[chunks.length - 1].push(stmt);
            })

            chunks.forEach(chunk => {
                pushBlocks();
                chunk.forEach(statement => emit(statement));
                flushBlocks();
            })
        }

        function emitStatements(stmts: ts.Statement[]) {
            pushBlocks();
            stmts.forEach(statement => emit(statement));
            flushBlocks();
        }

        function isHat(stmt: ts.Statement): boolean {
            let expr: ts.Expression;
            let call: ts.ks.CallInfo;
            return stmt.kind == ts.SyntaxKind.ExpressionStatement
                && !!(expr = (stmt as ts.ExpressionStatement).expression)
                && expr.kind == ts.SyntaxKind.CallExpression
                && !!(call = (expr as any).callInfo)
                && /^on /.test(call.attrs.block)
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
                emit(stmt.expression)
                write('</value>')
                write(`<statement name="DO${i}">`)
                emit(stmt.thenStatement)
                write('</statement>')
            })
            if (n.elseStatement) {
                write('<statement name="ELSE">')
                emit(flatif.elseStatement)
                write('</statement>')
            }
            writeEndBlock();
        }

        function emitWhileStatement(n: ts.WhileStatement): void {
            writeBeginBlock("device_while");
            write('<block type="device_while">');
            write('<value name="COND">')
            emit(n.expression)
            write('</value>')
            write('<statement name="DO">')
            emit(n.statement)
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

        function emitCallImageLiteralExpression(node: ts.CallExpression, info: ts.ks.CallInfo) {
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
            let info: ts.ks.CallInfo = (node as any).callInfo
            if (!info.attrs.blockId || !info.attrs.block) {
                error(node)
                return;
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
                        output += `<field name="${argNames[i]}">`;
                        pushBlocks();
                        emit(e);
                        flushBlocks();
                        output += `</field>`;
                        break;
                    default:
                        write(`<value name="${argNames[i]}">`)
                        pushBlocks();
                        emit(e);
                        flushBlocks();
                        write(`</value>`)
                        break;
                }
            })
            writeEndBlock()
        }
    }
}