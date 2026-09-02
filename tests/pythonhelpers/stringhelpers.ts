
function assert(expression: boolean, message?: string) {
    if (!expression) {
        if (message) {
            throw "Assertion Failed: "+ message
        }
        else {
            throw "Assertion Failed"
        }
    }
}

function assertArraysEqual(a: string[], b: string[], message?: string) {
    if (a === b) return;

    assert(!!a && !!b, message);
    assert(a.length === b.length, message);
    for (let i = 0; i < a.length; i++) {
        assert(a[i] === b[i], message);
    }
}

function expectError(op: () => void, error: string, message: string) {
    try {
        op();
        throw "did not throw " + error
    }
    catch (e) {
        assert(e === error, "Expected Error: " + error + " " + message)
    }
}


function stringifyArray(val: string[]) {
    return `[${val.map(s => `"${s}"`).join(", ")}]`
}

const testCapitalize = (val: string, expect: string) => {
    assert(_py.py_string_capitalize(val) === expect, `"${val}".capitalize() !== "${expect}"`)
}
testCapitalize("a", "A");
testCapitalize("Hello", "Hello");
testCapitalize("hello", "Hello");
testCapitalize(" Hello", " hello");


const testCenter = (val: string, width: number, fillChar: string | undefined, expect: string) => {
    assert(_py.py_string_center(val, width, fillChar) === expect, `"${val}".center(${width}, "${fillChar}") !== "${expect}"`)
}
testCenter("hello", 10, undefined, "  hello   ");
testCenter("ab", 10, ".", "....ab....");
expectError(
    () => testCenter("hello", 10, "", "  hello   "),
    _py.TYPE_ERROR,
    "center"
)
expectError(
    () => testCenter("hello", 10, "ab", "  hello   "),
    _py.TYPE_ERROR,
    "center"
)


const testCount = (val: string, toCount: string, start: number | undefined, end: number, expect: number) => {
    assert(_py.py_string_count(val, toCount, start, end) === expect, `"${val}".count("${toCount}", ${start}, ${end}) !== ${expect}`)
}
testCount("blah blah blah", "blah", undefined, undefined, 3)
testCount("ababab", "abab", undefined, undefined, 1)


const test_endswith = (str: string, suffix: string, start?: number, end?: number, expect?: boolean) => {
    assert(_py.py_string_endswith(str, suffix, start, end) === expect, `"${str}".endswith() != ${expect}"`)
}
test_endswith("hello", "lo", undefined, undefined, true);
test_endswith("hello", "olo", undefined, undefined, false);
test_endswith("hello", "ll", 0, 4, true);


const test_find = (str: string, sub: string, start?: number, end?: number, expect?: number) => {
    assert(_py.py_string_find(str, sub, start, end) === expect, `"${str}".find() != ${expect}"`)
}
test_find("......ab......a..b....ab", "ab", undefined, undefined, 6)
test_find("......ab......a..b....ab", "abc", undefined, undefined, -1)
test_find("hello", "", undefined, undefined, 0)
test_find("hello", "", 2, undefined, 2)


const test_index = (str: string, sub: string, start?: number, end?: number, expect?: number) => {
    assert(_py.py_string_index(str, sub, start, end) === expect, `"${str}".index() != ${expect}"`)
}
test_index("......ab......a..b....ab", "ab", undefined, undefined, 6)
expectError(
    () => test_index("......ab......a..b....ab", "abc", undefined, undefined, -1),
    _py.VALUE_ERROR,
    "index"
)


const test_isalnum = (str: string, expect?: boolean) => {
    assert(_py.py_string_isalnum(str) === expect, `"${str}".isalnum() != ${expect}"`)
}
test_isalnum("abcABC123", true);
test_isalnum("abc 123", false);
test_isalnum("", false);


const test_isalpha = (str: string, expect?: boolean) => {
    assert(_py.py_string_isalpha(str) === expect, `"${str}".isalpha() != ${expect}"`)
}
test_isalpha("abcABC", true);
test_isalpha("abc123", false);
test_isalpha("", false);


