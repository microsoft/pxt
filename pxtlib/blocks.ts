/// <reference path="main.ts"/>

namespace pxt.blocks {
    const THIS_NAME = "this";

    // The JS Math functions supported in the blocks. The order of this array
    // determines the order of the dropdown in the math_js_op block
    export const MATH_FUNCTIONS = {
        unary: ["sqrt", "sin", "cos", "tan"],
        binary: ["atan2"],
        infix: ["idiv", "imul"]
    };

    // Like MATH_FUNCTIONS, but used only for rounding operations
    export const ROUNDING_FUNCTIONS = ["round", "ceil", "floor", "trunc"];

    export interface BlockParameter {
        // Declared parameter name as it appears in the code. This is the name used
        // when customizing the field in the comment attributes
        // For example: actualName.fieldEditor="gridpicker"
        actualName: string;

        // Declared parameter type as it appears in the code
        type?: string;

        // Parameter name as it appears in the block string. This is the name that
        // gets used for the input/field in the Blockly block
        definitionName: string;

        // Shadow block ID specified in the block string (if present)
        shadowBlockId?: string;

        // Default value for this parameter in the toolbox
        defaultValue?: string;

        // Indicates whether this field is always visible or collapsible
        isOptional?: boolean;

        // Field editor for this parameter (field is on the parent block).
        // taken from the API's comment attributes
        // For example: parameterName.fieldEditor="gridpicker"
        fieldEditor?: string;

        // Options for a field editor for this parameter (field is on the parent block)
        // taken from the API's comment attributes
        // For example: parameterName.fieldOptions.columns=5
        fieldOptions?: Map<string>;

        // Options for a field editor on a shadow block (field is on the child block)
        // taken from the API's comment attributes
        // For example: parameterName.shadowOptions.columns=5
        shadowOptions?: Map<string>;

        // The max and min for numerical inputs (if specified)
        range?: { min: number, max: number };
    }

    export interface BlockCompileInfo {
        parameters: ReadonlyArray<BlockParameter>;
        actualNameToParam: Map<BlockParameter>;
        definitionNameToParam: Map<BlockParameter>;

        handlerArgs?: HandlerArg[];
        thisParameter?: BlockParameter;
    }

    export interface HandlerArg {
        name: string,
        type: string,
        inBlockDef: boolean
    }

    // Information for blocks that compile to function calls but are defined by vanilla Blockly
    // and not dynamically by BlocklyLoader
    export const builtinFunctionInfo: pxt.Map<{ params: string[]; blockId: string; }> = {
        "Math.abs": { blockId: "math_op3", params: ["x"] },
        "Math.min": { blockId: "math_op2", params: ["x", "y"] },
        "Math.max": { blockId: "math_op2", params: ["x", "y"] }
    };

    export function normalizeBlock(b: string, err: (msg: string) => void = pxt.log): string {
        if (!b) return b;
        // normalize and validate common errors
        // made while translating
        let nb = b.replace(/[^\\]%\s+/g, '%');
        if (nb != b) {
            err(`block has extra spaces: ${b}`);
            return b;
        }

        // remove spaces around %foo = ==> %foo=
        b = nb;
        nb = b.replace(/(%\w+)\s*=\s*(\w+)/, '$1=$2');
        if (nb != b) {
            err(`block has space between %name and = : ${b}`)
            b = nb;
        }

        // remove spaces before after pipe
        nb = nb.replace(/\s*\|\s*/g, '|');
        return nb;
    }

