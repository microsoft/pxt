// Lexer spec: https://docs.python.org/3/reference/lexical_analysis.html

namespace pxt.py {
    export enum TokenType {
        Id,
        Op,
        Keyword,
        Number,
        String,
        NewLine,
        Comment,
        Indent,
        Dedent,
        EOF,
        Error
    }
    export interface Token {
        type: TokenType;
        value: string;
        auxValue?: any;
        quoted?: string;
        stringPrefix?: string;
        startPos: number;
        endPos: number;
    }

    const keywords: Map<boolean> = {
        "False": true, "None": true, "True": true, "and": true, "as": true, "assert": true,
        "async": true, "await": true, "break": true, "class": true, "continue": true,
        "def": true, "del": true, "elif": true, "else": true, "except": true, "finally": true,
        "for": true, "from": true, "global": true, "if": true, "import": true, "in": true,
        "is": true, "lambda": true, "nonlocal": true, "not": true, "or": true, "pass": true,
        "raise": true, "return": true, "try": true, "while": true, "with": true, "yield": true,
    }

    let asciiParse: (() => void)[] = []
    let allOps: Map<string>
    let revOps: Map<string>

    const eqOps: Map<string> = {
        "%": "Mod",
        "&": "BitAnd",
        "*": "Mult",
        "**": "Pow",
        "+": "Add",
        "-": "Sub",
        "/": "Div",
        "//": "FloorDiv",
        "<<": "LShift",
        ">>": "RShift",
        "@": "MatMult",
        "^": "BitXor",
        "|": "BitOr",
    }

    const nonEqOps: Map<string> = {
        "!": "Bang", // not really a token, but needed by the lexer
        "!=": "NotEq",
        "(": "LParen",
        ")": "RParen",
        ",": "Comma",
        "->": "Arrow",
        ".": "Dot",
        ":": "Colon",
        ";": "Semicolon",
        "<": "Lt",
        "<=": "LtE",
        "=": "Assign",
        "==": "Eq",
        ">": "Gt",
        ">=": "GtE",
        "[": "LSquare",
        "]": "RSquare",
        "{": "LBracket",
        "}": "RBracket",
        "~": "Invert",
    }

    const numBases: Map<RegExp> = {
        "b": /^[_0-1]$/,
        "B": /^[_0-1]$/,
        "o": /^[_0-7]$/,
        "O": /^[_0-7]$/,
        "x": /^[_0-9a-fA-F]$/,
        "X": /^[_0-9a-fA-F]$/,
    }

    const numBasesRadix: Map<number> = {
        "b": 2,
        "B": 2,
        "o": 8,
        "O": 8,
        "x": 16,
        "X": 16,
    }

    // resettable lexer state
    let res: Token[]
    let source: string
    let pos = 0, pos0 = 0

    export function position(startPos: number, source: string) {
        let lineno = 0
        let lastnl = 0
        for (let i = 0; i < startPos; ++i) {
            if (source.charCodeAt(i) == 10) {
                lineno++
                lastnl = i
            }
        }
        return { line: lineno, column: startPos - lastnl - 1 }
    }

    export function patchPosition(d: pxtc.KsDiagnostic, src: string) {
        if (!d.start && !d.length) {
            d.start = 0
            d.length = 0
            d.line = 0
            d.column = 0
            return
        }
        let p = position(d.start, src)
        d.line = p.line
        d.column = p.column
        if (d.length > 0) {
            p = position(d.start + d.length - 1, src)
            d.endLine = p.line
            d.endColumn = p.column + 2 // not sure where the +2 is coming from, but it works out in monaco
        }
    }

    export function tokenToString(t: Token) {
        switch (t.type) {
            case TokenType.Id:
                return `id(${t.value})`
            case TokenType.Op:
                return "'" + revOps[t.value] + "'"
            case TokenType.Keyword:
                return t.value
            case TokenType.Number:
                return `num(${t.value})`
            case TokenType.String:
                return t.stringPrefix + JSON.stringify(t.value)
            case TokenType.NewLine:
                return `<nl>`
            case TokenType.Comment:
                return `/* ${t.value} */`
            case TokenType.Indent:
                return "indent" + t.value
            case TokenType.Dedent:
                return "dedent"
            case TokenType.Error:
                return `[ERR: ${t.value}]`
            case TokenType.EOF:
                return "End of file"
            default:
                return "???"
        }
    }

