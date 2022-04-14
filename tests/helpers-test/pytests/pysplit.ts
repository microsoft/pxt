namespace split {
    const errors: string[] = [];
    function error(name: string, args: any[], expected: string, result: string) {
        errors.push(`FAILED ${name}(${args.filter(a => a != undefined).map(a => `"${a}"`).join(", ")}) => "${result}", expected "${expected}"`);
    }

    function testrsplit(str: string, expect: string[], sep?: string, maxSplit?: number) {
        const res = _py.py_string_rsplit(str, sep, maxSplit);

        if (res.length !== expect.length) {
            error("py_string_rsplit", [str, sep, maxSplit], `[${expect.map(val => `"${val}"`).join(", ")}]`, `[${res.map(val => `"${val}"`).join(", ")}]`);
            return;
        }
        for (let i = 0; i < expect.length; i++) {
            if (res[i] !== expect[i]) {
                error("py_string_rsplit", [str, sep, maxSplit], `[${expect.map(val => `"${val}"`).join(", ")}]`, `[${res.map(val => `"${val}"`).join(", ")}]`);
                return;
            }
        }
        console.log("passed")
    }

    function testsplit(str: string, expect: string[], sep?: string, maxSplit?: number) {
        const res = _py.py_string_split(str, sep, maxSplit);


        if (res.length !== expect.length) {
            error("py_string_split", [str, sep, maxSplit], `[${expect.map(val => `"${val}"`).join(", ")}]`, `[${res.map(val => `"${val}"`).join(", ")}]`);
            return;
        }
        for (let i = 0; i < expect.length; i++) {
            if (res[i] !== expect[i]) {
                error("py_string_split", [str, sep, maxSplit], `[${expect.map(val => `"${val}"`).join(", ")}]`, `[${res.map(val => `"${val}"`).join(", ")}]`);
                return;
            }
        }
        console.log("passed")
    }

    testrsplit("aa bb", ["aa", "bb"])
    testrsplit(" a b c d ", ["a", "b", "c", "d"])
    testrsplit("a b   c d", ["a", "b", "c", "d"])
    testrsplit("  ", [])
    testrsplit("hello how are you", ["he", "", "o how are you"], "l")
    testrsplit(" ", [ "", ""], " ")
    testrsplit("hello hello hello", ["he", "o he", "o he", "o"], "ll")
    testrsplit("aabbaa", ["", "bb", ""], "aa")
    testrsplit("aabbaa", ["aabbaa"], "c")
    testrsplit("aabbcc", ["aa", "cc"], "bb", 1)
    testrsplit("aaccbbccdd", ["aaccbb", "dd"], "cc", 1)
    testrsplit("aabbccddccee", ["aabb", "dd", "ee"], "cc", 2)
    testrsplit("  ", [], null, 1)
    testrsplit(" a  b c e  ", [" a  b c", "e"], null, 1)
    testrsplit(" a  b c e  ", [" a  b", "c", "e"], null, 2)


    testsplit("aa bb", ["aa", "bb"])
    testsplit(" a b c d ", ["a", "b", "c", "d"])
    testsplit("a b   c d", ["a", "b", "c", "d"])
    testsplit("  ", [])
    testsplit("hello how are you", ["he", "", "o how are you"], "l")
    testsplit(" ", ["", ""], " ")
    testsplit("hello hello hello", ["he", "o he", "o he", "o"], "ll")
    testsplit("aabbaa", ["", "bb", ""], "aa")
    testsplit("aabbaa", ["aabbaa"], "c")
    testsplit("aabbcc", ["aa", "cc"], "bb", 1)
    testsplit("aaccbbccdd", ["aa", "bbccdd"], "cc", 1)
    testsplit("aabbccddccee", ["aabb", "dd", "ee"], "cc", 2)
    testsplit("  ", [], null, 1)
    testsplit(" a  b c e  ", ["a", "b c e  "], null, 1)
    testsplit(" a  b c e  ", ["a", "b", "c e  "], null, 2)


    if (errors.length) {
        throw errors.join("\n");
    }
}