    export function compileInfo(fn: pxtc.SymbolInfo): BlockCompileInfo {
        const res: BlockCompileInfo = {
            parameters: [],
            actualNameToParam: {},
            definitionNameToParam: {},
            handlerArgs: []
        };

        const instance = (fn.kind == ts.pxtc.SymbolKind.Method || fn.kind == ts.pxtc.SymbolKind.Property) && !fn.attributes.defaultInstance;
        const hasBlockDef = !!fn.attributes._def;
        const defParameters = hasBlockDef ? fn.attributes._def.parameters.slice(0) : undefined;
        const optionalStart = hasBlockDef ? defParameters.length : (fn.parameters ? fn.parameters.length : 0);
        const bInfo = builtinFunctionInfo[fn.qName];

        if (hasBlockDef && fn.attributes._expandedDef) {
            defParameters.push(...fn.attributes._expandedDef.parameters);
        }

        const refMap: Map<pxtc.BlockParameter> = {};

        const definitionsWithoutRefs = defParameters ? defParameters.filter(p => {
            if (p.ref) {
                refMap[p.name] = p;
                return false;
            }
            return true;
        }) : [];

        if (instance && hasBlockDef && defParameters.length) {
            const def = refMap[THIS_NAME] || defParameters[0];
            const defName = def.name;
            const isVar = !def.shadowBlockId || def.shadowBlockId === "variables_get";
            res.thisParameter = {
                actualName: THIS_NAME,
                definitionName: defName,
                shadowBlockId: def.shadowBlockId,
                type: fn.namespace,
                defaultValue: isVar ? def.varName : undefined,

                // Normally we pass ths actual parameter name, but the "this" parameter doesn't have one
                fieldEditor: fieldEditor(defName, THIS_NAME),
                fieldOptions: fieldOptions(defName, THIS_NAME),
                shadowOptions: shadowOptions(defName, THIS_NAME),
            };
        }

        if (fn.parameters) {
            let defIndex = (instance && !refMap[THIS_NAME]) ? 1 : 0;
            fn.parameters.forEach((p, i) => {
                let def: pxtc.BlockParameter;

                if (refMap[p.name]) {
                    def = refMap[p.name];
                }
                else if (defIndex < definitionsWithoutRefs.length) {
                    def = definitionsWithoutRefs[defIndex];
                    ++defIndex;
                }

                if (def || !hasBlockDef) {
                    let range: { min: number, max: number } = undefined;
                    if (p.options && p.options["min"] && p.options["max"]) {
                        range = { min: p.options["min"].value, max: p.options["max"].value };
                    }

                    const defName = def ? def.name : (bInfo ? bInfo.params[defIndex++] : p.name);
                    const isVar = (def && def.shadowBlockId) === "variables_get";

                    (res.parameters as BlockParameter[]).push({
                        actualName: p.name,
                        type: p.type,
                        defaultValue: isVar ? (def.varName || p.default) : p.default,
                        definitionName: defName,
                        shadowBlockId: def && def.shadowBlockId,
                        isOptional: defParameters ? defParameters.indexOf(def) >= optionalStart : false,
                        fieldEditor: fieldEditor(defName, p.name),
                        fieldOptions: fieldOptions(defName, p.name),
                        shadowOptions: shadowOptions(defName, p.name),
                        range
                    });
                }

                if (p.handlerParameters) {
                    p.handlerParameters.forEach(arg => {
                        res.handlerArgs.push({
                            name: arg.name,
                            type: arg.type,
                            inBlockDef: defParameters ? defParameters.some(def => def.ref && def.name === arg.name) : false
                        });
                    })
                }
            });
        }

        res.parameters.forEach(p => {
            res.actualNameToParam[p.actualName] = p;
            res.definitionNameToParam[p.definitionName] = p;
        });

        return res;

        function fieldEditor(defName: string, actualName: string) {
            return fn.attributes.paramFieldEditor &&
                (fn.attributes.paramFieldEditor[defName] || fn.attributes.paramFieldEditor[actualName]);
        }

        function fieldOptions(defName: string, actualName: string) {
            return fn.attributes.paramFieldEditorOptions &&
                (fn.attributes.paramFieldEditorOptions[defName] || fn.attributes.paramFieldEditorOptions[actualName]);
        }

        function shadowOptions(defName: string, actualName: string) {
            return fn.attributes.paramShadowOptions &&
                (fn.attributes.paramShadowOptions[defName] || fn.attributes.paramShadowOptions[actualName]);
        }
    }

    /**
     * Returns which Blockly block type to use for an argument reporter based
     * on the specified TypeScript type.
     * @param varType The variable's TypeScript type
     * @return The Blockly block type of the reporter to be used
     */
    export function reporterTypeForArgType(varType: string) {
        let reporterType = "argument_reporter_custom";

        if (varType === "boolean" || varType === "number" || varType === "string") {
            reporterType = `argument_reporter_${varType}`;
        }

        return reporterType;
    }

