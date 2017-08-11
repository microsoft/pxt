/// <reference path="main.ts"/>

namespace pxt.blocks {
    export interface BlockParameter {
        name: string;
        type?: string;
        shadowType?: string;
        shadowValue?: string;
    }

    export function normalizeBlock(b: string): string {
        if (!b) return b;
        // normalize and validate common errors
        // made while translating
        let nb = b.replace(/%\s+/g, '%');
        if (nb != b) {
            pxt.log(`block has extra spaces: ${b}`);
            return b;
        }
        nb = nb.replace(/\s*\|\s*/g, '|');
        return nb;
    }

    export function parameterNames(fn: pxtc.SymbolInfo): Map<BlockParameter> {
        // collect blockly parameter name mapping
        const instance = (fn.kind == ts.pxtc.SymbolKind.Method || fn.kind == ts.pxtc.SymbolKind.Property) && !fn.attributes.defaultInstance;
        let attrNames: Map<BlockParameter> = {};

        if (instance) attrNames["this"] = { name: "this", type: fn.namespace };
        if (fn.parameters)
            fn.parameters.forEach(pr => attrNames[pr.name] = {
                name: pr.name,
                type: pr.type,
                shadowValue: pr.default || undefined
            });
        if (fn.attributes.block) {
            Object.keys(attrNames).forEach(k => attrNames[k].name = "");
            let rx = /%([a-zA-Z0-9_]+)(=([a-zA-Z0-9_]+))?/g;
            let m: RegExpExecArray;
            let i = 0;
            while (m = rx.exec(fn.attributes.block)) {
                if (i == 0 && instance) {
                    attrNames["this"].name = m[1];
                    if (m[3]) attrNames["this"].shadowType = m[3];
                    m = rx.exec(fn.attributes.block); if (!m) break;
                }

                let at = attrNames[fn.parameters[i++].name];
                at.name = m[1];
                if (m[3]) at.shadowType = m[3];
            }
        }
        return attrNames;
    }


    export interface FieldDescription {
        n: string;
        pre?: string;
        p?: string;
        ni: number;
    }

    export function parseFields(b: string): FieldDescription[] {
        // normalize and validate common errors
        // made while translating
        return b.split('|').map((n, ni) => {
            let m = /([^%]*)\s*%([a-zA-Z0-9_]+)/.exec(n);
            if (!m) return { n, ni };

            let pre = m[1]; if (pre) pre = pre.trim();
            let p = m[2];
            return { n, ni, pre, p };
        });
    }

    export interface BlockDefinition {
        name: string;
        category: string;
        url: string;
        tooltip?: string | Map<string>;
        operators?: Map<string[]>;
        block?: Map<string>;
        blockTextSearch?: string; // Which block text to use for searching; if undefined, search uses all texts in BlockDefinition.block, joined with space
        tooltipSearch?: string; // Which tooltip to use for searching; if undefined, search uses all tooltips in BlockDefinition.tooltip, joined with space
    }

    let _blockDefinitions: Map<BlockDefinition>;
    export function blockDefinitions(): Map<BlockDefinition> {
        if (!_blockDefinitions) cacheBlockDefinitions();
        return _blockDefinitions;
    }

    export function getBlockDefinition(blockId: string): BlockDefinition {
        if (!_blockDefinitions) cacheBlockDefinitions();
        return _blockDefinitions[blockId];
    }

