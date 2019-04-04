import { BuiltinCategoryDefinition, BlockDefinition, CategoryNameID } from "./toolbox";

import * as blocks from "./blocks";

let _cachedBuiltinCategories: pxt.Map<BuiltinCategoryDefinition> = null;
function cachedBuiltinCategories(): pxt.Map<BuiltinCategoryDefinition> {
    if (!_cachedBuiltinCategories) {
        _cachedBuiltinCategories = {};
        _cachedBuiltinCategories[CategoryNameID.Loops] = {
            name: lf("{id:category}Loops"),
            nameid: CategoryNameID.Loops,
            blocks: [
                {
                    name: "controls_repeat_ext",
                    attributes: {
                        blockId: "controls_repeat_ext",
                        weight: 49
                    },
                    blockXml: `<block type="controls_repeat_ext">
                    <value name="TIMES">
                        <shadow type="math_whole_number">
                            <field name="NUM">4</field>
                        </shadow>
                    </value>
                </block>`
                }, {
                    name: "device_while",
                    attributes: {
                        blockId: "device_while",
                        weight: 48
                    },
                    blockXml: `<block type="device_while">
                    <value name="COND">
                        <shadow type="logic_boolean"></shadow>
                    </value>
                </block>`
                },
                {
                    name: "pxt_controls_for",
                    attributes: {
                        blockId: "pxt_controls_for",
                        weight: 47
                    },
                    blockXml: `<block type="pxt_controls_for">
                    <value name="VAR">
                        <shadow type="variables_get_reporter">
                            <field name="VAR">${lf("{id:var}index")}</field>
                        </shadow>
                    </value>
                    <value name="TO">
                        <shadow type="math_whole_number">
                            <field name="NUM">4</field>
                        </shadow>
                    </value>
                </block>`
                },
                {
                    name: "pxt_controls_for_of",
                    attributes: {
                        blockId: "pxt_controls_for_of",
                        weight: 46
                    },
                    blockXml: `<block type="pxt_controls_for_of">
                    <value name="VAR">
                        <shadow type="variables_get_reporter">
                            <field name="VAR">${lf("{id:var}value")}</field>
                        </shadow>
                    </value>
                    <value name="LIST">
                        <shadow type="variables_get">
                            <field name="VAR">list</field>
                        </shadow>
                    </value>
                </block>`
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
            nameid: CategoryNameID.Logic,
            groups: [lf("Conditionals"), lf("Comparison"), lf("Boolean"), "other"],
            blocks: [
                {
                    name: "controls_if",
                    attributes: {
                        blockId: "controls_if",
                        group: lf("Conditionals"),
                        weight: 49
                    },
                    blockXml: `<block type="controls_if" gap="8">
                    <value name="IF0">
                        <shadow type="logic_boolean">
                            <field name="BOOL">TRUE</field>
                        </shadow>
                    </value>
                </block>`
                }, {
                    name: "controls_if_else",
                    attributes: {
                        blockId: "controls_if",
                        group: lf("Conditionals"),
                        weight: 48
                    },
                    blockXml: `<block type="controls_if" gap="8">
                    <mutation else="1"></mutation>
                    <value name="IF0">
                        <shadow type="logic_boolean">
                            <field name="BOOL">TRUE</field>
                        </shadow>
                    </value>
                </block>`
                }, {
                    name: "logic_compare_eq",
                    attributes: {
                        blockId: "logic_compare",
                        group: lf("Comparison"),
                        weight: 47
                    },
                    blockXml: `<block type="logic_compare" gap="8">
                    <value name="A">
                        <shadow type="math_number">
                            <field name="NUM">0</field>
                        </shadow>
                    </value>
                    <value name="B">
                        <shadow type="math_number">
                            <field name="NUM">0</field>
                        </shadow>
                    </value>
                </block>`
                }, {
                    name: "logic_compare_lt",
                    attributes: {
                        blockId: "logic_compare",
                        group: lf("Comparison"),
                        weight: 46
                    },
                    blockXml: `<block type="logic_compare">
                    <field name="OP">LT</field>
                    <value name="A">
                        <shadow type="math_number">
                            <field name="NUM">0</field>
                        </shadow>
                    </value>
                    <value name="B">
                        <shadow type="math_number">
                            <field name="NUM">0</field>
                        </shadow>
                    </value>
                </block>`
                }, {
                    name: "logic_operation_and",
                    attributes: {
                        blockId: "logic_operation",
                        group: lf("Boolean"),
                        weight: 45
                    },
                    blockXml: `<block type="logic_operation" gap="8">
                    <field name="OP">AND</field>
                </block>`
                }, {
                    name: "logic_operation_or",
                    attributes: {
                        blockId: "logic_operation",
                        group: lf("Boolean"),
                        weight: 44
                    },
                    blockXml: `<block type="logic_operation" gap="8">
                    <field name="OP">OR</field>
                </block>`
                }, {
                    name: "logic_negate",
                    attributes: {
                        blockId: "logic_negate",
                        group: lf("Boolean"),
                        weight: 43
                    },
                    blockXml: `<block type="logic_negate"></block>`
                }, {
                    name: "logic_boolean_true",
                    attributes: {
                        blockId: "logic_boolean",
                        group: lf("Boolean"),
                        weight: 42
                    },
                    blockXml: `<block type="logic_boolean" gap="8">
                    <field name="BOOL">TRUE</field>
                </block>`
                }, {
                    name: "logic_boolean_false",
                    attributes: {
                        blockId: "logic_boolean",
                        group: lf("Boolean"),
                        weight: 41
                    },
                    blockXml: `<block type="logic_boolean">
                    <field name="BOOL">FALSE</field>
                </block>`
                }],
            attributes: {
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                weight: 50.08,
                icon: "logic",
                paramDefl: {}
            }
        };
        _cachedBuiltinCategories[CategoryNameID.Variables] = {
            name: lf("{id:category}Variables"),
            nameid: CategoryNameID.Variables,
            blocks: undefined,
            custom: true,
            customClick: (theEditor: blocks.Editor) => {
                theEditor.showVariablesFlyout();
                return false;
            },
            attributes: {
                weight: 50.07,
                icon: "variables",
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        };
        _cachedBuiltinCategories[CategoryNameID.Maths] = {
            name: lf("{id:category}Math"),
            nameid: CategoryNameID.Maths,
            blocks: [
                {
                    name: "math_arithmetic_ADD",
                    attributes: {
                        blockId: "math_arithmetic",
                        weight: 90
                    },
                    blockXml: `<block type="math_arithmetic" gap="8">
                        <value name="A">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <value name="B">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <field name="OP">ADD</field>
                    </block>`
                }, {
                    name: "math_arithmetic_MINUS",
                    attributes: {
                        blockId: "math_arithmetic",
                        weight: 89
                    },
                    blockXml: `<block type="math_arithmetic" gap="8">
                        <value name="A">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <value name="B">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <field name="OP">MINUS</field>
                    </block>`
                }, {
                    name: "math_arithmetic_TIMES",
                    attributes: {
                        blockId: "math_arithmetic",
                        weight: 88
                    },
                    blockXml: `<block type="math_arithmetic" gap="8">
                        <value name="A">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <value name="B">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <field name="OP">MULTIPLY</field>
                    </block>`
                }, {
                    name: "math_arithmetic_DIVIDE",
                    attributes: {
                        blockId: "math_arithmetic",
                        weight: 87
                    },
                    blockXml: `<block type="math_arithmetic" gap="8">
                        <value name="A">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <value name="B">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <field name="OP">DIVIDE</field>
                    </block>`
                }, {
                    name: "math_number",
                    attributes: {
                        blockId: "math_number",
                        weight: 86
                    },
                    blockXml: `<block type="math_number" gap="8">
                        <field name="NUM">0</field>
                    </block>`
                }, {
                    name: "math_modulo",
                    attributes: {
                        blockId: "math_modulo",
                        weight: 85
                    },
                    blockXml: `<block type="math_modulo">
                        <value name="DIVIDEND">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <value name="DIVISOR">
                            <shadow type="math_number">
                                <field name="NUM">1</field>
                            </shadow>
                        </value>
                    </block>`
                }, {
                    name: "math_op2_min",
                    attributes: {
                        blockId: "math_op2",
                        weight: 84
                    },
                    blockXml: `<block type="math_op2" gap="8">
                        <value name="x">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <value name="y">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <field name="op">min</field>
                    </block>`
                }, {
                    name: "math_op2_max",
                    attributes: {
                        blockId: "math_op2",
                        weight: 83
                    },
                    blockXml: `<block type="math_op2" gap="8">
                        <value name="x">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <value name="y">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <field name="op">max</field>
                    </block>`
                }, {
                    name: "math_op3",
                    attributes: {
                        blockId: "math_op3",
                        weight: 82
                    },
                    blockXml: `<block type="math_op3">
                        <value name="x">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                    </block>`
                }, {
                    name: "math_js_op",
                    attributes: {
                        blockId: "math_js_op",
                        weight: 81
                    },
                    blockXml: `<block type="math_js_op">
                        <field name="OP">sqrt</field>
                        <value name="ARG0">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                    </block>`
                }, {
                    name: "math_js_round",
                    attributes: {
                        blockId: "math_js_round",
                        weight: 80
                    },
                    blockXml: `<block type="math_js_round">
                        <field name="OP">round</field>
                        <value name="ARG0">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                    </block>`
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
            nameid: CategoryNameID.Functions,
            blocks: [],
            custom: true,
            customClick: (theEditor: blocks.Editor) => {
                theEditor.showFunctionsFlyout();
                return false;
            },
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
            nameid: CategoryNameID.Arrays,
            blocks: [
                {
                    name: "lists_create_with",
                    attributes: {
                        blockId: "lists_create_with",
                        weight: 90
                    },
                    blockXml: `<block type="variables_set" gap="8">
                        <field name="VAR" variabletype="">${lf("{id:var}list")}</field>
                        <value name="VALUE">
                            <block type="lists_create_with">
                                <mutation items="2"></mutation>
                                <value name="ADD0">
                                    <shadow type="math_number">
                                        <field name="NUM">1</field>
                                    </shadow>
                                </value>
                                <value name="ADD1">
                                    <shadow type="math_number">
                                        <field name="NUM">2</field>
                                    </shadow>
                                </value>
                            </block>
                        </value>
                    </block>`
                }, {
                    name: "lists_create_with",
                    attributes: {
                        blockId: "lists_create_with",
                        weight: 89
                    },
                    blockXml: `<block type="variables_set">
                        <field name="VAR" variabletype="">${lf("{id:var}text list")}</field>
                        <value name="VALUE">
                            <block type="lists_create_with">
                                <mutation items="3"></mutation>
                                <value name="ADD0">
                                    <shadow type="text">
                                        <field name="TEXT">${lf("a")}</field>
                                    </shadow>
                                </value>
                                <value name="ADD1">
                                    <shadow type="text">
                                        <field name="TEXT">${lf("b")}</field>
                                    </shadow>
                                </value>
                                <value name="ADD2">
                                    <shadow type="text">
                                        <field name="TEXT">${lf("c")}</field>
                                    </shadow>
                                </value>
                            </block>
                        </value>
                    </block>`
                }, {
                    name: "lists_create_with",
                    attributes: {
                        blockId: "lists_create_with",
                        weight: 5
                    },
                    blockXml: `<block type="lists_create_with">
                        <mutation items="0"></mutation>
                    </block>`
                },
                {
                    name: "lists_index_get",
                    attributes: {
                        blockId: "lists_index_get",
                        weight: 87
                    },
                    blockXml: `<block type="lists_index_get">
                        <value name="LIST">
                            <block type="variables_get">
                                <field name="VAR">${lf("{id:var}list")}</field>
                            </block>
                        </value>
                        <value name="INDEX">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                    </block>`
                },
                {
                    name: "lists_index_set",
                    attributes: {
                        blockId: "lists_index_set",
                        weight: 86
                    },
                    blockXml: `<block type="lists_index_set">
                        <value name="INDEX">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                        <value name="LIST">
                            <block type="variables_get">
                                <field name="VAR">${lf("{id:var}list")}</field>
                            </block>
                        </value>
                    </block>`
                },
                {
                    name: "lists_length",
                    attributes: {
                        blockId: "lists_length",
                        weight: 88
                    },
                    blockXml: `<block type="lists_length">
                        <value name="VALUE">
                            <block type="variables_get">
                                <field name="VAR">${lf("{id:var}list")}</field>
                            </block>
                        </value>
                    </block>`
                }
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
            nameid: CategoryNameID.Text,
            blocks: [
                {
                    name: "text",
                    attributes: {
                        blockId: "text",
                        weight: 90
                    },
                    blockXml: `<block type="text"></block>`
                }, {
                    name: "text_length",
                    attributes: {
                        blockId: "text_length",
                        weight: 89
                    },
                    blockXml: `<block type="text_length">
                        <value name="VALUE">
                            <shadow type="text">
                                <field name="TEXT">${lf("Hello")}</field>
                            </shadow>
                        </value>
                    </block>`
                }, {
                    name: "text_join",
                    attributes: {
                        blockId: "text_join",
                        weight: 88
                    },
                    blockXml: `<block type="text_join">
                        <mutation items="2"></mutation>
                        <value name="ADD0">
                            <shadow type="text">
                                <field name="TEXT">${lf("Hello")}</field>
                            </shadow>
                        </value>
                        <value name="ADD1">
                            <shadow type="text">
                                <field name="TEXT">${lf("World")}</field>
                            </shadow>
                        </value>
                    </block>`
                }
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
            nameid: CategoryNameID.Extensions,
            blocks: [],
            custom: true,
            customClick: (theEditor: blocks.Editor) => {
                theEditor.closeFlyout();
                theEditor.showPackageDialog();
                return true;
            },
            attributes: {
                advanced: true,
                weight: -1,
                icon: 'addpackage',
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        };
    }
    return _cachedBuiltinCategories;
}

let pauseUntil: BlockDefinition;

export function getPauseUntil() {
    if (pauseUntil) return pauseUntil;
    const opts = pxt.appTarget.runtime && pxt.appTarget.runtime.pauseUntilBlock;

    if (opts) {
        pauseUntil = {
            name: pxtc.PAUSE_UNTIL_TYPE,

            attributes: {
                blockId: pxtc.PAUSE_UNTIL_TYPE,
                blockNamespace: opts.category || "loops",
                weight: opts.weight == null ? 0 : opts.weight
            },
            blockXml: Blockly.Xml.domToText(pxt.blocks.mkPredicateBlock(pxtc.PAUSE_UNTIL_TYPE))
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

let builtinBlockCache: pxt.Map<BlockDefinition>;
export function allBuiltinBlocks() {
    if (!builtinBlockCache) {
        builtinBlockCache = {};
        [
            getBuiltinCategory(CategoryNameID.Loops),
            getBuiltinCategory(CategoryNameID.Logic),
            getBuiltinCategory(CategoryNameID.Maths),
            getBuiltinCategory(CategoryNameID.Text),
            getBuiltinCategory(CategoryNameID.Arrays)
        ].forEach(builtin => {
            builtin.blocks.forEach(block => {
                if (block.attributes.blockId && !builtinBlockCache[block.attributes.blockId]) {
                    builtinBlockCache[block.attributes.blockId] = block;
                }
            })
        })
    }
    // Add on start built in block
    builtinBlockCache[ts.pxtc.ON_START_TYPE] = {
        name: ts.pxtc.ON_START_TYPE,
        attributes: {
            blockId: ts.pxtc.ON_START_TYPE,
            weight: pxt.appTarget.runtime.onStartWeight || 10
        },
        blockXml: `<block type="pxt-on-start"></block>`
    };
    // Add pause until built in block
    const pauseUntil = getPauseUntil();
    if (pauseUntil) {
        builtinBlockCache[pxtc.PAUSE_UNTIL_TYPE] = pauseUntil;
    }
    return builtinBlockCache;
}

export function clearBuiltinBlockCache() {
    builtinBlockCache = undefined;
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
        snippetName: b.snippetName,
        snippetOnly: b.snippetOnly,
        pySnippet: b.pySnippet,
        pySnippetName: b.pySnippetName,
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
        snippetName: b.snippetName,
        pySnippet: b.pySnippet,
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