    export function defaultIconForArgType(typeName: string = "") {
        switch (typeName) {
            case "number":
                return "calculator";
            case "string":
                return "text width";
            case "boolean":
                return "random";
            default:
                return "align justify"
        }
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
            'pxt_controls_for': {
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
            'pxt_controls_for_of': {
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
                url: '/reference/math',
                category: 'math',
                block: {
                    message0: Util.lf("absolute of %1")
                }
            },
            'math_number': {
                name: Util.lf("{id:block}number"),
                url: '/blocks/math/random',
                category: 'math',
                tooltip: (pxt.appTarget && pxt.appTarget.compile) ?
                    Util.lf("a decimal number") : Util.lf("an integer number")
            },
            'math_integer': {
                name: Util.lf("{id:block}number"),
                url: '/blocks/math/random',
                category: 'math',
                tooltip: Util.lf("an integer number")
            },
            'math_whole_number': {
                name: Util.lf("{id:block}number"),
                url: '/blocks/math/random',
                category: 'math',
                tooltip: Util.lf("a whole number")
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
                    MATH_POWER_SYMBOL: Util.lf("{id:op}**")
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
            'math_js_op': {
                name: Util.lf("math function"),
                tooltip: {
                    "sqrt": Util.lf("Returns the square root of the argument"),
                    "sin": Util.lf("Returns the sine of the argument"),
                    "cos": Util.lf("Returns the cosine of the argument"),
                    "tan": Util.lf("Returns the tangent of the argument"),
                    "atan2": Util.lf("Returns the arctangent of the quotient of the two arguments"),
                    "idiv": Util.lf("Returns the integer portion of the division operation on the two arguments"),
                    "imul": Util.lf("Returns the integer portion of the multiplication operation on the two arguments")
                },
                url: '/blocks/math',
                operators: {
                    'OP': ["sqrt", "sin", "cos", "tan", "atan2", "idiv", "imul"]
                },
                category: 'math',
                block: {
                    "sqrt": Util.lf("{id:op}square root"),
                    "sin": Util.lf("{id:op}sin"),
                    "cos": Util.lf("{id:op}cos"),
                    "tan": Util.lf("{id:op}tan"),
                    "atan2": Util.lf("{id:op}atan2"),
                    "idiv": Util.lf("{id:op}integer ÷"),
                    "imul": Util.lf("{id:op}integer ×"),
                }
            },
            "math_js_round": {
                name: Util.lf("rounding functions"),
                tooltip: {
                    "round": Util.lf("Increases the argument to the next higher whole number if its fractional part is more than one half"),
                    "ceil": Util.lf("Increases the argument to the next higher whole number"),
                    "floor": Util.lf("Decreases the argument to the next lower whole number"),
                    "trunc": Util.lf("Removes the fractional part of the argument")
                },
                url: '/blocks/math',
                operators: {
                    "OP": ["round", "ceil", "floor", "trunc"]
                },
                category: 'math',
                block: {
                    "round": Util.lf("{id:op}round"),
                    "ceil": Util.lf("{id:op}ceiling"),
                    "floor": Util.lf("{id:op}floor"),
                    "trunc": Util.lf("{id:op}truncate"),
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
            'variables_get_reporter': {
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
                url: '/reference/arrays/create',
                category: 'arrays',
                blockTextSearch: "LISTS_CREATE_WITH_INPUT_WITH",
                block: {
                    LISTS_CREATE_EMPTY_TITLE: Util.lf("empty array"),
                    LISTS_CREATE_WITH_INPUT_WITH: Util.lf("array of"),
                    LISTS_CREATE_WITH_CONTAINER_TITLE_ADD: Util.lf("array"),
                    LISTS_CREATE_WITH_ITEM_TITLE: Util.lf("value")
                }
            },
            'lists_length': {
                name: Util.lf("array length"),
                tooltip: Util.lf("Returns the number of items in an array."),
                url: '/reference/arrays/length',
                category: 'arrays',
                block: {
                    LISTS_LENGTH_TITLE: Util.lf("length of array %1")
                }
            },
            'lists_index_get': {
                name: Util.lf("get a value in an array"),
                tooltip: Util.lf("Returns the value at the given index in an array."),
                url: '/reference/arrays/get',
                category: 'arrays',
                block: {
                    message0: Util.lf("%1 get value at %2")
                }
            },
            'lists_index_set': {
                name: Util.lf("set a value in an array"),
                tooltip: Util.lf("Sets the value at the given index in an array"),
                url: '/reference/arrays/set',
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
                url: 'reference/text/length',
                category: 'text',
                block: {
                    TEXT_LENGTH_TITLE: Util.lf("length of %1")
                }
            },
            'text_join': {
                name: Util.lf("join items to create text"),
                tooltip: Util.lf("Create a piece of text by joining together any number of items."),
                url: 'reference/text/join',
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
            },
            'function_definition': {
                name: Util.lf("define the function"),
                tooltip: Util.lf("Create a function."),
                url: 'types/function/define',
                category: 'functions',
                block: {
                    FUNCTIONS_EDIT_OPTION: Util.lf("Edit Function")
                }
            },
            'function_call': {
                name: Util.lf("call the function"),
                tooltip: Util.lf("Call the user-defined function."),
                url: 'types/function/call',
                category: 'functions',
                block: {
                    FUNCTIONS_CALL_TITLE: Util.lf("call")
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
        _blockDefinitions[pxtc.PAUSE_UNTIL_TYPE] = {
            name: Util.lf("pause until"),
            tooltip: Util.lf("Pause execution of code until the given boolean expression is true"),
            url: '/blocks/pause-until',
            category: "loops", // The real category is overriden by apptarget in blocklyloader.ts
            block: {
                message0: Util.lf("pause until %1")
            }
        };
    }
}
