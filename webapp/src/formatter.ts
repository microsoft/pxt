export enum TokenKind {
    None,
    Whitespace,
    Identifier,
    Keyword,
    Operator,
    CommentLine,
    CommentBlock,
    NewLine,
    Literal,
    EOF
}

export interface Token {
    kind: TokenKind;
    text: string;
    pos: number;
    synKind: ts.SyntaxKind;
}

function lookupKind(k: ts.SyntaxKind) {
    for (let o of Object.keys(ts.SyntaxKind)) {
        if ((<any>ts).SyntaxKind[o] === k)
            return o;
    }
    return "?"
}

let SK = ts.SyntaxKind;

function getTokKind(kind: ts.SyntaxKind) {
    switch (kind) {
        case SK.EndOfFileToken:
            return TokenKind.EOF;

        case SK.SingleLineCommentTrivia:
            return TokenKind.CommentLine;
        case SK.MultiLineCommentTrivia:
            return TokenKind.CommentBlock;
        case SK.NewLineTrivia:
            return TokenKind.NewLine;
        case SK.WhitespaceTrivia:
            return TokenKind.Whitespace;
        case SK.ShebangTrivia:
        case SK.ConflictMarkerTrivia:
            return TokenKind.CommentBlock;

        case SK.NumericLiteral:
        case SK.StringLiteral:
        case SK.RegularExpressionLiteral:
        case SK.NoSubstitutionTemplateLiteral:
        case SK.TemplateHead:
        case SK.TemplateMiddle:
        case SK.TemplateTail:
            return TokenKind.Literal;

        case SK.Identifier:
            return TokenKind.Identifier;

        default:
            if (kind < SK.Identifier)
                return TokenKind.Operator;

            return TokenKind.Keyword;
    }

}

export function tokenize(input: string) {
    let scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, input, msg => {
        console.log("scanner error", msg.message)
    })

    let tokens: Token[] = []
    let braceBalance = 0
    while (true) {
        let kind = scanner.scan()

        let tok: Token = {
            kind: getTokKind(kind),
            synKind: kind,
            pos: scanner.getTokenPos(),
            text: scanner.getTokenText(),
        }

        if (kind == SK.OpenBraceToken)
            braceBalance++;

        if (kind == SK.CloseBraceToken) {
            if (--braceBalance < 0)
                braceBalance = -100000;
        }

        tokens.push(tok)

        if (tok.kind == TokenKind.EOF)
            break;
    }

    // Util.assert(tokens.map(t => t.text).join("") == input)

    return { tokens, braceBalance }
}

export function format(input: string): string {
    let r = tokenize(input)
    let tokens = r.tokens

    if (r.braceBalance != 0) return null

    let braceStack: {
        synKind: ts.SyntaxKind;
        lineNo: number;
        indent: string;
    }[] = []

    let output: Token[] = []
    let lineNo = 1;

    let braceTop = () => braceStack[braceStack.length - 1]

    braceStack.push({
        synKind: SK.EndOfFileToken,
        lineNo: -1,
        indent: ""
    })

    let pushClose = (synKind: ts.SyntaxKind) => {
        let prev = braceTop()
        let indent = prev.indent
        if (prev.lineNo != lineNo)
            indent += "    "
        braceStack.push({ synKind, lineNo, indent })
    }

    let printWhitespace = (ind: string) =>
        output.push({
            kind: TokenKind.Whitespace,
            text: ind,
            synKind: SK.WhitespaceTrivia,
            pos: - 1,
        })

    let atLineStart = true

    for (let i = 0; i < tokens.length; ++i) {
        let token = tokens[i]

        switch (token.kind) {
            case TokenKind.NewLine:
                lineNo++;
                atLineStart = true;
                break;
            case TokenKind.Whitespace:
                if (atLineStart)
                    continue; // skip white space at the beginning of line
                if (tokens[i + 1].kind == TokenKind.NewLine)
                    continue; // skip white space and the end of line                    
                break;
            case TokenKind.Operator:
                switch (token.synKind) {
                    case SK.OpenBraceToken:
                        pushClose(SK.CloseBraceToken);
                        break;
                    case SK.OpenParenToken:
                        pushClose(SK.CloseParenToken);
                        break;
                    case SK.OpenBracketToken:
                        pushClose(SK.CloseBracketToken);
                        break;
                    case SK.CloseBraceToken:
                    case SK.CloseParenToken:
                    case SK.CloseBracketToken:
                        while (true) {
                            let top = braceStack.pop()
                            if (top.synKind == token.synKind)
                                break;
                            // don't go past brace with other closing parens
                            if (top.synKind == SK.CloseBraceToken) {
                                braceStack.push(top);
                                break;
                            }
                        }
                        break;
                    default:
                        break;
                }
                break;
        }

        if (token.kind != TokenKind.NewLine && atLineStart) {
            atLineStart = false;
            printWhitespace(braceTop().indent);
        }

        output.push(token)
    }

    let res = output.map(t => t.text).join("")
    if (res == input)
        return null;
    return null;
}   
