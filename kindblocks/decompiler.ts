namespace ks.blocks {
    let SK = ts.SyntaxKind;

    export function toBlocks(stmts: ts.Statement[]): string {
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
                default:
                    console.warn("Unhandled emit:", ts.ks.stringKind(n))
            }
        }
        
        function emitBlock(n : ts.Block) {
            n.statements.forEach(statement => emit(statement));
        }
        
        function flattenIfStatement(n : ts.IfStatement) : {
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
        
        function emitIfStatement(n : ts.IfStatement) {
            let flatif = flattenIfStatement(n);
            write('<block type="controls_if">')
            write(`<mutation elseif="${flatif.ifStatements.length - 1}" else="${flatif.elseStatement ? 1 : 0}"></mutation>`)
            flatif.ifStatements.forEach((stmt, i) => {
                write(`<value name="IF${i}">` )
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
        
        function emitWhileStatement(n : ts.WhileStatement) : void {
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
            let argNames: string[] = []
            info.attrs.block.replace(/%(\w+)/g, (f, n) => {
                argNames.push(n)
                return ""
            })

            write(`<block type="${info.attrs.blockId}">`)
            info.args.forEach((e, i) => {
                write(`  <value name="${argNames[i]}">`)
                emit(e)
                write(`  </value>`)
            })
            write(`</block>`)
        }
    }
}