const test_isascii = (str: string, expect?: boolean) => {
    assert(_py.py_string_isascii(str) === expect, `"${str}".isascii() != ${expect}"`)
}
test_isascii("abcABC", true);
test_isascii("abc \n\t 123", true);
test_isascii("", true);
test_isascii("aβc", false)


const test_isdigit = (str: string, expect?: boolean) => {
    assert(_py.py_string_isdigit(str) === expect, `"${str}".isdigit() != ${expect}"`)
}
test_isdigit("123", true);
test_isdigit("-1", false);
test_isdigit("1.2", false)
test_isdigit("", false);


const test_isnumeric = (str: string, expect?: boolean) => {
    assert(_py.py_string_isnumeric(str) === expect, `"${str}".isnumeric() != ${expect}"`)
}
test_isnumeric("123", true);
test_isnumeric("-1", false);
test_isnumeric("1.2", false)
test_isnumeric("", false);


const test_isdecimal = (str: string, expect?: boolean) => {
    assert(_py.py_string_isdecimal(str) === expect, `"${str}".isdecimal() != ${expect}"`)
}
test_isdecimal("123", true);
test_isdecimal("-1", false);
test_isdecimal("1.2", false)
test_isdecimal("", false);


const test_isspace = (str: string, expect?: boolean) => {
    assert(_py.py_string_isspace(str) === expect, `"${str}".isspace() != ${expect}"`)
}
test_isspace(" ", true)
test_isspace("\t\n\r\r\n\v\x0b\f\x0c\x1c\x1d\x1e\x85\u2028\u2029", true)
test_isspace(" a", false)
test_isspace("", false)


const test_isidentifier = (str: string, expect?: boolean) => {
    assert(_py.py_string_isidentifier(str) === expect, `"${str}".isidentifier() != ${expect}"`)
}
test_isidentifier("False", true)
test_isidentifier("abc123", true)
test_isidentifier("0hello", false)
test_isidentifier("h ello", false)
test_isidentifier("", false)


const test_islower = (str: string, expect?: boolean) => {
    assert(_py.py_string_islower(str) === expect, `"${str}".islower() != ${expect}"`)
}
test_islower("abc", true)
test_islower("a. bc", true)
test_islower("fAbc", false)
test_islower("", false)


const test_isprintable = (str: string, expect?: boolean) => {
    assert(_py.py_string_isprintable(str) === expect, `"${str}".isprintable() != ${expect}"`)
}
test_isprintable("\t", false)
test_isprintable(" ", true)
test_isprintable("hello goodbye", true)
test_isprintable("hello goodbye\n", false)
test_isprintable("", true)


const test_istitle = (str: string, expect?: boolean) => {
    assert(_py.py_string_istitle(str) === expect, `"${str}".istitle() != ${expect}"`)
}
test_istitle("A", true);
test_istitle("Hello Goodbye", true);
test_istitle("AA", false);
test_istitle("A A", true);
test_istitle("A.A", true);
test_istitle("A.a", false);
test_istitle("", false);


const test_isupper = (str: string, expect?: boolean) => {
    assert(_py.py_string_isupper(str) === expect, `"${str}".isupper() != ${expect}"`)
}
test_isupper("A", true)
test_isupper("HELLO GOODBYE 123", true)
test_isupper("AbC", false)
test_isupper("", false)
test_isupper(" ", false)


const test_join = (str: string, iterable: any[], expect?: string) => {
    assert(_py.py_string_join(str, iterable) === expect, `"${str}".join() != ${expect}"`)
}
test_join("a", ["1", "2", "3"], "1a2a3")
test_join("a", [], "")
test_join("a", ["1"], "1")
expectError(
    () => test_join("a", [1, "2", "3"], ""),
    _py.TYPE_ERROR,
    "join"
)


