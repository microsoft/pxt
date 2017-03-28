export const loops: pxt.vs.NameDefiniton = {
    builtin: true,
    fns: {
        "while": {
            sig: `while(...)`,
            snippet: `while(true) {\n\n}`,
            comment: lf("Repeat code while condition is true"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "for": {
            sig: ``,
            snippet: `for(let i = 0; i < 5; i++) {\n\n}`,
            comment: lf("Repeat code a number of times in a loop"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        }
    },
    metaData: {
        color: pxt.blocks.blockColors["loops"].toString(),
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        icon: "loops",
        weight: 50.09,
        paramDefl: {}
    }
};

export const logic: pxt.vs.NameDefiniton = {
    builtin: true,
    fns: {
        "if": {
            sig: ``,
            snippet: `if (true) {\n\n}`,
            comment: lf("Runs code if the condition is true"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        }, "if ": {
            sig: ``,
            snippet: `if (true) {\n\n} else {\n\n}`,
            comment: lf("Runs code if the condition is true; else run other code"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },"switch": {
            sig: ``,
            snippet:
`switch(item) {
    case 0:
        break;
    case 1:
        break;
}`,
            comment: lf("Runs different code based on a value"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        }
    },
    metaData: {
        color: pxt.blocks.blockColors["logic"].toString(),
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        weight: 50.08,
        icon: "logic",
        paramDefl: {}
    }
};

export const variables: pxt.vs.NameDefiniton = {
    builtin: true,
    fns: {
        "let": {
            sig: ``,
            snippet: `let item: number`,
            snippetOnly: true,
            comment: lf("Declares a variable named 'item'"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "equals": {
            sig: ``,
            snippet: `item = 0`,
            snippetOnly: true,
            comment: lf("Assigns a value to a variable"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "change": {
            sig: ``,
            snippet: `item += 1`,
            snippetOnly: true,
            comment: lf("Changes the value of item by 1"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        }
    },
    metaData: {
        color: pxt.blocks.blockColors["variables"].toString(),
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        weight: 50.07,
        icon: "variables",
        paramDefl: {}
    }
};

export const maths: pxt.vs.NameDefiniton = {
    builtin: true,
    fns: {
        "plus": {
            sig: ``,
            snippet: `1 + 1`,
            snippetOnly: true,
            comment: lf("Adds two numbers together"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "minus": {
            sig: ``,
            snippet: `1 - 1`,
            snippetOnly: true,
            comment: lf("Subtracts the value of one number from another"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "multiply": {
            sig: ``,
            snippet: `1 * 1`,
            snippetOnly: true,
            comment: lf("Multiplies two numbers together"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "divide": {
            sig: ``,
            snippet: `1 / 1`,
            snippetOnly: true,
            comment: lf("Divides one number by another"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "remainder": {
            sig: ``,
            snippet: `1 % 1`,
            snippetOnly: true,
            comment: lf("Returns the remainder of one number divided by another"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "max": {
            sig: ``,
            snippet: `Math.max(1, 2)`,
            comment: lf("Returns the largest of two numbers"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "min": {
            sig: ``,
            snippet: `Math.min(1, 2)`,
            comment: lf("Returns the smallest of two numbers"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "abs": {
            sig: ``,
            snippet: `Math.abs(-1)`,
            comment: lf("Returns the absolute value of a number"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "random": {
            sig: ``,
            snippet: `Math.random(4)`,
            comment: lf("Returns a random number between 0 and an upper bound"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "randomBoolean": {
            sig: ``,
            snippet: `Math.randomBoolean()`,
            comment: lf("Randomly returns either true or false"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        }
    },
    metaData: {
        color: pxt.blocks.blockColors["math"].toString(),
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        weight: 50.06,
        icon: "math",
        paramDefl: {}
    }
};

export const text: pxt.vs.NameDefiniton = {
    builtin: true,
    fns: {
        "length": {
            sig: ``,
            snippet: `"".length`,
            snippetOnly: true,
            comment: lf("Returns the number of characters in a string"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "concat": {
            sig: ``,
            snippet: `"" + 5`,
            snippetOnly: true,
            comment: lf("Combines a string with a number, boolean, string, or other object into one string"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "compare": {
            sig: ``,
            snippet: `"".compare("")`,
            comment: lf("Compares one string against another alphabetically and returns a number"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "parseInt": {
            sig: ``,
            snippet: `parseInt("5")`,
            comment: lf("Converts a number written as text into a number"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "substr": {
            sig: ``,
            snippet: `"".substr(0, 0)`,
            comment: lf("Returns the part of a string starting at a given index with the given length"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        },
        "charAt": {
            sig: ``,
            snippet: `"".charAt(0)`,
            comment: lf("Returns the character at the given index"),
            metaData: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        }
    },
    metaData: {
        advanced: true,
        color: pxt.blocks.blockColors["text"].toString(),
        icon: "text",
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        paramDefl: {}
    }
}