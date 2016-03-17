namespace ks.blocks {
    let SK = ts.SyntaxKind;

    export function toBlocks(stmts: ts.Statement[]) {
        let output = ""

        stmts.forEach(emit)

        return output
        
        function write(s:string) {
            output += s + "\n"
        }

        function emit(n: ts.Node) {
            switch (n.kind) {
                case SK.ExpressionStatement:
                    emit((n as ts.ExpressionStatement).expression)
                    break;
                case SK.CallExpression:
                    emitCallExpression(n as ts.CallExpression)
                    break;
                case SK.StringLiteral:
                    emitStringLiteral(n as ts.StringLiteral)
                    break;                    
                default:
                    console.warn("Unhandled emit:", ts.ks.stringKind(n))
            }
        }
        
        function emitStringLiteral(n:ts.StringLiteral) {
            write(`<block type="text"><field name="TEXT">${U.htmlEscape(n.text)}</field></block>`)
        }

        function emitCallExpression(node: ts.CallExpression) {
            let info: ts.ks.CallInfo = (node as any).callInfo
            let argNames:string[] = []
            info.attrs.block.replace(/%(\w+)/g, (f,n) => {
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