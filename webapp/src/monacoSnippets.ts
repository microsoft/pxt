import { BuiltinCategoryDefinition } from "./monaco";
export const loops: BuiltinCategoryDefinition = {
    name: lf("{id:category}Loops"),
    nameid: 'loops',
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
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        icon: "loops",
        weight: 50.09,
        paramDefl: {}
    }
};

export const logic: BuiltinCategoryDefinition = {
    name: lf("{id:category}Logic"),
    nameid: 'logic',
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
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        weight: 50.08,
        icon: "logic",
        paramDefl: {}
    }
};

export const variables: BuiltinCategoryDefinition = {
    name: lf("{id:category}Variables"),
    nameid: 'variables',
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
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        weight: 50.07,
        icon: "variables",
        paramDefl: {}
    }
};

export const maths: BuiltinCategoryDefinition = {
    name: lf("{id:category}Math"),
    nameid: 'math',
    blocks: [
        {
            name: "plus",
            snippet: `1 + 1`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Adds two numbers together")
            },
            retType: "number"
        },
        {
            name: "minus",
            snippet: `1 - 1`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Subtracts the value of one number from another")
            },
            retType: "number"
        },
        {
            name: "multiply",
            snippet: `1 * 1`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Multiplies two numbers together")
            },
            retType: "number"
        },
        {
            name: "divide",
            snippet: `1 / 1`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Returns the quotient of one number divided by another")
            },
            retType: "number"
        },
        {
            name: "remainder",
            snippet: `1 % 2`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Returns the remainder of one number divided by another")
            },
            retType: "number"
        },
        {
            name: "max",
            snippet: `Math.max(1, 2)`,
            attributes: {
                jsDoc: lf("Returns the largest of two numbers")
            },
            retType: "number"
        },
        {
            name: "min",
            snippet: `Math.min(1, 2)`,
            attributes: {
                jsDoc: lf("Returns the smallest of two numbers")
            },
            retType: "number"
        },
        {
            name: "abs",
            snippet: `Math.abs(-1)`,
            attributes: {
                jsDoc: lf("Returns the absolute value of a number")
            },
            retType: "number"
        },
        {
            name: "randomRange",
            snippet: `Math.randomRange(0, 10)`,
            attributes: {
                jsDoc: lf("Returns a random number between min and max")
            },
            retType: "number"
        },
        {
            name: "randomBoolean",
            snippet: `Math.randomBoolean()`,
            attributes: {
                jsDoc: lf("Randomly returns either true or false")
            },
            retType: "boolean"
        },
    ],
    attributes: {
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        weight: 50.06,
        icon: "math",
        paramDefl: {}
    }
};

export const text: BuiltinCategoryDefinition = {
    name: lf("{id:category}Text"),
    nameid: 'text',
    custom: true,
    blocks: [
        {
            name: "length",
            snippet: `"".length`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Returns the number of characters in a string")
            },
            retType: "number"
        },
        {
            name: "concat",
            snippet: `"" + 5`,
            snippetOnly: true,
            attributes: {
                jsDoc: lf("Combines a string with a number, boolean, string, or other object into one string")
            },
            retType: "string"
        },
        {
            name: "compare",
            snippet: `"".compare("")`,
            attributes: {
                jsDoc: lf("Compares one string against another alphabetically and returns a number")
            },
            retType: "number"
        },
        {
            name: "parseInt",
            snippet: `parseInt("5")`,
            attributes: {
                jsDoc: lf("Converts a number written as text into a number")
            },
            retType: "number"
        },
        {
            name: "substr",
            snippet: `"".substr(0, 0)`,
            attributes: {
                jsDoc: lf("Returns the part of a string starting at a given index with the given length")
            },
            retType: "string"
        },
        {
            name: "charAt",
            snippet: `"".charAt(0)`,
            attributes: {
                jsDoc: lf("Returns the character at the given index")
            },
            retType: "string"
        },
    ],
    attributes: {
        advanced: true,
        icon: "text",
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        paramDefl: {}
    }
}