    export function friendlyTokenToString(t: Token, source: string) {
        let len = t.endPos - t.startPos
        let s = ""
        if (len == 0) {
            s = tokenToString(t)
        } else if (len > 20) {
            s = "`" + source.slice(t.startPos, t.startPos + 20) + "`..."
        } else {
            s = "`" + source.slice(t.startPos, t.endPos) + "`"
        }
        s = s.replace(/\r/g, "")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t")
        return s
    }

    export function tokensToString(ts: Token[]) {
        let r = ""
        let lineLen = 0
        for (let t of ts) {
            let tmp = tokenToString(t)
            if (lineLen + tmp.length > 70) {
                lineLen = 0
                r += "\n"
            }
            if (lineLen != 0) r += " "
            r += tmp
            lineLen += tmp.length
            if (t.type == TokenType.NewLine || t.type == TokenType.Comment) {
                lineLen = 0
                r += "\n"
            }
        }
        return r
    }

    export function lex(_source: string) {
        if (asciiParse.length == 0)
            initAsciiParse()

        // these can't be local, since we capture lambdas from the first execution
        source = _source
        res = []
        pos = 0
        pos0 = 0

        checkIndent()

        while (pos < source.length) {
            pos0 = pos
            const ch = source.charCodeAt(pos++)
            if (ch < 128) {
                asciiParse[ch]()
            } else if (rx.isIdentifierStart(ch)) {
                parseId();
            } else if (rx.isSpace(ch)) {
                // skip
            } else if (rx.isNewline(ch)) {
                singleNewline()
            } else {
                invalidToken()
            }
        }
        pos0 = pos
        singleNewline()
        addToken(TokenType.EOF, "")
        return res

        function addToken(type: TokenType, val: string, aux?: any) {
            let t: Token = {
                type: type,
                value: val,
                startPos: pos0,
                endPos: pos,
                auxValue: aux
            }
            res.push(t)
            return t
        }

        function addError(msg: string) {
            addToken(TokenType.Error, msg)
        }

        function parseId() {
            while (rx.isIdentifierChar(source.charCodeAt(pos)))
                pos++
            let id = source.slice(pos0, pos)
            let ch = source.charCodeAt(pos)
            if (keywords.hasOwnProperty(id))
                addToken(TokenType.Keyword, id)
            else if (ch == 34 || ch == 39)
                parseStringPref(id)
            else
                addToken(TokenType.Id, id)
        }

        function singleOp(name: string) {
            addToken(TokenType.Op, name)
        }

        function multiOp(name: string) {
            let ch2 = source.slice(pos0, pos + 1)
            if (ch2.length == 2 && allOps.hasOwnProperty(ch2)) {
                let ch3 = source.slice(pos0, pos + 2)
                if (ch3.length == 3 && allOps.hasOwnProperty(ch3)) {
                    pos += 2
                    name = allOps[ch3]
                } else {
                    pos++
                    name = allOps[ch2]
                }
            }
            singleOp(name)
        }

        function asciiEsc(code: number) {
            switch (code) {
                case 97: return 7 // \a
                case 98: return 8 // \b
                case 102: return 12 // \f
                case 110: return 10 // \n
                case 114: return 13 // \r
                case 116: return 9 // \t
                case 118: return 11 // \v
                default: return 0
            }
        }

        function unicode(c: number) {
            return ("0000" + c.toString(16)).slice(-4)
        }

        function parseStringPref(pref: string) {
            const delim = source.charCodeAt(pos++)
            let tripleMode = false
            if (source.charCodeAt(pos) == delim && source.charCodeAt(pos + 1) == delim) {
                pos += 2
                tripleMode = true
            }
            pref = pref.toLowerCase()
            let rawMode = pref.indexOf("r") >= 0
            let value = ""
            let quoted = ""
            while (true) {
                const ch = source.charCodeAt(pos++)
                if (ch == delim) {
                    if (tripleMode) {
                        if (source.charCodeAt(pos) == delim &&
                            source.charCodeAt(pos + 1) == delim) {
                            pos += 2
                            break
                        } else {
                            quoted += "\\" + String.fromCharCode(delim)
                            value += String.fromCharCode(delim)
                        }
                    } else {
                        break
                    }
                } else if (ch == 92) {
                    let ch2 = source.charCodeAt(pos++)
                    if (ch2 == 13 && source.charCodeAt(pos) == 10) {
                        ch2 = 10
                        pos++
                    }

                    if (ch2 == 34 || ch2 == 39 || ch2 == 92) {
                        if (rawMode) {
                            quoted += "\\"
                            value += "\\"
                        }
                        quoted += "\\" + String.fromCharCode(ch2)
                        value += String.fromCharCode(ch2)
                    } else if (!rawMode && asciiEsc(ch2)) {
                        quoted += "\\" + String.fromCharCode(ch2)
                        value += String.fromCharCode(asciiEsc(ch2))
                    } else if (rx.isNewline(ch2)) {
                        if (rawMode) {
                            value += "\\" + String.fromCharCode(ch2)
                            quoted += "\\\\"
                            if (ch2 == 10) quoted += "\\n"
                            else quoted += "\\u" + unicode(ch2)
                        } else {
                            // skip
                        }
                    } else if (!rawMode && ch2 == 48) {
                        // handle \0 as special case
                        quoted += "\\\\x00"
                        value += "\x00"
                    } else if (!rawMode && (ch2 == 117 || ch2 == 120)) {
                        // We pass as is
                        // TODO add support for octal (\123)
                        let len = ch2 == 117 ? 4 : 2
                        let num = source.slice(pos, pos + len)
                        pos += len
                        let v = parseInt(num, 16)
                        if (isNaN(v))
                            addError(U.lf("invalid unicode or hex escape"))
                        quoted += "\\" + String.fromCharCode(ch2) + num
                        value += String.fromCharCode(v)
                    } else {
                        quoted += "\\\\" + String.fromCharCode(ch2)
                        value += "\\" + String.fromCharCode(ch2)
                    }
                } else if (isNaN(ch)) {
                    addError(U.lf("end of file in a string"))
                    break
                } else {
                    if (rx.isNewline(ch)) {
                        if (!tripleMode) {
                            addError(U.lf("new line in a string"))
                            break
                        }
                    }
                    value += String.fromCharCode(ch)
                    quoted += String.fromCharCode(ch)
                }
            }

            let t = addToken(TokenType.String, value)
            t.quoted = quoted
            t.stringPrefix = pref
        }

        function parseString() {
            pos--
            parseStringPref("")
        }

        function singleNewline() {
            addToken(TokenType.NewLine, "")
            checkIndent()
        }

        function checkIndent() {
            let ind = 0
            while (true) {
                const ch = source.charCodeAt(pos)
                if (ch == 9) {
                    // addError(U.lf("TAB indentaion not supported"))
                    ind = (ind + 8) & ~7
                    pos++
                    continue
                }
                if (ch != 32)
                    break
                ind++
                pos++
            }
            addToken(TokenType.Indent, "" + ind)
        }

        function parseBackslash() {
            let ch2 = source.charCodeAt(pos)
            if (rx.isNewline(ch2)) {
                pos++
                if (ch2 == 13 && source.charCodeAt(pos) == 10)
                    pos++
            } else {
                addError(U.lf("unexpected character after line continuation character"))
            }
        }

        function parseComment() {
            addToken(TokenType.NewLine, "")
            while (pos < source.length) {
                if (rx.isNewline(source.charCodeAt(pos)))
                    break
                pos++
            }
            addToken(TokenType.Comment, source.slice(pos0 + 1, pos))
            if (source.charCodeAt(pos) == 13 && source.charCodeAt(pos + 1) == 10)
                pos++
            pos++ // skip newline
            checkIndent()
        }

        function parseNumber() {
            let c1 = source[pos0]
            let num = ""

            // TypeScript supports 0x, 0o, 0b, as well as _ in numbers,
            // so we just pass them as is

            if (c1 == "0") {
                let c2 = source[pos]
                const rx = numBases[c2]
                if (rx) {
                    pos++
                    while (true) {
                        const ch = source[pos]
                        if (!rx.test(ch))
                            break
                        num += ch
                        pos++
                    }
                    if (num) {
                        let p = parseInt(num, numBasesRadix[c2])
                        if (isNaN(p))
                            addError(U.lf("invalid number"))
                        addToken(TokenType.Number, c1 + c2 + num, p)
                    } else
                        addError(U.lf("expecting numbers to follow 0b, 0o, 0x"))
                    return
                }
            }

            // decimal, possibly float
            let seenDot = false
            let seenE = false
            let minusAllowed = false
            pos = pos0
            while (true) {
                const ch = source.charCodeAt(pos)
                if (minusAllowed && (ch == 43 || ch == 45)) {
                    // ok
                } else {
                    minusAllowed = false
                    if (ch == 95 || isDigit(ch)) {
                        // OK
                    } else if (!seenE && !seenDot && ch == 46) {
                        seenDot = true
                    } else if (!seenE && (ch == 69 || ch == 101)) {
                        seenE = true
                        minusAllowed = true
                    } else {
                        break
                    }
                }
                num += String.fromCharCode(ch)
                pos++
            }

            if (!seenDot && !seenE && c1 == "0" && num.length > 1 && !/^0+/.test(num))
                addError(U.lf("unexpected leading zero"))
            let p = parseFloat(num)
            if (isNaN(p))
                addError(U.lf("invalid number"))
            addToken(TokenType.Number, num, p)
        }

        function parseDot() {
            if (isDigit(source.charCodeAt(pos)))
                parseNumber()
            else
                addToken(TokenType.Op, "Dot")
        }

        function isDigit(ch: number) {
            return (48 <= ch && ch <= 57)
        }

        function invalidToken() {
            addError(U.lf("invalid token"))
        }

        function initAsciiParse() {
            const specialParse: Map<() => void> = {
                "\"": parseString,
                "'": parseString,
                "#": parseComment,
                "\\": parseBackslash,
                ".": parseDot,
            }

            allOps = U.clone(nonEqOps)
            for (let k of Object.keys(eqOps)) {
                allOps[k] = eqOps[k]
                allOps[k + "="] = eqOps[k] + "Assign"
            }
            revOps = {}
            for (let k of Object.keys(allOps)) {
                revOps[allOps[k]] = k
            }
            for (let i = 0; i < 128; ++i) {
                if (rx.isIdentifierStart(i))
                    asciiParse[i] = parseId
                else {
                    let s = String.fromCharCode(i)
                    if (specialParse.hasOwnProperty(s)) {
                        asciiParse[i] = specialParse[s]
                    } else if (allOps.hasOwnProperty(s)) {
                        let canBeLengthened = false
                        let op = allOps[s]
                        for (let kk of Object.keys(allOps)) {
                            if (kk != s && kk.startsWith(s)) {
                                canBeLengthened = true
                            }
                        }
                        if (canBeLengthened) {
                            asciiParse[i] = () => multiOp(op)
                        } else {
                            asciiParse[i] = () => singleOp(op)
                        }
                    } else if (rx.isSpace(i)) {
                        asciiParse[i] = () => { }
                    } else if (i == 13) {
                        asciiParse[i] = () => {
                            if (source.charCodeAt(pos) == 10)
                                pos++
                            singleNewline()
                        }
                    } else if (rx.isNewline(i)) {
                        asciiParse[i] = singleNewline
                    } else if (isDigit(i)) {
                        asciiParse[i] = parseNumber
                    } else {
                        asciiParse[i] = invalidToken
                    }
                }
            }
        }
    }
}
