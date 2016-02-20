namespace ts.mbit {
    
    enum TokenKind {
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

    interface Token {
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

    function infixOperatorPrecedence(kind: ts.SyntaxKind) {
        switch (kind) {
            case SK.CommaToken:
                return 2;

            case SK.EqualsToken:
            case SK.PlusEqualsToken:
            case SK.MinusEqualsToken:
            case SK.AsteriskEqualsToken:
            case SK.AsteriskAsteriskEqualsToken:
            case SK.SlashEqualsToken:
            case SK.PercentEqualsToken:
            case SK.LessThanLessThanEqualsToken:
            case SK.GreaterThanGreaterThanEqualsToken:
            case SK.GreaterThanGreaterThanGreaterThanEqualsToken:
            case SK.AmpersandEqualsToken:
            case SK.BarEqualsToken:
            case SK.CaretEqualsToken:
                return 5;

            case SK.QuestionToken:
            case SK.ColonToken:
                return 7; // ternary operator

            case SK.BarBarToken:
                return 10;
            case SK.AmpersandAmpersandToken:
                return 20;
            case SK.BarToken:
                return 30;
            case SK.CaretToken:
                return 40;
            case SK.AmpersandToken:
                return 50;
            case SK.EqualsEqualsToken:
            case SK.ExclamationEqualsToken:
            case SK.EqualsEqualsEqualsToken:
            case SK.ExclamationEqualsEqualsToken:
                return 60;
            case SK.LessThanToken:
            case SK.GreaterThanToken:
            case SK.LessThanEqualsToken:
            case SK.GreaterThanEqualsToken:
            case SK.InstanceOfKeyword:
            case SK.InKeyword:
            case SK.AsKeyword:
                return 70;
            case SK.LessThanLessThanToken:
            case SK.GreaterThanGreaterThanToken:
            case SK.GreaterThanGreaterThanGreaterThanToken:
                return 80;
            case SK.PlusToken:
            case SK.MinusToken:
                return 90;
            case SK.AsteriskToken:
            case SK.SlashToken:
            case SK.PercentToken:
                return 100;
            case SK.AsteriskAsteriskToken:
                return 101;
            case SK.DotToken:
                return 120;

            default:
                return 0;
        }
    }

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

    function tokenize(input: string) {
        let scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, input, msg => {
            let pos = scanner.getTextPos()            
            console.log("scanner error", pos, msg.message)
        })

        let tokens: Token[] = []
        let braceBalance = 0
        let templateLevel = -1;
        while (true) {
            let kind = scanner.scan()
            
            if (kind == SK.CloseBraceToken && braceBalance == templateLevel) {
                templateLevel = -1;
                kind = scanner.reScanTemplateToken()
            }
            
            if (kind == SK.SlashToken || kind == SK.SlashEqualsToken) {
                let tmp = scanner.reScanSlashToken()
                if (tmp == SK.RegularExpressionLiteral)
                    kind = tmp;
            }

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
                    braceBalance = -10000000;
            }

            tokens.push(tok)
            
            if (kind == SK.TemplateHead || kind == SK.TemplateMiddle) {
                templateLevel = braceBalance;
            }

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
        return res;
    }
}