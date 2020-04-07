
namespace pxt.py.rx {
    const nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;

    export function isIdentifierStart(code: number) {
        return ts.pxtc.isIdentifierStart(code, ts.pxtc.ScriptTarget.ES5);
    }

    export function isIdentifierChar(code: number) {
        return ts.pxtc.isIdentifierPart(code, ts.pxtc.ScriptTarget.ES5);
    }

    export function isSpace(ch: number) {
        if (ch === 32 || // ' '
            ch === 9 || ch === 11 || ch === 12 || // TODO check this with CPython
            ch === 160 || // '\xa0'
            ch >= 0x1680 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
            return true;
        }
        return false;
    }

    export function isNewline(ch: number) {
        if (ch === 10 || ch === 13)
            return true;
        // Python ref doesn't really say LINE SEPARATOR and PARAGRAPH SEPARATOR
        // are line seperators, but how else should we treat them?
        if (ch === 0x2028 || ch === 0x2029)
            return true;
        return false;
    }
}