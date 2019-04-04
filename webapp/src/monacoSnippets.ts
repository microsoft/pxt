import { BuiltinCategoryDefinition, BlockDefinition, CategoryNameID } from "./toolbox";

import * as monaco from "./monaco";

let _cachedBuiltinCategories: pxt.Map<BuiltinCategoryDefinition> = null;
function cachedBuiltinCategories(): pxt.Map<BuiltinCategoryDefinition> {
    if (!_cachedBuiltinCategories) {
        _cachedBuiltinCategories = {};
        _cachedBuiltinCategories[CategoryNameID.Loops] = {
            name: lf("{id:category}Loops"),
            nameid: 'loops',
            blocks: [
                {
                    name: "loops_while",
                    snippetName: "while",
                    snippet: `while(true) {\n\n}`,
                    pySnippet: `while True:\n  pass`,
                    attributes: {
                        blockId: 'device_while',
                        weight: 48,
                        jsDoc: lf("Repeat code while condition is true")
                    }
                },
                {
                    name: "loops_for",
                    snippetName: "for",
                    snippet: `for(let i = 0; i < 5; i++) {\n\n}`,
                    pySnippet: `for i in range(0, 4):\n  pass`,
                    attributes: {
                        blockId: 'pxt_controls_for',
                        weight: 47,
                        jsDoc: lf("Repeat code a number of times in a loop")
                    }
                }
            ],
            attributes: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                icon: "loops",
                weight: 50.09,
                paramDefl: {}
            }
        };
        _cachedBuiltinCategories[CategoryNameID.Logic] = {
            name: lf("{id:category}Logic"),
            nameid: 'logic',
            blocks: [
                {
                    name: "logic_if",
                    snippetName: "if",
                    snippet: `if (true) {\n\n}`,
                    pySnippet: `if True:\n  pass`,
                    attributes: {
                        blockId: 'controls_if',
                        weight: 49,
                        jsDoc: lf("Runs code if the condition is true")
                    }
                },
                {
                    name: "logic_if_else",
                    snippetName: "if",
                    snippet: `if (true) {\n\n} else {\n\n}`,
                    pySnippet: `if True:\n  pass\nelse:\n  pass`,
                    attributes: {
                        blockId: 'controls_if',
                        weight: 48,
                        jsDoc: lf("Runs code if the condition is true; else run other code")
                    }
                },
                {
                    name: "logic_switch",

                    snippetName: "switch",
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
                }
            ],
            attributes: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                weight: 50.08,
                icon: "logic",
                paramDefl: {}
            }
        };
        _cachedBuiltinCategories[CategoryNameID.Variables] = {
            name: lf("{id:category}Variables"),
            nameid: 'variables',
            blocks: [
                {
                    name: "var_let",
                    snippetName: "let",
                    snippet: `let item: number`,
                    snippetOnly: true,
                    attributes: {
                        blockId: 'variables_set',
                        jsDoc: lf("Declares a variable named 'item'")
                    }
                },
                {
                    name: "var_equals",
                    snippetName: "equals",
                    snippet: `item = 0`,
                    pySnippet: `item = 0`,
                    snippetOnly: true,
                    attributes: {
                        blockId: 'variables_get',
                        jsDoc: lf("Assigns a value to a variable")
                    }
                },
                {
                    name: "var_change",
                    snippetName: "change",
                    snippet: `item += 1`,
                    pySnippet: `item += 1`,
                    snippetOnly: true,
                    attributes: {
                        blockId: 'variables_change',
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
        _cachedBuiltinCategories[CategoryNameID.Maths] = {
            name: lf("{id:category}Math"),
            // Unlike the other categories, this namespace is actually capitalized in
            // the source so the nameid must be capitalized also
            nameid: 'Math',
            blocks: [
                {
                    name: "Math.plus",
                    snippetName: "plus",
                    snippet: `1 + 1`,
                    pySnippet: `1 + 1`,
                    snippetOnly: true,
                    attributes: {
                        weight: 90,
                        blockId: "math_arithmetic",
                        jsDoc: lf("Adds two numbers together")
                    },
                    retType: "number"
                },
                {
                    name: "Math.minus",
                    snippetName: "minus",
                    snippet: `1 - 1`,
                    pySnippet: `1 - 1`,
                    snippetOnly: true,
                    attributes: {
                        weight: 89,
                        blockId: "math_arithmetic",
                        jsDoc: lf("Subtracts the value of one number from another")
                    },
                    retType: "number"
                },
                {
                    name: "Math.multiply",
                    snippetName: "multiply",
                    snippet: `1 * 1`,
                    pySnippet: `1 * 1`,
                    snippetOnly: true,
                    attributes: {
                        weight: 88,
                        blockId: "math_arithmetic",
                        jsDoc: lf("Multiplies two numbers together")
                    },
                    retType: "number"
                },
                {
                    name: "Math.divide",
                    snippetName: "divide",
                    snippet: `1 / 1`,
                    pySnippet: `1 / 1`,
                    snippetOnly: true,
                    attributes: {
                        weight: 87,
                        blockId: "math_arithmetic",
                        jsDoc: lf("Returns the quotient of one number divided by another")
                    },
                    retType: "number"
                },
                {
                    name: "Math.remainder",
                    snippetName: "remainder",
                    snippet: `1 % 2`,
                    pySnippet: `1 % 2`,
                    snippetOnly: true,
                    attributes: {
                        weight: 80,
                        blockId: "math_modulo",
                        jsDoc: lf("Returns the remainder of one number divided by another")
                    },
                    retType: "number"
                },
                {
                    name: "Math.max",
                    snippetName: "max",
                    snippet: `Math.max(1, 2)`,
                    pySnippet: `max(1, 2)`,
                    attributes: {
                        weight: 75,
                        blockId: "math_op2",
                        jsDoc: lf("Returns the largest of two numbers")
                    },
                    retType: "number"
                },
                {
                    name: "Math.min",
                    snippetName: "min",
                    snippet: `Math.min(1, 2)`,
                    pySnippet: `min(1, 2)`,
                    attributes: {
                        weight: 74,
                        blockId: "math_op2",
                        jsDoc: lf("Returns the smallest of two numbers")
                    },
                    retType: "number"
                },
                {
                    name: "Math.abs",
                    snippetName: "abs",
                    snippet: `Math.abs(-1)`,
                    pySnippet: `abs(-1)`,
                    attributes: {
                        weight: 70,
                        blockId: "math_op3",
                        jsDoc: lf("Returns the absolute value of a number")
                    },
                    retType: "number"
                },
                {
                    name: "Math.randomRange",
                    snippetName: "randomRange",
                    snippet: `Math.randomRange(0, 10)`,
                    attributes: {
                        weight: 65,
                        jsDoc: lf("Returns a random number between min and max")
                    },
                    retType: "number"
                }
            ],
            attributes: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                weight: 50.06,
                icon: "math",
                paramDefl: {}
            }
        };
        _cachedBuiltinCategories[CategoryNameID.Functions] = {
            name: lf("{id:category}Functions"),
            nameid: 'functions',
            blocks: [
                {
                    name: "functionDef",
                    snippetName: "function doSomething",
                    snippet: `function doSomething() {\n\n}`,
                    pySnippetName: "def do_something",
                    pySnippet: `def do_something():\n  pass`,
                    attributes: {
                        blockId: 'procedures_defnoreturn',
                        jsDoc: lf("Define a function")
                    }
                },
                {
                    name: "functionCall",
                    snippetName: "doSomething",
                    snippet: `doSomething()`,
                    pySnippetName: "do_something",
                    pySnippet: `do_something()`,
                    attributes: {
                        blockId: 'procedures_callnoreturn',
                        jsDoc: lf("Call a function")
                    }
                },
            ],
            attributes: {
                advanced: true,
                weight: 50.08,
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                icon: "functions",
                paramDefl: {}
            }
        };
        _cachedBuiltinCategories[CategoryNameID.Arrays] = {
            name: lf("{id:category}Arrays"),
            nameid: "arrays",
            custom: true,
            blocks: [
                {
                    name: "array_create",
                    snippetName: "create",
                    snippet: `let ${lf("{id:snippets}list")} = [1, 2, 3];`,
                    pySnippet: `${lf("{id:snippets}list")} = [1, 2, 3]`,
                    snippetOnly: true,
                    attributes: {
                        weight: 100,
                        blockId: "lists_create_with",
                        jsDoc: lf("Creates a new Array")
                    },
                    retType: "array"
                },
                {
                    name: "array_length",
                    snippetName: "length",
                    snippet: `${lf("{id:snippets}list")}.length`,
                    pySnippetName: "len",
                    pySnippet: `len(${lf("{id:snippets}list")})`,
                    snippetOnly: true,
                    attributes: {
                        weight: 99,
                        blockId: "lists_length",
                        jsDoc: lf("Returns the number of values in an Array")
                    },
                    retType: "number"
                },
                {
                    name: "array_get",
                    snippetName: "get",
                    snippet: `${lf("{id:snippets}list")}[0]`,
                    pySnippet: `${lf("{id:snippets}list")}[0]`,
                    snippetOnly: true,
                    attributes: {
                        weight: 98,
                        blockId: "lists_index_get",
                        jsDoc: lf("Returns the value in the Array at the given index")
                    }
                },
                {
                    name: "array_set",
                    snippetName: "set",
                    snippet: `${lf("{id:snippets}list")}[0] = 1`,
                    pySnippet: `${lf("{id:snippets}list")}[0] = 1`,
                    snippetOnly: true,
                    attributes: {
                        weight: 97,
                        blockId: "lists_index_set",
                        jsDoc: lf("Overwrites the value in an Array at the given index")
                    }
                },
                {
                    name: "array_push",
                    snippetName: "push",
                    snippet: `${lf("{id:snippets}list")}.push(1)`,
                    pySnippetName: "append",
                    pySnippet: `${lf("{id:snippets}list")}.append(1)`,
                    attributes: {
                        weight: 96,
                        blockId: "array_push",
                        jsDoc: lf("Adds a value to the end of an Array")
                    }
                },
                {
                    name: "arary_pop",
                    snippetName: "pop",
                    snippet: `${lf("{id:snippets}list")}.pop()`,
                    pySnippetName: "pop",
                    pySnippet: `${lf("{id:snippets}list")}.pop()`,
                    attributes: {
                        weight: 95,
                        blockId: "array_pop",
                        jsDoc: lf("Removes and returns the value at the end of an Array")
                    },
                    retType: "object"
                },
                {
                    name: "array_insertAt",
                    snippetName: "insertAt",
                    snippet: `${lf("{id:snippets}list")}.insertAt(0, 0)`,
                    pySnippetName: "insert",
                    pySnippet: `${lf("{id:snippets}list")}.insert(0, 0)`,
                    attributes: {
                        weight: 50,
                        blockId: "array_insertAt",
                        jsDoc: lf("Inserts a value into the Array at the given index"),
                        advanced: true
                    }
                },
                {
                    name: "array_removeAt",
                    snippetName: "removeAt",
                    snippet: `${lf("{id:snippets}list")}.removeAt(0)`,
                    attributes: {
                        weight: 49,
                        blockId: "array_removeat",
                        jsDoc: lf("Removes a value from the Array at the given index and returns it"),
                        advanced: true
                    },
                    retType: "object"
                },
                {
                    name: "array_shift",
                    snippetName: "shift",
                    snippet: `${lf("{id:snippets}list")}.shift()`,
                    attributes: {
                        weight: 48,
                        blockId: "array_shift",
                        jsDoc: lf("Removes and returns the value at the front of an Array"),
                        advanced: true
                    }
                },
                {
                    name: "array_unshift",
                    snippetName: "unshift",
                    snippet: `${lf("{id:snippets}list")}.unshift(0)`,
                    pySnippetName: "append",
                    pySnippet: `${lf("{id:snippets}list")}.append(0)`,
                    attributes: {
                        weight: 47,
                        blockId: "array_unshift",
                        jsDoc: lf("Inserts a value at the beginning of an Array"),
                        advanced: true
                    }
                },
                {
                    name: "array_indexOf",
                    snippetName: "indexOf",
                    snippet: `[0, 1, 2].indexOf(1)`,
                    pySnippetName: "index",
                    pySnippet: `[0, 1, 2].index(1)`,
                    attributes: {
                        weight: 46,
                        jsDoc: lf("Returns the first index in the Array that contains the given value or -1 if it does not exist in the Array"),
                        advanced: true
                    },
                    retType: "number"
                },
                {
                    name: "array_reverse",
                    snippetName: "reverse",
                    snippet: `${lf("{id:snippets}list")}.reverse()`,
                    pySnippet: `${lf("{id:snippets}list")}.reverse()`,
                    attributes: {
                        weight: 45,
                        jsDoc: lf("Reverses the contents of an Array"),
                        advanced: true
                    }
                },
            ],
            attributes: {
                advanced: true,
                weight: 50.07,
                icon: "arrays",
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        };
        _cachedBuiltinCategories[CategoryNameID.Text] = {
            name: lf("{id:category}Text"),
            nameid: 'text',
            custom: true,
            blocks: [
                {
                    name: "text_length",
                    snippetName: "length",
                    snippet: `"".length`,
                    pySnippetName: "len",
                    pySnippet: `len("")`,
                    snippetOnly: true,
                    attributes: {
                        blockId: 'text_length',
                        jsDoc: lf("Returns the number of characters in a string")
                    },
                    retType: "number"
                },
                {
                    name: "text_concat",
                    snippetName: "concat",
                    snippet: `"" + 5`,
                    pySnippet: `"" + 5`,
                    snippetOnly: true,
                    attributes: {
                        blockId: 'text_join',
                        jsDoc: lf("Combines a string with a number, boolean, string, or other object into one string")
                    },
                    retType: "string"
                },
                {
                    name: "text_compare",
                    snippetName: "compare",
                    snippet: `"".compare("")`,
                    attributes: {
                        blockId: 'string_compare',
                        jsDoc: lf("Compares one string against another alphabetically and returns a number")
                    },
                    retType: "number"
                },
                {
                    name: "text_parseInt",
                    snippetName: "parseInt",
                    snippet: `parseInt("5")`,
                    attributes: {
                        blockId: 'string_parseint',
                        jsDoc: lf("Converts a number written as text into a number")
                    },
                    retType: "number"
                },
                {
                    name: "text_substr",
                    snippetName: "substr",
                    snippet: `"".substr(0, 0)`,
                    attributes: {
                        blockId: 'string_substr',
                        jsDoc: lf("Returns the part of a string starting at a given index with the given length")
                    },
                    retType: "string"
                },
                {
                    name: "text_charAt",
                    snippetName: "charAt",
                    snippet: `"".charAt(0)`,
                    attributes: {
                        blockId: 'string_get',
                        jsDoc: lf("Returns the character at the given index")
                    },
                    retType: "string"
                },
            ],
            attributes: {
                advanced: true,
                weight: 50.06,
                icon: "text",
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        };
        _cachedBuiltinCategories[CategoryNameID.Extensions] = {
            name: pxt.toolbox.addPackageTitle(),
            nameid: 'addpackage',
            blocks: [],
            custom: true,
            customClick: (theEditor: monaco.Editor) => {
                theEditor.closeFlyout();
                theEditor.showPackageDialog();
                return true;
            },
            attributes: {
                advanced: true,
                weight: -1,
                icon: "addpackage",
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        };
    };
    return _cachedBuiltinCategories;
}

let pauseUntil: BlockDefinition;

export function getPauseUntil() {
    if (pauseUntil) return pauseUntil;
    const opts = pxt.appTarget.runtime && pxt.appTarget.runtime.pauseUntilBlock;

    if (opts) {
        const callName = opts.callName || "pauseUntil";
        let snippet = `${callName}(() => true)`;
        if (opts.namespace) {
            snippet = `${opts.namespace}.${snippet}`
        }

        pauseUntil = {
            name: 'pause_until',
            snippetName: callName,
            snippet,
            attributes: {
                blockNamespace: opts.category || "loops",
                weight: opts.weight == null ? 0 : opts.weight,
                jsDoc: lf("Pause execution of code until the given boolean expression is true"),
                advanced: false
            }
        };
    }

    return pauseUntil;
}

export function getBuiltinCategory(ns: string) {
    return cachedBuiltinCategories()[ns];
}

export function isBuiltin(ns: string) {
    return !!cachedBuiltinCategories()[ns];
}

let builtinBlockCacheById: pxt.Map<[BlockDefinition, string]>;
let builtinBlockCacheByName: pxt.Map<[BlockDefinition, string]>;
function cacheBuiltInBlocks() {
    if (builtinBlockCacheById) return;
    builtinBlockCacheById = {};
    builtinBlockCacheByName = {};
    [
        getBuiltinCategory(CategoryNameID.Loops),
        getBuiltinCategory(CategoryNameID.Logic),
        getBuiltinCategory(CategoryNameID.Maths),
        getBuiltinCategory(CategoryNameID.Text),
        getBuiltinCategory(CategoryNameID.Arrays),
        getBuiltinCategory(CategoryNameID.Variables),
        getBuiltinCategory(CategoryNameID.Functions)
    ].forEach((builtin => {
        builtin.blocks.forEach(block => {
            if (block.type) return; // Block type is assumed to be empty
            if (!(block as BlockDefinition).snippet) return;
            if (block.attributes.blockId && !builtinBlockCacheById[block.attributes.blockId]) {
                builtinBlockCacheById[block.attributes.blockId] = [block, builtin.nameid];
            }
            if (!builtinBlockCacheByName[block.name]) {
                builtinBlockCacheByName[block.name] = [block, builtin.nameid];
            }
        })
    }))
}

export function allBuiltinBlocks() {
    cacheBuiltInBlocks();
    // Add pause until built in block
    const pauseUntil = getPauseUntil();
    if (pauseUntil) {
        builtinBlockCacheById[pxtc.PAUSE_UNTIL_TYPE] = [pauseUntil, "pause_until"];
    }
    return builtinBlockCacheById;
}

export function allBuiltinBlocksByName() {
    cacheBuiltInBlocks();
    // Add pause until built in block
    const pauseUntil = getPauseUntil();
    if (pauseUntil) {
        builtinBlockCacheByName[pxtc.PAUSE_UNTIL_TYPE] = [pauseUntil, "pause_until"];
    }
    return builtinBlockCacheByName;
}

export function clearBuiltinBlockCache() {
    builtinBlockCacheById = undefined;
    builtinBlockCacheByName = undefined;
}

export function overrideCategory(ns: string, def: pxt.editor.ToolboxCategoryDefinition) {
    const cat = getBuiltinCategory(ns);
    if (def && cat) {
        if (Object.keys(def).length === 0) {
            cat.removed = true;
        }

        if (def.name) {
            cat.name = def.name;
        }

        if (def.icon) {
            cat.attributes.icon = def.icon;
        }

        if (def.weight !== undefined) {
            cat.attributes.weight = def.weight;
        }

        if (def.advanced !== undefined) {
            cat.attributes.advanced = def.advanced;
        }

        if (def.groups != undefined) {
            cat.groups = def.groups;
        }

        if (def.blocks) {
            let currentWeight = 100;
            cat.blocks = def.blocks.map((b, i) => {
                if (b.weight) {
                    currentWeight = b.weight;
                }
                else {
                    currentWeight--;
                }

                return blockFromJson(b, currentWeight);
            });
        }
    }
}

function blockFromJson(b: pxt.editor.ToolboxBlockDefinition, currentWeight?: number): BlockDefinition {
    return {
        name: b.name,
        snippet: b.snippet,
        pySnippet: b.pySnippet,
        snippetName: b.snippetName,
        pySnippetName: b.pySnippetName,
        snippetOnly: b.snippetOnly,
        attributes: {
            blockId: b.blockId,
            weight: currentWeight || b.weight,
            advanced: b.advanced,
            jsDoc: b.jsDoc,
            group: b.group,
        },
        retType: b.retType,
        blockXml: b.blockXml
    }
}

function blockToJson(b: BlockDefinition): pxt.editor.ToolboxBlockDefinition {
    return {
        name: b.name,
        snippet: b.snippet,
        pySnippet: b.pySnippet,
        snippetName: b.snippetName,
        pySnippetName: b.pySnippetName,
        snippetOnly: b.snippetOnly,
        retType: b.retType,
        weight: b.attributes.weight,
        advanced: b.attributes.advanced,
        jsDoc: b.attributes.jsDoc,
        group: b.attributes.group,
        blockXml: b.blockXml,
        blockId: b.attributes.blockId
    }
}

function categoryToJson(c: BuiltinCategoryDefinition): pxt.editor.ToolboxCategoryDefinition {
    return {
        name: c.name,
        icon: c.attributes.icon,
        color: c.attributes.color,
        weight: c.attributes.weight,
        advanced: c.attributes.advanced,
        blocks: (c.blocks) ? c.blocks.map(b => blockToJson(b)) : []
    }
}

export function overrideToolbox(def: pxt.editor.ToolboxDefinition) {
    overrideCategory(CategoryNameID.Loops, def.loops);
    overrideCategory(CategoryNameID.Logic, def.logic);
    overrideCategory(CategoryNameID.Variables, def.variables);
    overrideCategory(CategoryNameID.Maths, def.maths);
    overrideCategory(CategoryNameID.Text, def.text);
    overrideCategory(CategoryNameID.Arrays, def.arrays);
    overrideCategory(CategoryNameID.Functions, def.functions);
}

export function getToolboxDefinition(): pxt.editor.ToolboxDefinition {
    return {
        loops: categoryToJson(getBuiltinCategory(CategoryNameID.Loops)),
        logic: categoryToJson(getBuiltinCategory(CategoryNameID.Logic)),
        variables: categoryToJson(getBuiltinCategory(CategoryNameID.Variables)),
        maths: categoryToJson(getBuiltinCategory(CategoryNameID.Maths)),
        text: categoryToJson(getBuiltinCategory(CategoryNameID.Text)),
        arrays: categoryToJson(getBuiltinCategory(CategoryNameID.Arrays)),
        functions: categoryToJson(getBuiltinCategory(CategoryNameID.Functions))
    }
}
