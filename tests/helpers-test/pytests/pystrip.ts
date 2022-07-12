namespace strip {
    const errors: string[] = [];
    function error(name: string, args: string[], expected: string, result: string) {
        errors.push(`FAILED ${name}(${args.filter(a => a != undefined).map(a => `"${a}"`).join(", ")}) => "${result}", expected "${expected}"`);
    }

    function teststrip(expected: string, str: string, chars?: string) {
        const res = _py.py_string_strip(str, chars);
        if (res != expected) error("py_string_strip", [str, chars], expected, res);
        else console.log("passed")
    }

    function testrstrip(expected: string, str: string, chars?: string) {
        const res = _py.py_string_rstrip(str, chars);
        if (res != expected) error("py_string_rstrip", [str, chars], expected, res);
        else console.log("passed")
    }

    function testlstrip(expected: string, str: string, chars?: string) {
        const res = _py.py_string_lstrip(str, chars);
        if (res != expected) error("py_string_lstrip", [str, chars], expected, res);
        else console.log("passed")
    }

    teststrip("a", "  a ")
    teststrip("a a", "  a a")
    teststrip("", " ")
    teststrip("  a ", "  a ", "")
    teststrip("cc", "aabbccbbaa", "ab")
    teststrip("cc", "a abbccbba a", "ab ")
    teststrip("", "a abbccbba a", "abc ")

    testlstrip("a ", "  a ")
    testlstrip("a a", "  a a")
    testlstrip("", " ")
    testlstrip("  a ", "  a ", "")
    testlstrip("ccbbaa", "aabbccbbaa", "ab")
    testlstrip("ccbba a", "a abbccbba a", "ab ")
    testlstrip("", "a abbccbba a", "abc ")

    testrstrip("  a", "  a ")
    testrstrip("  a a", "  a a")
    testrstrip("", " ")
    testrstrip("  a ", "  a ", "")
    testrstrip("aabbcc", "aabbccbbaa", "ab")
    testrstrip("a abbcc", "a abbccbba a", "ab ")
    testrstrip("", "a abbccbba a", "abc ")

    if (errors.length) {
        throw errors.join("\n");
    }
}