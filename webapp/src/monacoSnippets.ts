import { BuiltinCategoryDefinition } from "./monaco";

import Util = pxt.Util;
let lf = Util.lf;

export const loops: BuiltinCategoryDefinition = {
    name: lf("{id:category}Loops"),
    blocks: [
        {
            name: "while",
            snippet: `while(true) {\n\n}`,
            attributes: {
                jsDoc: lf("Repeat code while condition is true")
            }
        },
        {
            name: "for",
            snippet: `for(let i = 0; i < 5; i++) {\n\n}`,
            attributes: {
                jsDoc: lf("Repeat code a number of times in a loop")
            }
        },
    ],
    attributes: {
        color: pxt.blocks.blockColors["loops"].toString(),
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        icon: "loops",
        weight: 50.09,
        paramDefl: {}
    }
};

export const logic: BuiltinCategoryDefinition = {
    name: lf("{id:category}Logic"),
    blocks: [
        {
            name: "if",
            snippet: `if (true) {\n\n}`,
            attributes: {
                jsDoc: lf("Runs code if the condition is true")
            }
        },
        {
            name: "if",
            snippet: `if (true) {\n\n} else {\n\n}`,
            attributes: {
                jsDoc: lf("Runs code if the condition is true; else run other code")
            }
        },
        {
            name: "switch",
            snippet:
`switch(item) {
    case 0:
        break;
    case 1:
        break;
}`,
            attributes: {
                jsDoc: lf("Runs different code based on a value")
            }
        },
    ],
    attributes: {
        color: pxt.blocks.blockColors["logic"].toString(),
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        weight: 50.08,
        icon: "logic",
        paramDefl: {}
    }
};

export const variables: BuiltinCategoryDefinition = {
    name: lf("{id:category}Variables"),
    blocks: [
        {
            name: "let",
            snippet: `let item: number`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Declares a variable named 'item'")
            }
        },
        {
            name: "equals",
            snippet: `item = 0`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Assigns a value to a variable")
            }
        },
        {
            name: "change",
            snippet: `item += 1`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Changes the value of item by 1")
            }
        },
    ],
    attributes: {
        color: pxt.blocks.blockColors["variables"].toString(),
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        weight: 50.07,
        icon: "variables",
        paramDefl: {}
    }
};

export const maths: BuiltinCategoryDefinition = {
    name: lf("{id:category}Math"),
    blocks: [
        {
            name: "plus",
            snippet: `1 + 1`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Adds two numbers together")
            }
        },
        {
            name: "minus",
            snippet: `1 - 1`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Subtracts the value of one number from another")
            }
        },
        {
            name: "multiply",
            snippet: `1 * 1`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Multiplies two numbers together")
            }
        },
        {
            name: "divide",
            snippet: `1 / 1`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Returns the remainder of one number divided by another")
            }
        },
        {
            name: "remainder",
            snippet: `1 % 2`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Returns the remainder of one number divided by another")
            }
        },
        {
            name: "max",
            snippet: `Math.max(1, 2)`,
            attributes: {
                jsDoc: lf("Returns the largest of two numbers")
            }
        },
        {
            name: "min",
            snippet: `Math.min(1, 2)`,
            attributes: {
                jsDoc: lf("Returns the smallest of two numbers")
            }
        },
        {
            name: "abs",
            snippet: `Math.abs(-1)`,
            attributes: {
                jsDoc: lf("Returns the absolute value of a number")
            }
        },
        {
            name: "random",
            snippet: `Math.random(4)`,
            attributes: {
                jsDoc: lf("Returns a random number between 0 and an upper bound")
            }
        },
        {
            name: "randomBoolean",
            snippet: `Math.randomBoolean()`,
            attributes: {
                jsDoc: lf("Randomly returns either true or false")
            }
        },
    ],
    attributes: {
        color: pxt.blocks.blockColors["math"].toString(),
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        weight: 50.06,
        icon: "math",
        paramDefl: {}
    }
};

export const text: BuiltinCategoryDefinition = {
    name: lf("{id:category}Text"),
    blocks: [
        {
            name: "length",
            snippet: `"".length`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Returns the number of characters in a string")
            }
        },
        {
            name: "concat",
            snippet: `"" + 5`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Combines a string with a number, boolean, string, or other object into one string")
            }
        },
        {
            name: "compare",
            snippet: `"".compare("")`,
            attributes: {
                jsDoc: lf("Compares one string against another alphabetically and returns a number")
            }
        },
        {
            name: "parseInt",
            snippet: `parseInt("5")`,
            attributes: {
                jsDoc: lf("Converts a number written as text into a number")
            }
        },
        {
            name: "substr",
            snippet: `"".substr(0, 0)`,
            attributes: {
                jsDoc: lf("Returns the part of a string starting at a given index with the given length")
            }
        },
        {
            name: "charAt",
            snippet: `"".charAt(0)`,
            attributes: {
                jsDoc: lf("Returns the character at the given index")
            }
        },
    ],
    attributes: {
        advanced: true,
        color: pxt.blocks.blockColors["text"].toString(),
        icon: "text",
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        paramDefl: {}
    }
}

export function getBuiltinCategory(ns: string) {
        switch (ns) {
            case loops.name: return loops;
            case logic.name: return logic;
            case variables.name: return variables;
            case maths.name: return maths;
            case text.name: return text;
        }
    return undefined;
}

export function isBuiltin(ns: string) {
    switch (ns) {
        case loops.name:
        case logic.name:
        case variables.name:
        case maths.name:
        case text.name:
            return true;
    }
    return false;
}