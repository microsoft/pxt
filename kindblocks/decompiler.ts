namespace ks.blocks {
    let SK = ts.SyntaxKind;

    export function toBlocks(blocksInfo : ts.ks.BlocksInfo, stmts: ts.Statement[]): string {
        let output = ""

        stmts.forEach(emit)

        return `<xml xmlns="http://www.w3.org/1999/xhtml">
${output}</xml>`;

        function write(s: string) {
            output += s + "\n"
        }

        function emit(n: ts.Node) {
            switch (n.kind) {
                case SK.ExpressionStatement:
                    emit((n as ts.ExpressionStatement).expression); break;
                case SK.VariableStatement:
                    emitVariableStatement(n as ts.VariableStatement); break;
                case SK.Block:
                    emitBlock(n as ts.Block); break;
                case SK.CallExpression:
                    emitCallExpression(n as ts.CallExpression); break;
                case SK.StringLiteral:
                    emitStringLiteral(n as ts.StringLiteral); break;
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
                    console.warn("Unhandled emit:", ts.ks.stringKind(n))
            }
        }
        
        // TODO handle special for loops
        function emitForStatement(n : ts.ForStatement) {
            write('<block type="controls_simple_for">');
            let vd = n.initializer as ts.VariableDeclarationList;
            if (vd.declarations.length != 1) console.error('for loop with multiple variables not supported');
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
            write('</block>')
            /*
      <shadow type="math_number">
        <field name="NUM">4</field>
      </shadow>
      <block type="math_arithmetic">
        <field name="OP">MINUS</field>
        <value name="A">
          <shadow type="math_number">
            <field name="NUM">0</field>
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
      </block>
    </value>
  </block>            
  */
        }
        
        function emitVariableStatement(n : ts.VariableStatement) {
            n.declarationList.declarations.forEach(decl => {
                write('<block type="variables_set">')
                write(`<field name="VAR">${(decl.name as ts.Identifier).text}</field>`)
                write('<value name="VALUE">')
                emit(decl.initializer);
                write('</value>')
                write('</field>')
                write('</block')                
            })
        }
        
        function emitPropertyAccessExpression(n : ts.PropertyAccessExpression) : void {
            let callInfo = (n as any).callInfo as ts.ks.CallInfo;
            if (callInfo && callInfo.attrs.blockId) {
                write(callInfo.attrs.blockId);
                return;
            }
            console.error("unhandled property access");
        }

        function emitArrowFunction(n: ts.ArrowFunction) {
            if (n.parameters.length > 0) console.error('arguments not supported in lambdas')

            emit(n.body)
        }

        function emitBlock(n: ts.Block) {
            n.statements.forEach(statement => emit(statement));
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
            write('<block type="controls_if">')
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
        }

        function emitWhileStatement(n: ts.WhileStatement): void {
            write('<block type="device_while">');
            write('<value name="COND">')
            emit(n.expression)
            write('</value>')
            write('<statement name="DO">')
            emit(n.statement)
            write('</statement>')
            write('</block>')
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

        function emitCallExpression(node: ts.CallExpression) {
            let info: ts.ks.CallInfo = (node as any).callInfo
            console.log(info)

            if (!info.attrs.blockId || !info.attrs.block) {
                console.error(`trying to convert ${info.decl.name} which is not supported in blocks`)
                // TODO show error in editor
                return;
            }

            let argNames: string[] = []
            info.attrs.block.replace(/%(\w+)/g, (f, n) => {
                argNames.push(n)
                return ""
            })

            write(`<block type="${info.attrs.blockId}">`)
            info.args.forEach((e, i) => {
                switch (e.kind) {
                    case SK.ArrowFunction:
                        write('<statement name="HANDLER">');
                        emit(e);
                        write('</statement>');
                        break;
                    case SK.PropertyAccessExpression:
                        write(`<field name="${argNames[i]}">`);
                        emit(e);
                        write(`</field>`);
                        break;
                    default:
                        write(`<value name="${argNames[i]}">`)
                        emit(e);
                        write(`</value>`)
                        break;
                }
            })
            write(`</block>`)
        }
    }
}