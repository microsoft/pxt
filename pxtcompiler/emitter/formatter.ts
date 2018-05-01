namespace ts.pxtc {

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
        Tree,       // nested list of tokens; synKind stays what it was
        Block,      // Trees with synKind == OpenBraceToken get turned into Blocks
        EOF
    }

    let inputForMsg = ""

    interface Stmt {
        tokens: Token[];
    }

    interface Token {
        kind: TokenKind;
        text: string;
        pos: number;
        lineNo: number;
        synKind: ts.SyntaxKind;
        blockSpanLength?: number;
        blockSpanIsVirtual?: boolean;
        isPrefix?: boolean;
        isCursor?: boolean;
    }

    interface TreeToken extends Token {
        children: Token[];
        endToken: Token; // if it has proper ending token, this is the text of it
    }

    interface BlockToken extends Token {
        stmts: Stmt[]; // for Block
        endToken: Token; // if it has proper ending token, this is the text of it
    }

    function lookupKind(k: ts.SyntaxKind) {
        for (let o of Object.keys(ts.SyntaxKind)) {
            if ((<any>ts).SyntaxKind[o] === k)
                return o;
        }
        return "?"
    }

    let SK = ts.SyntaxKind;

    function showMsg(t: Token, msg: string) {
        let pos = t.pos
        let ctx = inputForMsg.slice(pos - 20, pos) + "<*>" + inputForMsg.slice(pos, pos + 20)
        console.log(ctx.replace(/\n/g, "<NL>"), ": L ", t.lineNo, msg)
    }

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

    let brokenRegExps = false;

    function tokenize(input: string) {
        inputForMsg = input
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

            if (brokenRegExps && kind == SK.SlashToken || kind == SK.SlashEqualsToken) {
                let tmp = scanner.reScanSlashToken()
                if (tmp == SK.RegularExpressionLiteral)
                    kind = tmp;
            }

            if (kind == SK.GreaterThanToken) {
                kind = scanner.reScanGreaterToken()
            }

            let tok: Token = {
                kind: getTokKind(kind),
                synKind: kind,
                lineNo: 0,
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

    function skipWhitespace(tokens: Token[], i: number) {
        while (tokens[i] && tokens[i].kind == TokenKind.Whitespace)
            i++;
        return i;
    }

    // We do not want empty lines in the source to get lost - they serve as a sort of comment dividing parts of code
    // We turn them into empty comments here
    function emptyLinesToComments(tokens: Token[], cursorPos: number) {
        let output: Token[] = []
        let atLineBeg = true
        let lineNo = 1;

        for (let i = 0; i < tokens.length; ++i) {
            if (atLineBeg) {
                let bkp = i
                i = skipWhitespace(tokens, i)
                if (tokens[i].kind == TokenKind.NewLine) {
                    let isCursor = false
                    if (cursorPos >= 0 && tokens[i].pos >= cursorPos) {
                        cursorPos = -1;
                        isCursor = true
                    }
                    output.push({
                        text: "",
                        kind: TokenKind.CommentLine,
                        pos: tokens[i].pos,
                        lineNo,
                        synKind: SK.SingleLineCommentTrivia,
                        isCursor: isCursor
                    })
                } else {
                    i = bkp
                }
            }

            output.push(tokens[i])

            tokens[i].lineNo = lineNo

            if (tokens[i].kind == TokenKind.NewLine) {
                atLineBeg = true
                lineNo++;
            } else {
                atLineBeg = false
            }

            if (cursorPos >= 0 && tokens[i].pos >= cursorPos) {
                cursorPos = -1;
            }
        }

        return output
    }

    // Add Tree tokens where needed
    function matchBraces(tokens: Token[]) {
        let braceStack: {
            synKind: ts.SyntaxKind;
            token: TreeToken;
        }[] = []

        let braceTop = () => braceStack[braceStack.length - 1]

        braceStack.push({
            synKind: SK.EndOfFileToken,
            token: {
                children: [],
            } as any,
        })

        let pushClose = (tok: Token, synKind: ts.SyntaxKind) => {
            let token = tok as TreeToken
            token.children = []
            token.kind = TokenKind.Tree
            braceStack.push({ synKind, token })
        }

        for (let i = 0; i < tokens.length; ++i) {
            let token = tokens[i]

            let top = braceStack[braceStack.length - 1]
            top.token.children.push(token)

            switch (token.kind) {
                case TokenKind.Operator:
                    switch (token.synKind) {
                        case SK.OpenBraceToken:
                        case SK.OpenParenToken:
                        case SK.OpenBracketToken:
                            pushClose(token, token.synKind + 1);
                            break;
                        case SK.CloseBraceToken:
                        case SK.CloseParenToken:
                        case SK.CloseBracketToken:
                            top.token.children.pop();
                            while (true) {
                                top = braceStack.pop()
                                if (top.synKind == token.synKind) {
                                    top.token.endToken = token;
                                    break;
                                }
                                // don't go past brace with other closing parens
                                if (braceStack.length == 0 || top.synKind == SK.CloseBraceToken) {
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
        }

        return braceStack[0].token.children
    }

    function mkEOF(): Token {
        return {
            kind: TokenKind.EOF,
            synKind: SK.EndOfFileToken,
            pos: 0,
            lineNo: 0,
            text: ""
        }
    }

    function mkSpace(t: Token, s: string): Token {
        return {
            kind: TokenKind.Whitespace,
            synKind: SK.WhitespaceTrivia,
            pos: t.pos - s.length,
            lineNo: t.lineNo,
            text: s
        }
    }

    function mkNewLine(t: Token): Token {
        return {
            kind: TokenKind.NewLine,
            synKind: SK.NewLineTrivia,
            pos: t.pos,
            lineNo: t.lineNo,
            text: "\n"
        }
    }

    function mkBlock(toks: Token[]): BlockToken {
        return {
            kind: TokenKind.Block,
            synKind: SK.OpenBraceToken,
            pos: toks[0].pos,
            lineNo: toks[0].lineNo,
            stmts: [{ tokens: toks }],
            text: "{",
            endToken: null
        }
    }

    function mkVirtualTree(toks: Token[]): TreeToken {
        return {
            kind: TokenKind.Tree,
            synKind: SK.WhitespaceTrivia,
            pos: toks[0].pos,
            lineNo: toks[0].lineNo,
            children: toks,
            endToken: null,
            text: ""
        }
    }

    function isExprEnd(t: Token) {
        if (!t) return false;

        switch (t.synKind) {
            case SK.IfKeyword:
            case SK.ElseKeyword:
            case SK.LetKeyword:
            case SK.ConstKeyword:
            case SK.VarKeyword:
            case SK.DoKeyword:
            case SK.WhileKeyword:
            case SK.SwitchKeyword:
            case SK.CaseKeyword:
            case SK.DefaultKeyword:
            case SK.ForKeyword:
            case SK.ReturnKeyword:
            case SK.BreakKeyword:
            case SK.ContinueKeyword:
            case SK.TryKeyword:
            case SK.CatchKeyword:
            case SK.FinallyKeyword:
            case SK.DeleteKeyword:
            case SK.FunctionKeyword:
            case SK.ClassKeyword:
            case SK.YieldKeyword:
            case SK.DebuggerKeyword:
                return true;
            default:
                return false;
        }
    }

    function delimitStmts(tokens: Token[], inStmtCtx: boolean, ctxToken: Token = null): Stmt[] {
        let res: Stmt[] = []
        let i = 0;
        let currCtxToken: Token;
        let didBlock = false;

        tokens = tokens.concat([mkEOF()])

        while (tokens[i].kind != TokenKind.EOF) {
            let stmtBeg = i
            skipToStmtEnd();
            Util.assert(i > stmtBeg, `Error at ${tokens[i].text}`)
            addStatement(tokens.slice(stmtBeg, i))
        }

        return res

        function addStatement(tokens: Token[]) {
            if (inStmtCtx)
                tokens = trimWhitespace(tokens)
            if (tokens.length == 0) return
            tokens.forEach(delimitIn)
            tokens = injectBlocks(tokens)

            let merge = false
            if (inStmtCtx && res.length > 0) {
                let prev = res[res.length - 1]
                let prevKind = prev.tokens[0].synKind
                let thisKind = tokens[0].synKind
                if ((prevKind == SK.IfKeyword && thisKind == SK.ElseKeyword) ||
                    (prevKind == SK.TryKeyword && thisKind == SK.CatchKeyword) ||
                    (prevKind == SK.TryKeyword && thisKind == SK.FinallyKeyword) ||
                    (prevKind == SK.CatchKeyword && thisKind == SK.FinallyKeyword)
                ) {
                    tokens.unshift(mkSpace(tokens[0], " "))
                    Util.pushRange(res[res.length - 1].tokens, tokens)
                    return;
                }
            }

            res.push({
                tokens: tokens
            })
        }

        function injectBlocks(tokens: Token[]) {
            let output: Token[] = []
            let i = 0;
            while (i < tokens.length) {
                if (tokens[i].blockSpanLength) {
                    let inner = tokens.slice(i, i + tokens[i].blockSpanLength)
                    let isVirtual = !!inner[0].blockSpanIsVirtual
                    delete inner[0].blockSpanLength
                    delete inner[0].blockSpanIsVirtual
                    i += inner.length
                    inner = injectBlocks(inner)
                    if (isVirtual) {
                        output.push(mkVirtualTree(inner))
                    } else {
                        output.push(mkSpace(inner[0], " "))
                        output.push(mkBlock(trimWhitespace(inner)))
                    }
                } else {
                    output.push(tokens[i++])
                }
            }
            return output
        }

        function delimitIn(t: Token) {
            if (t.kind == TokenKind.Tree) {
                let tree = t as TreeToken
                tree.children = Util.concat(delimitStmts(tree.children, false, tree).map(s => s.tokens))
            }
        }

        function nextNonWs(stopOnNewLine = false) {
            while (true) {
                i++;
                switch (tokens[i].kind) {
                    case TokenKind.Whitespace:
                    case TokenKind.CommentBlock:
                    case TokenKind.CommentLine:
                        break;
                    case TokenKind.NewLine:
                        if (stopOnNewLine) break;
                        break;
                    default:
                        return;
                }
            }
        }

        function skipOptionalNewLine() {
            while (tokens[i].kind == TokenKind.Whitespace) { i++; }
            if (tokens[i].kind == TokenKind.NewLine) i++;
        }

        function skipUntilBlock() {
            while (true) {
                i++;
                switch (tokens[i].kind) {
                    case TokenKind.EOF:
                        return;
                    case TokenKind.Tree:
                        if (tokens[i].synKind == SK.OpenBraceToken) {
                            i--;
                            expectBlock();
                            return;
                        }
                        break;
                }
            }
        }

        function handleBlock() {
            Util.assert(tokens[i].synKind == SK.OpenBraceToken)
            let tree = tokens[i] as TreeToken
            Util.assert(tree.kind == TokenKind.Tree)
            let blk = tokens[i] as BlockToken
            blk.stmts = delimitStmts(tree.children, true, currCtxToken)
            delete tree.children
            blk.kind = TokenKind.Block
            i++;
            didBlock = true
        }

        function expectBlock() {
            let begIdx = i + 1
            nextNonWs()
            if (tokens[i].synKind == SK.OpenBraceToken) {
                handleBlock()
                skipOptionalNewLine();
            } else {
                skipToStmtEnd();
                tokens[begIdx].blockSpanLength = i - begIdx
            }
        }

        function skipToStmtEnd() {
            while (true) {
                let t = tokens[i]
                let bkp = i

                currCtxToken = t
                didBlock = false

                if (t.kind == TokenKind.EOF)
                    return;

                if (inStmtCtx && t.synKind == SK.SemicolonToken) {
                    i++;
                    skipOptionalNewLine();
                    return;
                }

                if (t.synKind == SK.EqualsGreaterThanToken) {
                    nextNonWs()
                    if (tokens[i].synKind == SK.OpenBraceToken) {
                        handleBlock();
                        continue;
                    } else {
                        let begIdx = i
                        skipToStmtEnd()
                        let j = i
                        while (tokens[j].kind == TokenKind.NewLine)
                            j--;
                        tokens[begIdx].blockSpanLength = j - begIdx
                        tokens[begIdx].blockSpanIsVirtual = true
                        return
                    }
                }

                if (inStmtCtx && infixOperatorPrecedence(t.synKind)) {
                    let begIdx = i
                    // an infix operator at the end of the line prevents the newline from ending the statement
                    nextNonWs()
                    if (isExprEnd(tokens[i])) {
                        // unless next line starts with something statement-like
                        i = begIdx
                    } else {
                        continue;
                    }
                }

                if (inStmtCtx && t.kind == TokenKind.NewLine) {
                    nextNonWs();
                    t = tokens[i]
                    // if we get a infix operator other than +/- after newline, it's a continuation
                    if (infixOperatorPrecedence(t.synKind) && t.synKind != SK.PlusToken && t.synKind != SK.MinusToken) {
                        continue;
                    } else {
                        i = bkp + 1
                        return;
                    }
                }

                if (t.synKind == SK.OpenBraceToken && ctxToken && ctxToken.synKind == SK.ClassKeyword) {
                    let jj = i - 1;
                    while (jj >= 0 && tokens[jj].kind == TokenKind.Whitespace)
                        jj--;
                    if (jj < 0 || tokens[jj].synKind != SK.EqualsToken) {
                        i--;
                        expectBlock(); // method body
                        return;
                    }
                }

                Util.assert(bkp == i)

                switch (t.synKind) {
                    case SK.ForKeyword:
                    case SK.WhileKeyword:
                    case SK.IfKeyword:
                    case SK.CatchKeyword:
                        nextNonWs();
                        if (tokens[i].synKind == SK.OpenParenToken) {
                            expectBlock();
                        } else {
                            continue; // just continue until new line
                        }
                        return;

                    case SK.DoKeyword:
                        expectBlock();
                        i--;
                        nextNonWs();
                        if (tokens[i].synKind == SK.WhileKeyword) {
                            i++;
                            continue;
                        } else {
                            return;
                        }

                    case SK.ElseKeyword:
                        nextNonWs();
                        if (tokens[i].synKind == SK.IfKeyword) {
                            continue; // 'else if' - keep scanning
                        } else {
                            i = bkp;
                            expectBlock();
                            return;
                        }

                    case SK.TryKeyword:
                    case SK.FinallyKeyword:
                        expectBlock();
                        return;

                    case SK.ClassKeyword:
                    case SK.NamespaceKeyword:
                    case SK.ModuleKeyword:
                    case SK.InterfaceKeyword:
                    case SK.FunctionKeyword:
                        skipUntilBlock();
                        return;
                }

                Util.assert(!didBlock, "forgot continue/return after expectBlock")
                i++;
            }
        }
    }

    function isWhitespaceOrNewLine(tok: Token) {
        return tok && (tok.kind == TokenKind.Whitespace || tok.kind == TokenKind.NewLine)
    }

    function removeIndent(tokens: Token[]) {
        let output: Token[] = []
        let atLineBeg = false;
        for (let i = 0; i < tokens.length; ++i) {
            if (atLineBeg)
                i = skipWhitespace(tokens, i)
            if (tokens[i]) {
                output.push(tokens[i])
                atLineBeg = tokens[i].kind == TokenKind.NewLine
            }
        }
        return output
    }

    function trimWhitespace(toks: Token[]) {
        toks = toks.slice(0)
        while (isWhitespaceOrNewLine(toks[0]))
            toks.shift()
        while (isWhitespaceOrNewLine(toks[toks.length - 1]))
            toks.pop()
        return toks
    }

    function normalizeSpace(tokens: Token[]) {
        let output: Token[] = []
        let i = 0
        let lastNonTrivialToken = mkEOF()

        tokens = tokens.concat([mkEOF()])
        while (i < tokens.length) {
            i = skipWhitespace(tokens, i)

            let token = tokens[i]
            if (token.kind == TokenKind.EOF)
                break;

            let j = skipWhitespace(tokens, i + 1)
            if (token.kind == TokenKind.NewLine && tokens[j].synKind == SK.OpenBraceToken) {
                i = j // skip NL
                continue
            }

            let needsSpace = true

            let last = output.length == 0 ? mkNewLine(token) : output[output.length - 1]

            switch (last.synKind) {
                case SK.ExclamationToken:
                case SK.TildeToken:
                case SK.DotToken:
                    needsSpace = false
                    break

                case SK.PlusToken:
                case SK.MinusToken:
                case SK.PlusPlusToken:
                case SK.MinusMinusToken:
                    if (last.isPrefix)
                        needsSpace = false
                    break;
            }

            switch (token.synKind) {
                case SK.DotToken:
                case SK.CommaToken:
                case SK.NewLineTrivia:
                case SK.ColonToken:
                case SK.SemicolonToken:
                case SK.OpenBracketToken:
                    needsSpace = false
                    break;

                case SK.PlusPlusToken:
                case SK.MinusMinusToken:
                    if (last.kind == TokenKind.Tree || last.kind == TokenKind.Identifier || last.kind == TokenKind.Keyword)
                        needsSpace = false
                /* fall through */
                case SK.PlusToken:
                case SK.MinusToken:
                    if (lastNonTrivialToken.kind == TokenKind.EOF ||
                        infixOperatorPrecedence(lastNonTrivialToken.synKind) ||
                        lastNonTrivialToken.synKind == SK.SemicolonToken)
                        token.isPrefix = true
                    break;
                case SK.OpenParenToken:
                    if (last.kind == TokenKind.Identifier)
                        needsSpace = false
                    if (last.kind == TokenKind.Keyword)
                        switch (last.synKind) {
                            case SK.IfKeyword:
                            case SK.ForKeyword:
                            case SK.WhileKeyword:
                            case SK.SwitchKeyword:
                            case SK.ReturnKeyword:
                            case SK.ThrowKeyword:
                            case SK.CatchKeyword:
                                break;
                            default:
                                needsSpace = false
                        }
                    break;
            }

            if (last.kind == TokenKind.NewLine)
                needsSpace = false

            if (needsSpace)
                output.push(mkSpace(token, " "))
            output.push(token)

            if (token.kind != TokenKind.NewLine)
                lastNonTrivialToken = token

            i++
        }
        return output
    }

    function finalFormat(ind: string, token: Token) {
        if (token.synKind == SK.NoSubstitutionTemplateLiteral &&
            /^`[\s\.#01]*`$/.test(token.text)) {
            let lines = token.text.slice(1, token.text.length - 1).split("\n").map(l => l.replace(/\s/g, "")).filter(l => !!l)
            if (lines.length < 4 || lines.length > 5) return;
            let numFrames = Math.floor((Math.max(...lines.map(l => l.length)) + 2) / 5)
            if (numFrames <= 0) numFrames = 1
            let out = "`\n"
            for (let i = 0; i < 5; ++i) {
                let l = lines[i] || ""
                while (l.length < numFrames * 5)
                    l += "."
                l = l.replace(/0/g, ".")
                l = l.replace(/1/g, "#")
                l = l.replace(/...../g, m => "/" + m)
                out += ind + l.replace(/./g, m => " " + m).replace(/\//g, " ").slice(3) + "\n"
            }
            out += ind + "`"
            token.text = out
        }
    }

    export function toStr(v: any): string {
        if (Array.isArray(v)) return "[[ " + v.map(toStr).join("  ") + " ]]"
        if (typeof v.text == "string")
            return JSON.stringify(v.text)
        return v + ""
    }

    export function format(input: string, pos: number) {
        let r = tokenize(input)

        //if (r.braceBalance != 0) return null

        let topTokens = r.tokens
        topTokens = emptyLinesToComments(topTokens, pos)
        topTokens = matchBraces(topTokens)
        let topStmts = delimitStmts(topTokens, true)

        let ind = ""
        let output = ""
        let outpos = -1
        let indIncrLine = 0

        topStmts.forEach(ppStmt)

        topStmts.forEach(s => s.tokens.forEach(findNonBlocks))

        if (outpos == -1)
            outpos = output.length

        return {
            formatted: output,
            pos: outpos
        }

        function findNonBlocks(t: Token) {
            if (t.kind == TokenKind.Tree) {
                let tree = t as TreeToken
                if (t.synKind == SK.OpenBraceToken) {
                    //showMsg(t, "left behind X")
                }

                tree.children.forEach(findNonBlocks)
            } else if (t.kind == TokenKind.Block) {
                (t as BlockToken).stmts.forEach(s => s.tokens.forEach(findNonBlocks))
            }
        }

        function incrIndent(parToken: Token, f: () => void) {
            if (indIncrLine == parToken.lineNo) {
                f()
            } else {
                indIncrLine = parToken.lineNo
                let prev = ind
                ind += "    "
                f()
                ind = prev
            }
        }

        function ppStmt(s: Stmt) {
            let toks = removeIndent(s.tokens)

            if (toks.length == 1 && !toks[0].isCursor && toks[0].text == "") {
                output += "\n"
                return
            }

            output += ind
            incrIndent(toks[0], () => {
                ppToks(toks)
            })
            if (output[output.length - 1] != "\n")
                output += "\n"
        }

        function writeToken(t: Token) {
            if (outpos == -1 && t.pos + t.text.length >= pos) {
                outpos = output.length + (pos - t.pos);
            }
            output += t.text;
        }

        function ppToks(tokens: Token[]) {
            tokens = normalizeSpace(tokens)
            for (let i = 0; i < tokens.length; ++i) {
                let t = tokens[i]
                finalFormat(ind, t)
                writeToken(t)
                switch (t.kind) {
                    case TokenKind.Tree:
                        let tree = t as TreeToken
                        incrIndent(t, () => {
                            ppToks(removeIndent(tree.children))
                        })
                        if (tree.endToken) {
                            writeToken(tree.endToken)
                        }
                        break;
                    case TokenKind.Block:
                        let blk = t as BlockToken;
                        if (blk.stmts.length == 0) {
                            output += " "
                        } else {
                            output += "\n"
                            blk.stmts.forEach(ppStmt)
                            output += ind.slice(4)
                        }
                        if (blk.endToken)
                            writeToken(blk.endToken)
                        else
                            output += "}"
                        break;
                    case TokenKind.NewLine:
                        if (tokens[i + 1] && tokens[i + 1].kind == TokenKind.CommentLine &&
                            tokens[i + 1].text == "" && !tokens[i + 1].isCursor)
                            break; // no indent for empty line
                        if (i == tokens.length - 1)
                            output += ind.slice(4)
                        else
                            output += ind
                        break;
                    case TokenKind.Whitespace:
                        break;
                }
            }
        }
    }
}