export const arrays: BuiltinCategoryDefinition = {
    name: lf("{id:category}Arrays"),
    nameid: "arrays",
    custom: true,
    blocks: [
        {
            name: "create",
            snippet: `let ${lf("{id:snippets}list")} = [1, 2, 3];`,
            snippetOnly: true,
            attributes: {
                weight: 100,
                jsDoc: lf("Creates a new Array")
            },
            retType: "array"
        },
        {
            name: "length",
            snippet: `${lf("{id:snippets}list")}.length`,
            snippetOnly: true,
            attributes: {
                weight: 99,
                jsDoc: lf("Returns the number of values in an Array")
            },
            retType: "number"
        },
        {
            name: "get",
            snippet: `${lf("{id:snippets}list")}[0]`,
            snippetOnly: true,
            attributes: {
                weight: 98,
                jsDoc: lf("Returns the value in the Array at the given index")
            }
        },
        {
            name: "set",
            snippet: `${lf("{id:snippets}list")}[0] = 1`,
            snippetOnly: true,
            attributes: {
                weight: 97,
                jsDoc: lf("Overwrites the value in an Array at the given index")
            }
        },
        {
            name: "push",
            snippet: `${lf("{id:snippets}list")}.push(1)`,
            attributes: {
                weight: 96,
                jsDoc: lf("Adds a value to the end of an Array")
            }
        },
        {
            name: "pop",
            snippet: `${lf("{id:snippets}list")}.pop()`,
            attributes: {
                weight: 95,
                jsDoc: lf("Removes and returns the value at the end of an Array")
            },
            retType: "object"
        },
        {
            name: "insertAt",
            snippet: `${lf("{id:snippets}list")}.insertAt(0, 0)`,
            attributes: {
                weight: 50,
                jsDoc: lf("Inserts a value into the Array at the given index"),
                advanced: true
            }
        },
        {
            name: "removeAt",
            snippet: `${lf("{id:snippets}list")}.removeAt(0)`,
            attributes: {
                weight: 49,
                jsDoc: lf("Removes a value from the Array at the given index and returns it"),
                advanced: true
            },
            retType: "object"
        },
        {
            name: "shift",
            snippet: `${lf("{id:snippets}list")}.shift()`,
            attributes: {
                weight: 48,
                jsDoc: lf("Removes and returns the value at the front of an Array"),
                advanced: true
            }
        },
        {
            name: "unshift",
            snippet: `${lf("{id:snippets}list")}.unshift(0)`,
            attributes: {
                weight: 47,
                jsDoc: lf("Inserts a value at the beginning of an Array"),
                advanced: true
            }
        },
        {
            name: "indexOf",
            snippet: `["A", "B", "C"].indexOf("B")`,
            attributes: {
                weight: 46,
                jsDoc: lf("Returns the first index in the Array that contains the given value or -1 if it does not exist in the Array"),
                advanced: true
            },
            retType: "number"
        },
        {
            name: "reverse",
            snippet: `${lf("{id:snippets}list")}.reverse()`,
            attributes: {
                weight: 45,
                jsDoc: lf("Reverses the contents of an Array"),
                advanced: true
            }
        },
    ],
    attributes: {
        advanced: true,
        color: pxt.blocks.blockColors["arrays"].toString(),
        icon: "arrays",
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        paramDefl: {}
    }
}

export const functions: BuiltinCategoryDefinition = {
    name: lf("{id:category}Functions"),
    nameid: 'functions',
    blocks: [
        {
            name: "function doSomething",
            snippet: `function doSomething() {\n\n}`,
            attributes: {
                jsDoc: lf("Define a function")
            }
        },
        {
            name: "doSomething",
            snippet: `doSomething()`,
            attributes: {
                jsDoc: lf("Call a function")
            }
        },
    ],
    attributes: {
        advanced: true,
        callingConvention: ts.pxtc.ir.CallingConvention.Plain,
        color: pxt.blocks.blockColors["functions"].toString(),
        icon: "functions",
        paramDefl: {}
    }
};

export function getBuiltinCategory(ns: string) {
        switch (ns) {
            case loops.nameid: return loops;
            case logic.nameid: return logic;
            case variables.nameid: return variables;
            case maths.nameid: return maths;
            case text.nameid: return text;
            case arrays.nameid: return arrays;
            case functions.nameid: return functions;
        }
    return undefined;
}

export function isBuiltin(ns: string) {
    switch (ns) {
        case loops.nameid:
        case logic.nameid:
        case variables.nameid:
        case maths.nameid:
        case text.nameid:
        case arrays.nameid:
        case functions.nameid:
            return true;
    }
    return false;
}

export function overrideCategory(ns: string, def: pxt.editor.MonacoToolboxCategoryDefinition) {
    const cat = getBuiltinCategory(ns);
    if (def && cat) {
        if (def.name) {
            cat.name = def.name;
        }

        if (def.weight !== undefined) {
            cat.attributes.weight = def.weight;
        }

        if (def.advanced !== undefined) {
            cat.attributes.advanced = def.advanced;
        }

        if (def.removed !== undefined) {
            cat.removed = def.removed;
        }

        if (def.blocks) {
            let currentWeight = 100;
            if (def.appendBlocks) {
                currentWeight = 50;
                def.blocks.forEach((b, i) => {
                    if (b.weight) {
                        currentWeight = b.weight;
                    }
                    else {
                        currentWeight --;
                    }

                    const blk = {
                        name: b.name,
                        snippet: b.snippet,
                        snippetOnly: b.snippetOnly,
                        attributes: {
                            weight: currentWeight,
                            advanced: b.advanced,
                            jsDoc: b.jsDoc,
                            group: b.group,
                        },
                        noNamespace: true,
                        retType: b.retType
                    }
                    cat.blocks.push(blk);
                });
            } else {
                cat.blocks = def.blocks.map((b, i) => {
                    if (b.weight) {
                        currentWeight = b.weight;
                    }
                    else {
                        currentWeight --;
                    }

                    return {
                        name: b.name,
                        snippet: b.snippet,
                        snippetOnly: b.snippetOnly,
                        attributes: {
                            weight: currentWeight,
                            advanced: b.advanced,
                            jsDoc: b.jsDoc,
                            group: b.group,
                        },
                        noNamespace: true,
                        retType: b.retType
                    }
                });
            }
        }
    }
}

export function overrideToolbox(def: pxt.editor.MonacoToolboxDefinition) {
    overrideCategory(loops.nameid, def.loops);
    overrideCategory(logic.nameid, def.logic);
    overrideCategory(variables.nameid, def.variables);
    overrideCategory(maths.nameid, def.maths);
    overrideCategory(text.nameid, def.text);
    overrideCategory(arrays.nameid, def.arrays);
    overrideCategory(functions.nameid, def.functions);
}
