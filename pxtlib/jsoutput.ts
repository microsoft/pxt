namespace pxt.blocks {
    export enum NT {
        Prefix, // op + map(children)
        Infix, // children.length == 2, child[0] op child[1]
        Block, // { } are implicit
        NewLine
    }

    export interface JsNode {
        type: NT;
        children: JsNode[];
        op: string;
        id?: string;
        glueToBlock?: GlueMode;
        canIndentInside?: boolean;
        noFinalNewline?: boolean;
    }

    export enum GlueMode {
        None = 0,
        WithSpace = 1,
        NoSpace = 2
    }


    const reservedWords = ["break", "case", "catch", "class", "const", "continue", "debugger",
        "default", "delete", "do", "else", "enum", "export", "extends", "false", "finally",
        "for", "function", "if", "import", "in", "instanceof", "new", "null", "return",
        "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while",
        "with"];

    let placeholders: Map<Map<any>> = {};

    export function backtickLit(s: string) {
        return "`" + s.replace(/[\\`${}]/g, f => "\\" + f) + "`"
    }

    export function stringLit(s: string) {
        if (s.length > 20 && /\n/.test(s))
            return backtickLit(s)
        else return JSON.stringify(s)
    }

    export function mkNode(tp: NT, pref: string, children: JsNode[]): JsNode {
        return {
            type: tp,
            op: pref,
            children: children
        }
    }

    export function mkNewLine() {
        return mkNode(NT.NewLine, "", [])
    }

    export function mkPrefix(pref: string, children: JsNode[]) {
        return mkNode(NT.Prefix, pref, children)
    }

    export function mkInfix(child0: JsNode, op: string, child1: JsNode) {
        return mkNode(NT.Infix, op, child0 == null ? [child1] : [child0, child1])
    }

    export function mkText(s: string) {
        return mkPrefix(s, [])
    }
    export function mkBlock(nodes: JsNode[]) {
        return mkNode(NT.Block, "", nodes)
    }

    export function mkGroup(nodes: JsNode[]) {
        return mkPrefix("", nodes)
    }

    export function mkStmt(...nodes: JsNode[]) {
        let last = nodes[nodes.length - 1]
        if (last && last.type == NT.Block) {
            // OK - no newline needed
        } else {
            nodes.push(mkNewLine())
        }
        return mkGroup(nodes)
    }

    export function mkCommaSep(nodes: JsNode[], withNewlines = false) {
        const r: JsNode[] = []
        for (const n of nodes) {
            if (withNewlines) {
                if (r.length > 0) r.push(mkText(","));
                r.push(mkNewLine());
            } else if (r.length > 0) {
                r.push(mkText(", "))
            }
            r.push(n)
        }
        if (withNewlines) r.push(mkNewLine());
        return mkGroup(r)
    }

    // A series of utility functions for constructing various J* AST nodes.
    export namespace Helpers {

        export function mkArrayLiteral(args: JsNode[]) {
            return mkGroup([
                mkText("["),
                mkCommaSep(args, false),
                mkText("]")
            ])
        }

        export function mkNumberLiteral(x: number) {
            return mkText(x.toString())
        }

        export function mkBooleanLiteral(x: boolean) {
            return mkText(x ? "true" : "false")
        }

        export function mkStringLiteral(x: string) {
            return mkText(stringLit(x))
        }

        export function mkPropertyAccess(name: string, thisArg: JsNode) {
            return mkGroup([
                mkInfix(thisArg, ".", mkText(name)),
            ])
        }

        export function mkCall(name: string, args: JsNode[], externalInputs = false, method = false) {
            if (method)
                return mkGroup([
                    mkInfix(args[0], ".", mkText(name)),
                    mkText("("),
                    mkCommaSep(args.slice(1), externalInputs),
                    mkText(")")
                ])
            else
                return mkGroup([
                    mkText(name),
                    mkText("("),
                    mkCommaSep(args, externalInputs),
                    mkText(")")
                ])

        }

        // Call function [name] from the standard device library with arguments
        // [args].
        export function stdCall(name: string, args: JsNode[], externalInputs: boolean) {
            return mkCall(name, args, externalInputs);
        }

        // Call extension method [name] on the first argument
        export function extensionCall(name: string, args: JsNode[], externalInputs: boolean) {
            return mkCall(name, args, externalInputs, true);
        }

        // Call function [name] from the specified [namespace] in the micro:bit
        // library.
        export function namespaceCall(namespace: string, name: string, args: JsNode[], externalInputs: boolean) {
            return mkCall(namespace + "." + name, args, externalInputs);
        }

        export function mathCall(name: string, args: JsNode[]) {
            return namespaceCall("Math", name, args, false)
        }

        export function mkGlobalRef(name: string) {
            return mkText(name)
        }

        export function mkSimpleCall(p: string, args: JsNode[]): JsNode {
            U.assert(args.length == 2);
            return mkInfix(args[0], p, args[1])
        }

        export function mkWhile(condition: JsNode, body: JsNode[]): JsNode {
            return mkGroup([
                mkText("while ("),
                condition,
                mkText(")"),
                mkBlock(body)
            ])
        }

        export function mkComment(text: string) {
            return mkText("// " + text)
        }

        export function mkMultiComment(text: string) {
            let group = [
                mkText("/**"),
                mkNewLine()
            ];
            text.split("\n").forEach((c, i, arr) => {
                if (c) {
                    group.push(mkText(" * " + c));
                    group.push(mkNewLine());
                    // Add an extra line so we can convert it back to new lines
                    if (i < arr.length - 1) {
                        group.push(mkText(" * "));
                        group.push(mkNewLine());
                    }
                }
            });
            return mkGroup(group.concat([
                mkText(" */"),
                mkNewLine()
            ]));
        }

        export function mkAssign(x: JsNode, e: JsNode): JsNode {
            return mkSimpleCall("=", [x, e])
        }

        export function mkParenthesizedExpression(expression: JsNode): JsNode {
            return mkGroup([
                mkText("("),
                expression,
                mkText(")")
            ])
        }
    }

    export import H = Helpers;

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
    const infixPriTable: Map<number> = {
        // 0 = comma/sequence
        // 1 = spread (...)
        // 2 = yield, yield*
        // 3 = assignment
        "=": 3,
        "+=": 3,
        "-=": 3,
        "?": 4,
        ":": 4,
        "||": 5,
        "&&": 6,
        "|": 7,
        "^": 8,
        "&": 9,
        // 10 = equality
        "==": 10,
        "!=": 10,
        "===": 10,
        "!==": 10,
        // 11 = comparison (excludes in, instanceof)
        "<": 11,
        ">": 11,
        "<=": 11,
        ">=": 11,
        // 12 = bitwise shift
        ">>": 12,
        ">>>": 12,
        "<<": 12,
        "+": 13,
        "-": 13,
        "*": 14,
        "/": 14,
        "%": 14,
        "**": 15,
        "!": 16,
        "~": 16,
        "P-": 16,
        "P+": 16,
        "++": 16,
        "--": 16,
        ".": 18,
    }

    export interface SourceInterval {
        id: string;
        start: number;
        end: number;
    }

    export function flattenNode(app: JsNode[]) {
        let sourceMap: SourceInterval[] = [];
        let sourceMapById: pxt.Map<SourceInterval> = {};
        let output = ""
        let indent = ""
        let variables: Map<string>[] = [{}];

        function flatten(e0: JsNode) {
            function rec(e: JsNode, outPrio: number) {
                if (e.type != NT.Infix) {
                    for (let c of e.children)
                        rec(c, -1)
                    return
                }

                let r: JsNode[] = []

                function pushOp(c: string) {
                    if (c[0] == "P") c = c.slice(1)
                    r.push(mkText(c))
                }

                let infixPri = U.lookup(infixPriTable, e.op)
                if (infixPri == null) U.oops("bad infix op: " + e.op)

                if (infixPri < outPrio) pushOp("(");
                if (e.children.length == 1) {
                    pushOp(e.op)
                    rec(e.children[0], infixPri)
                    r.push(e.children[0])
                } else {
                    let bindLeft = infixPri != 3 && e.op != "**"
                    let letType: string = undefined;
                    rec(e.children[0], bindLeft ? infixPri : infixPri + 0.1)
                    r.push(e.children[0])
                    if (letType && letType != "number") {
                        pushOp(": ")
                        pushOp(letType)
                    }
                    if (e.op == ".")
                        pushOp(".")
                    else
                        pushOp(" " + e.op + " ")
                    rec(e.children[1], !bindLeft ? infixPri : infixPri + 0.1)
                    r.push(e.children[1])
                }
                if (infixPri < outPrio) pushOp(")");

                e.type = NT.Prefix
                e.op = ""
                e.children = r
            }

            rec(e0, -1)
        }

        let root = mkGroup(app)
        flatten(root)
        emit(root)

        // never return empty string - TS compiler service thinks it's an error
        if (!output)
            output += "\n"

        return { output, sourceMap }

        function emit(n: JsNode) {
            if (n.glueToBlock) {
                removeLastIndent()
                if (n.glueToBlock == GlueMode.WithSpace) {
                    output += " "
                }
            }

            let start = getCurrentLine();

            switch (n.type) {
                case NT.Infix:
                    U.oops("no infix should be left")
                    break
                case NT.NewLine:
                    output += "\n" + indent
                    break
                case NT.Block:
                    block(n)
                    break
                case NT.Prefix:
                    if (n.canIndentInside)
                        output += n.op.replace(/\n/g, "\n" + indent + "    ")
                    else
                        output += n.op
                    n.children.forEach(emit)
                    break
                default:
                    break
            }

            let end = getCurrentLine();

            if (n.id) {
                if (sourceMapById[n.id]) {
                    const node = sourceMapById[n.id];
                    node.start = Math.min(node.start, start);
                    node.end = Math.max(node.end, end);
                }
                else {
                    const interval = { id: n.id, start: start, end: end }
                    sourceMapById[n.id] = interval;
                    sourceMap.push(interval)
                }
            }
        }

        function getCurrentLine() {
            let i = 0;
            output.replace(/\n/g, a => { i++; return a; })
            return i;
        }

        function write(s: string) {
            output += s.replace(/\n/g, "\n" + indent)
        }

        function removeLastIndent() {
            output = output.replace(/\n *$/, "")
        }

        function block(n: JsNode) {
            let finalNl = n.noFinalNewline ? "" : "\n";
            if (n.children.length == 0) {
                write(" {\n\t\n}" + finalNl)
                return
            }

            let vars = U.clone<Map<string>>(variables[variables.length - 1] || {});
            variables.push(vars);
            indent += "    "
            if (output[output.length - 1] != " ")
                write(" ")
            write("{\n")
            for (let nn of n.children)
                emit(nn)
            indent = indent.slice(4)
            removeLastIndent()
            write("\n}" + finalNl)
            variables.pop();
        }
    }

    export function isReservedWord(str: string) {
        return reservedWords.indexOf(str) !== -1;
    }
}