const test_ljust = (str: string, width: number, fillChar?: string, expect?: string) => {
    assert(_py.py_string_ljust(str, width, fillChar) === expect, `"${str}".ljust() != ${expect}"`)
}
test_ljust("hello", 0, undefined, "hello")
test_ljust("hello", 10, undefined, "hello     ")
test_ljust("hello", 10, ".", "hello.....")
expectError(
    () => test_ljust("hello", 10, "", "hello     "),
    _py.TYPE_ERROR,
    "ljust"
)
expectError(
    () => test_ljust("hello", 10, "ab", "hello     "),
    _py.TYPE_ERROR,
    "ljust"
)


const test_lower = (str: string, expect?: string) => {
    assert(_py.py_string_lower(str) === expect, `"${str}".lower() != ${expect}"`)
}
test_lower("HELLO", "hello")
test_lower("abc...234  AB", "abc...234  ab")
test_lower("", "")


const test_rfind = (str: string, sub: string, start?: number, end?: number, expect?: number) => {
    assert(_py.py_string_rfind(str, sub, start, end) === expect, `"${str}".rfind() != ${expect}"`)
}

test_rfind("......ab......a..b....ab", "ab", undefined, undefined, 22)
test_rfind("......ab......a..b....ab", "abc", undefined, undefined, -1)
test_rfind("hello", "", undefined, undefined, 5)
test_rfind("hello", "", undefined, 2, 2)


const test_rindex = (str: string, sub: string, start?: number, end?: number, expect?: number) => {
    assert(_py.py_string_rindex(str, sub, start, end) === expect, `"${str}".rindex() != ${expect}"`)
}
test_rindex("......ab......a..b....ab", "ab", undefined, undefined, 22);
expectError(
    () => test_rindex("......ab......a..b....ab", "abc", undefined, undefined, -1),
    _py.VALUE_ERROR,
    "rindex"
);

const test_startswith = (str: string, prefix: string, start?: number, end?: number, expect?: boolean) => {
    assert(_py.py_string_startswith(str, prefix, start, end) === expect, `"${str}".startswith() != ${expect}"`)
}
test_startswith("hello", "he", undefined, undefined, true);
test_startswith(" hello", "he", undefined, undefined, false);
test_startswith(" hello", "he", 1, undefined, true);
test_startswith(" hello", "he", 1, 2, false);
test_startswith("hello", "", undefined, undefined, true);


const test_rstrip = (str: string, chars?: string, expect?: string) => {
    assert(_py.py_string_rstrip(str, chars) === expect, `"${str}".rstrip() != ${expect}"`)
}
test_rstrip("   hello  \n\t\v ", undefined, "   hello")
test_rstrip("hello   ", "abc", "hello   ")
test_rstrip("hello", "ol", "he")
test_rstrip("hello", "", "hello")


const test_lstrip = (str: string, chars?: string, expect?: string) => {
    assert(_py.py_string_lstrip(str, chars) === expect, `"${str}".lstrip() != ${expect}"`)
}
test_lstrip("  \n hello   ", undefined, "hello   ")
test_lstrip("   hello", "eh", "   hello")
test_lstrip("hello", "eh", "llo")
test_lstrip("hello", "", "hello")


const test_strip = (str: string, chars?: string, expect?: string) => {
    assert(_py.py_string_strip(str, chars) === expect, `"${str}".strip() != ${expect}"`)
}
test_strip("   hello    ", undefined, "hello")
test_strip("  hello  ", "oh", "  hello  ")
test_strip("hello", "oh", "ell")
test_strip("hello", "", "hello")


const test_swapcase = (str: string, expect?: string) => {
    assert(_py.py_string_swapcase(str) === expect, `"${str}".swapcase() != ${expect}"`)
}
test_swapcase("hello", "HELLO")
test_swapcase("aAbBcC", "AaBbCc")
test_swapcase("A.B.C D", "a.b.c d")