    // Resources for built-in and extra blocks
    function cacheBlockDefinitions(): void {
        _blockDefinitions = {
            'device_while': {
                name: Util.lf("a loop that repeats while the condition is true"),
                tooltip: Util.lf("Run the same sequence of actions while the condition is met."),
                url: '/blocks/loops/while',
                category: 'loops',
                block: {
                    message0: Util.lf("while %1"),
                    appendField: Util.lf("{id:while}do")
                }
            },
            'controls_simple_for': {
                name: Util.lf("a loop that repeats the number of times you say"),
                tooltip: Util.lf("Have the variable '{0}' take on the values from 0 to the end number, counting by 1, and do the specified blocks."), // The name of the iteration variable that goes in {0} is replaced in blocklyloader
                url: 'blocks/loops/for',
                category: 'loops',
                block: {
                    message0: Util.lf("for %1 from 0 to %2"),
                    variable: Util.lf("{id:var}index"),
                    appendField: Util.lf("{id:for}do")
                }
            },
            'controls_for_of': {
                name: Util.lf("a loop that repeats for each value in an array"),
                tooltip: Util.lf("Have the variable '{0}' take the value of each item in the array one by one, and do the specified blocks."), // The name of the iteration variable that goes in {0} is replaced in blocklyloader
                url: 'blocks/loops/for-of',
                category: 'loops',
                block: {
                    message0: Util.lf("for element %1 of %2"),
                    variable: Util.lf("{id:var}value"),
                    appendField: Util.lf("{id:for_of}do")
                }
            },
            'math_op2': {
                name: Util.lf("minimum or maximum of 2 numbers"),
                tooltip: {
                    "min": Util.lf("smaller value of 2 numbers"),
                    "max": Util.lf("larger value of 2 numbers")
                },
                url: '/blocks/math',
                operators: {
                    'op': ["min", "max"]
                },
                category: 'math'
            },
            'math_op3': {
                name: Util.lf("absolute number"),
                tooltip: Util.lf("absolute value of a number"),
                url: '/blocks/math/abs',
                category: 'math',
                block: {
                    message0: Util.lf("absolute of %1")
                }
            },
            'math_number': {
                name: Util.lf("{id:block}number"),
                url: '/blocks/math/random',
                category: 'math'
            },
            'math_number_minmax': {
                name: Util.lf("{id:block}number"),
                url: '/blocks/math/random',
                category: 'math'
            },
            'math_arithmetic': {
                name: Util.lf("arithmetic operation"),
                url: '/blocks/math',
                tooltip: {
                    ADD: Util.lf("Return the sum of the two numbers."),
                    MINUS: Util.lf("Return the difference of the two numbers."),
                    MULTIPLY: Util.lf("Return the product of the two numbers."),
                    DIVIDE: Util.lf("Return the quotient of the two numbers."),
                    POWER: Util.lf("Return the first number raised to the power of the second number."),
                },
                operators: {
                    'OP': ["ADD", "MINUS", "MULTIPLY", "DIVIDE", "POWER"]
                },
                category: 'math',
                block: {
                    MATH_ADDITION_SYMBOL: Util.lf("{id:op}+"),
                    MATH_SUBTRACTION_SYMBOL: Util.lf("{id:op}-"),
                    MATH_MULTIPLICATION_SYMBOL: Util.lf("{id:op}×"),
                    MATH_DIVISION_SYMBOL: Util.lf("{id:op}÷"),
                    MATH_POWER_SYMBOL: Util.lf("{id:op}^")
                }
            },
            'math_modulo': {
                name: Util.lf("division remainder"),
                tooltip: Util.lf("Return the remainder from dividing the two numbers."),
                url: '/blocks/math',
                category: 'math',
                block: {
                    MATH_MODULO_TITLE: Util.lf("remainder of %1 ÷ %2")
                }
            },
            'variables_change': {
                name: Util.lf("update the value of a number variable"),
                tooltip: Util.lf("Changes the value of the variable by this amount"),
                url: '/blocks/variables/change',
                category: 'variables',
                block: {
                    message0: Util.lf("change %1 by %2")
                }
            },
            'controls_repeat_ext': {
                name: Util.lf("a loop that repeats and increments an index"),
                tooltip: Util.lf("Do some statements several times."),
                url: '/blocks/loops/repeat',
                category: 'loops',
                block: {
                    CONTROLS_REPEAT_TITLE: Util.lf("repeat %1 times"),
                    CONTROLS_REPEAT_INPUT_DO: Util.lf("{id:repeat}do")
                }
            },
            'variables_get': {
                name: Util.lf("get the value of a variable"),
                tooltip: Util.lf("Returns the value of this variable."),
                url: '/blocks/variables',
                category: 'variables',
                block: {
                    VARIABLES_GET_CREATE_SET: Util.lf("Create 'set %1'")
                }
            },
            'variables_set': {
                name: Util.lf("assign the value of a variable"),
                tooltip: Util.lf("Sets this variable to be equal to the input."),
                url: '/blocks/variables/assign',
                category: 'variables',
                block: {
                    VARIABLES_SET: Util.lf("set %1 to %2")
                }
            },
            'controls_if': {
                name: Util.lf("a conditional statement"),
                tooltip: {
                    CONTROLS_IF_TOOLTIP_1: Util.lf("If a value is true, then do some statements."),
                    CONTROLS_IF_TOOLTIP_2: Util.lf("If a value is true, then do the first block of statements. Otherwise, do the second block of statements."),
                    CONTROLS_IF_TOOLTIP_3: Util.lf("If the first value is true, then do the first block of statements. Otherwise, if the second value is true, do the second block of statements."),
                    CONTROLS_IF_TOOLTIP_4: Util.lf("If the first value is true, then do the first block of statements. Otherwise, if the second value is true, do the second block of statements. If none of the values are true, do the last block of statements.")
                },
                tooltipSearch: "CONTROLS_IF_TOOLTIP_2",
                url: '/blocks/logic/if',
                category: 'logic',
                block: {
                    CONTROLS_IF_MSG_IF: Util.lf("{id:logic}if"),
                    CONTROLS_IF_MSG_THEN: Util.lf("{id:logic}then"),
                    CONTROLS_IF_MSG_ELSE: Util.lf("{id:logic}else"),
                    CONTROLS_IF_MSG_ELSEIF: Util.lf("{id:logic}else if")
                }
            },
            'lists_create_with': {
                name: Util.lf("create an array"),
                tooltip: Util.lf("Creates a new array."),
                url: '/blocks/arrays/create',
                category: 'arrays',
                blockTextSearch: "LISTS_CREATE_WITH_INPUT_WITH",
                block: {
                    LISTS_CREATE_EMPTY_TITLE: Util.lf("create empty array"),
                    LISTS_CREATE_WITH_INPUT_WITH: Util.lf("create array with"),
                    LISTS_CREATE_WITH_CONTAINER_TITLE_ADD: Util.lf("array"),
                    LISTS_CREATE_WITH_ITEM_TITLE: Util.lf("value")
                }
            },
            'lists_length': {
                name: Util.lf("array length"),
                tooltip: Util.lf("Returns the number of items in an array."),
                url: '/blocks/arrays/length',
                category: 'arrays',
                block: {
                    LISTS_LENGTH_TITLE: Util.lf("length of array %1")
                }
            },
            'lists_index_get': {
                name: Util.lf("get a value in an array"),
                tooltip: Util.lf("Returns the value at the given index in an array."),
                url: '/blocks/arrays/get',
                category: 'arrays',
                block: {
                    message0: Util.lf("%1 get value at %2")
                }
            },
            'lists_index_set': {
                name: Util.lf("set a value in an array"),
                tooltip: Util.lf("Sets the value at the given index in an array"),
                url: '/blocks/arrays/set',
                category: 'arrays',
                block: {
                    message0: Util.lf("%1 set value at %2 to %3")
                }
            },
            'logic_compare': {
                name: Util.lf("comparing two numbers"),
                tooltip: {
                    LOGIC_COMPARE_TOOLTIP_EQ: Util.lf("Return true if both inputs equal each other."),
                    LOGIC_COMPARE_TOOLTIP_NEQ: Util.lf("Return true if both inputs are not equal to each other."),
                    LOGIC_COMPARE_TOOLTIP_LT: Util.lf("Return true if the first input is smaller than the second input."),
                    LOGIC_COMPARE_TOOLTIP_LTE: Util.lf("Return true if the first input is smaller than or equal to the second input."),
                    LOGIC_COMPARE_TOOLTIP_GT: Util.lf("Return true if the first input is greater than the second input."),
                    LOGIC_COMPARE_TOOLTIP_GTE: Util.lf("Return true if the first input is greater than or equal to the second input.")
                },
                url: '/blocks/logic/boolean',
                category: 'logic',
                block: {
                    search: "= ≠ < ≤ > ≥" // Only used for search; this string is not surfaced in the block's text
                }
            },
            'logic_operation': {
                name: Util.lf("boolean operation"),
                tooltip: {
                    LOGIC_OPERATION_TOOLTIP_AND: Util.lf("Return true if both inputs are true."),
                    LOGIC_OPERATION_TOOLTIP_OR: Util.lf("Return true if at least one of the inputs is true.")
                },
                url: '/blocks/logic/boolean',
                category: 'logic',
                block: {
                    LOGIC_OPERATION_AND: Util.lf("{id:op}and"),
                    LOGIC_OPERATION_OR: Util.lf("{id:op}or")
                }
            },
            'logic_negate': {
                name: Util.lf("logical negation"),
                tooltip: Util.lf("Returns true if the input is false. Returns false if the input is true."),
                url: '/blocks/logic/boolean',
                category: 'logic',
                block: {
                    LOGIC_NEGATE_TITLE: Util.lf("not %1")
                }
            },
            'logic_boolean': {
                name: Util.lf("a `true` or `false` value"),
                tooltip: Util.lf("Returns either true or false."),
                url: '/blocks/logic/boolean',
                category: 'logic',
                block: {
                    LOGIC_BOOLEAN_TRUE: Util.lf("{id:boolean}true"),
                    LOGIC_BOOLEAN_FALSE: Util.lf("{id:boolean}false")
                }
            },
            'text': {
                name: Util.lf("a piece of text"),
                tooltip: Util.lf("A letter, word, or line of text."),
                url: 'types/string',
                category: 'text',
                block: {
                    search: Util.lf("a piece of text") // Only used for search; this string is not surfaced in the block's text
                }
            },
            'text_length': {
                name: Util.lf("number of characters in the string"),
                tooltip: Util.lf("Returns the number of letters (including spaces) in the provided text."),
                url: 'types/string/length',
                category: 'text',
                block: {
                    TEXT_LENGTH_TITLE: Util.lf("length of text %1")
                }
            },
            'text_join': {
                name: Util.lf("join items to create text"),
                tooltip: Util.lf("Create a piece of text by joining together any number of items."),
                url: 'types/string/join',
                category: 'text',
                block: {
                    TEXT_JOIN_TITLE_CREATEWITH: Util.lf("join")
                }
            },
            'procedures_defnoreturn': {
                name: Util.lf("define the function"),
                tooltip: Util.lf("Create a function."),
                url: 'types/function/define',
                category: 'functions',
                block: {
                    PROCEDURES_DEFNORETURN_TITLE: Util.lf("function"),
                    PROCEDURE_ALREADY_EXISTS: Util.lf("A function named '%1' already exists.")
                }
            },
            'procedures_callnoreturn': {
                name: Util.lf("call the function"),
                tooltip: Util.lf("Call the user-defined function."),
                url: 'types/function/call',
                category: 'functions',
                block: {
                    PROCEDURES_CALLNORETURN_TITLE: Util.lf("call function")
                }
            }
        };
        _blockDefinitions[pxtc.ON_START_TYPE] = {
            name: Util.lf("on start event"),
            tooltip: Util.lf("Run code when the program starts"),
            url: '/blocks/on-start',
            category: "loops", // The real category is overriden by apptarget in blocklyloader.ts
            block: {
                message0: Util.lf("on start %1 %2")
            }
        };
    }
}