const test_title = (str: string, expect?: string) => {
    assert(_py.py_string_title(str) === expect, `"${str}".title() != ${expect}"`)
}
test_title("hello goodbye", "Hello Goodbye")
test_title("", "")
test_title("bAA bAA bLACK,SHEEP!", "Baa Baa Black,Sheep!")


const test_upper = (str: string, expect?: string) => {
    assert(_py.py_string_upper(str) === expect, `"${str}".upper() != ${expect}"`)
}
test_upper("abc", "ABC")
test_upper("aAbBcC", "AABBCC")
test_upper("a.b.c d", "A.B.C D")


const test_zfill = (str: string, width: number, expect?: string) => {
    assert(_py.py_string_zfill(str, width) === expect, `"${str}".zfill() != ${expect}"`)
}
test_zfill("12", 4, "0012")
test_zfill("-12", 4, "-012")
test_zfill("+12", 4, "+012")
test_zfill(".12", 4, "0.12")
test_zfill("12", -2, "12")


const test_rjust = (str: string, width: number, fillChar?: string, expect?: string) => {
    assert(_py.py_string_rjust(str, width, fillChar) === expect, `"${str}".rjust() != ${expect}"`)
}
test_rjust("hello", 10, undefined, "     hello")
test_rjust("hello", 10, ".", ".....hello")
expectError(
    () => test_rjust("hello", 10, "", "     hello"),
    _py.TYPE_ERROR,
    "rjust"
)
expectError(
    () => test_rjust("hello", 10, "ab", "     hello"),
    _py.TYPE_ERROR,
    "rjust"
)


const test_rsplit = (str: string, sep?: string, maxsplit?: number, expect?: string[]) => {
    const result = _py.py_string_rsplit(str, sep, maxsplit);
    assertArraysEqual(result, expect, `"${str}".rsplit() !== ${stringifyArray(expect)}`)
}
test_rsplit("hello", "l", undefined, ["he", "", "o"])
test_rsplit("hello", "l", 1, ["hel", "o"])
test_rsplit("hello", "l", -1, ["he", "", "o"])
test_rsplit("hello", "l", 0, ["hello"])
test_rsplit("hello goodbye hello\nagain", undefined, undefined, ["hello", "goodbye", "hello", "again"])
test_rsplit("hello goodbye hello\nagain", undefined, 2, ["hello goodbye", "hello", "again"])
expectError(
    () => test_rsplit("hello goodbye", "", undefined, []),
    _py.VALUE_ERROR,
    "rsplit"
)


const test_split = (str: string, sep?: string, maxsplit?: number, expect?: string[]) => {
    const result = _py.py_string_split(str, sep, maxsplit);
    assertArraysEqual(result, expect, `"${str}".split() !== ${stringifyArray(expect)}`)
}
test_split("hello", "l", undefined, ["he", "", "o"])
test_split("hello", "l", 1, ["he", "lo"])
test_split("hello", "l", -1, ["he", "", "o"])
test_split("hello", "l", 0, ["hello"])
test_split("hello goodbye hello\nagain", undefined, undefined, ["hello", "goodbye", "hello", "again"])
test_split("hello goodbye hello\nagain", undefined, 2, ["hello", "goodbye", "hello\nagain"])
expectError(
    () => test_split("hello goodbye", "", undefined, []),
    _py.VALUE_ERROR,
    "split"
)


const test_splitlines = (str: string, keepends?: boolean, expect?: string[]) => {
    const result = _py.py_string_splitlines(str, keepends);
    assertArraysEqual(result, expect, `"${str}".splitlines() !== ${stringifyArray(expect)}`)
}
test_splitlines("a\nb\rc\r\nd", undefined, ["a", "b", "c", "d"])
test_splitlines("a\nb\rc\r\nd", true, ["a\n", "b\r", "c\r\n", "d"])
test_splitlines("hello\n", undefined, ["hello"])
test_splitlines("hello\n\n\n", undefined, ["hello", "", ""])
test_splitlines("hello\n", true, ["hello\n"])

console.log("all good!")