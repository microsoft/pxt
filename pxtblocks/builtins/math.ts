
/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly"
import { attachCardInfo, installBuiltinHelpInfo, installHelpResources, setBuiltinHelpInfo, setHelpResources } from "../help";
import { provider } from "../constants";
import { appendMutation } from "../composableMutations";
import { FieldDropdown } from "../fields/field_dropdown";

export function initMath(blockInfo: pxtc.BlocksInfo) {
    // math_op2
    const mathOp2Id = "math_op2";
    const mathOp2qName = "Math.min"; // TODO: implement logic so that this changes based on which is used (min or max)
    const mathOp2Def = pxt.blocks.getBlockDefinition(mathOp2Id);
    const mathOp2Tooltips = mathOp2Def.tooltip as pxt.Map<string>;
    Blockly.Blocks[mathOp2Id] = {
        init: function () {
            this.jsonInit({
                "message0": mathOp2Def.block.message0,
                "args0": [
                    {
                        "type": "field_dropdown",
                        "name": "op",
                        "options": [
                            [mathOp2Def.block.optionMin, "min"],
                            [mathOp2Def.block.optionMax, "max"]
                        ]
                    },
                    {
                        "type": "input_value",
                        "name": "x",
                        "check": "Number"
                    },
                    {
                        "type": "input_value",
                        "name": "y",
                        "check": "Number"
                    }
                ],
                "inputsInline": true,
                "output": "Number",
                "outputShape": provider.SHAPES.ROUND,
                "colour": pxt.toolbox.getNamespaceColor('math')
            });

            setHelpResources(this,
                mathOp2Id,
                mathOp2Def.name,
                function (block: any) {
                    return mathOp2Tooltips[block.getFieldValue('op')];
                },
                mathOp2Def.url,
                pxt.toolbox.getNamespaceColor(mathOp2Def.category)
            );

        },
        codeCard: attachCardInfo(blockInfo, mathOp2qName)
    };

    // math_op3
    const mathOp3Id = "math_op3";
    const mathOp3Def = pxt.blocks.getBlockDefinition(mathOp3Id);
    const mathOp3qName = "Math.abs";
    Blockly.Blocks[mathOp3Id] = {
        init: function () {
            this.jsonInit({
                "message0": mathOp3Def.block["message0"],
                "args0": [
                    {
                        "type": "input_value",
                        "name": "x",
                        "check": "Number"
                    }
                ],
                "inputsInline": true,
                "output": "Number",
                "outputShape": provider.SHAPES.ROUND,
                "colour": pxt.toolbox.getNamespaceColor('math')
            });

            setBuiltinHelpInfo(this, mathOp3Id);
        },
        codeCard: attachCardInfo(blockInfo, mathOp3qName)
    };

    // builtin math_number, math_integer, math_whole_number, math_number_minmax
    //XXX Integer validation needed.
    const numberBlocks = ['math_number', 'math_integer', 'math_whole_number', 'math_number_minmax']
    numberBlocks.forEach(num_id => {
        const mInfo = pxt.blocks.getBlockDefinition(num_id);
        installHelpResources(
            num_id,
            mInfo.name,
            mInfo.tooltip,
            mInfo.url,
            "#fff",
            "#fff",
            "#fff",
            // (Blockly as any).Colours.textField,
            // (Blockly as any).Colours.textField,
            // (Blockly as any).Colours.textField
        );
    })

    // builtin math_arithmetic
    const msg = Blockly.Msg;
    const mathArithmeticId = "math_arithmetic";
    const mathArithmeticDef = pxt.blocks.getBlockDefinition(mathArithmeticId);
    const mathArithmeticTooltips = mathArithmeticDef.tooltip as pxt.Map<string>;
    msg.MATH_ADDITION_SYMBOL = mathArithmeticDef.block["MATH_ADDITION_SYMBOL"];
    msg.MATH_SUBTRACTION_SYMBOL = mathArithmeticDef.block["MATH_SUBTRACTION_SYMBOL"];
    msg.MATH_MULTIPLICATION_SYMBOL = mathArithmeticDef.block["MATH_MULTIPLICATION_SYMBOL"];
    msg.MATH_DIVISION_SYMBOL = mathArithmeticDef.block["MATH_DIVISION_SYMBOL"];
    msg.MATH_POWER_SYMBOL = mathArithmeticDef.block["MATH_POWER_SYMBOL"];

    installHelpResources(
        mathArithmeticId,
        mathArithmeticDef.name,
        function (block: any) {
            return mathArithmeticTooltips[block.getFieldValue('OP')];
        },
        mathArithmeticDef.url,
        pxt.toolbox.getNamespaceColor(mathArithmeticDef.category)
    );

    // builtin math_modulo
    const mathModuloId = "math_modulo";
    const mathModuloDef = pxt.blocks.getBlockDefinition(mathModuloId);
    msg.MATH_MODULO_TITLE = mathModuloDef.block["MATH_MODULO_TITLE"];
    installBuiltinHelpInfo(mathModuloId);

    initMathOpBlock();
    initMathRoundBlock();
}



export function initMathOpBlock() {
    const allOperations = pxt.blocks.MATH_FUNCTIONS.unary.concat(pxt.blocks.MATH_FUNCTIONS.binary).concat(pxt.blocks.MATH_FUNCTIONS.infix);
    const mathOpId = "math_js_op";
    const mathOpDef = pxt.blocks.getBlockDefinition(mathOpId);
    Blockly.Blocks[mathOpId] = {
        init: function () {
            const b = this as Blockly.Block;
            b.setPreviousStatement(false);
            b.setNextStatement(false);
            b.setOutput(true, "Number");
            b.setOutputShape(provider.SHAPES.ROUND);
            b.setInputsInline(true);

            const ddi = b.appendDummyInput("op_dropdown")
            ddi.appendField(
                new FieldDropdown(allOperations.map(op => [mathOpDef.block[op], op]),
                    (op: string) => onOperatorSelect(b, op)),
                "OP");

            addArgInput(b, false);

            // Because the shape of inputs changes, we need a mutation. Technically the op tells us
            // how many inputs we should have but we can't read its value at init time
            appendMutation(b, {
                mutationToDom: mutation => {
                    let infix: boolean;
                    for (let i = 0; i < b.inputList.length; i++) {
                        const input = b.inputList[i];
                        if (input.name === "op_dropdown") {
                            infix = false;
                            break;
                        }
                        else if (input.name === "ARG0") {
                            infix = true;
                            break;
                        }
                    }
                    mutation.setAttribute("op-type", (b.getInput("ARG1") ? (infix ? "infix" : "binary") : "unary").toString());
                    return mutation;
                },
                domToMutation: saved => {
                    if (saved.hasAttribute("op-type")) {
                        const type = saved.getAttribute("op-type");
                        if (type != "unary") {
                            addArgInput(b, true);
                        }
                        changeInputOrder(b, type === "infix");
                    }
                }
            });
        }
    };

    installHelpResources(
        mathOpId,
        mathOpDef.name,
        function (block: Blockly.Block) {
            return (mathOpDef.tooltip as pxt.Map<string>)[block.getFieldValue("OP")];
        },
        mathOpDef.url,
        pxt.toolbox.getNamespaceColor(mathOpDef.category)
    );

    function onOperatorSelect(b: Blockly.Block, op: string) {
        if (isUnaryOp(op)) {
            b.removeInput("ARG1", true);
        }
        else if (!b.getInput("ARG1")) {
            addArgInput(b, true);
        }

        changeInputOrder(b, isInfixOp(op));

        return op;
    }

    function addArgInput(b: Blockly.Block, second: boolean) {
        const i = b.appendValueInput("ARG" + (second ? 1 : 0));
        i.setCheck("Number");
        if (second) {
            (i.connection as any).setShadowDom(numberShadowDom());
            (i.connection as any).respawnShadow_();
        }
    }

    function changeInputOrder(b: Blockly.Block, infix: boolean) {
        let hasTwoArgs = !!b.getInput("ARG1");

        if (infix) {
            if (hasTwoArgs) {
                b.moveInputBefore("op_dropdown", "ARG1")
            }
            b.moveInputBefore("ARG0", "op_dropdown");
        }
        else {
            if (hasTwoArgs) {
                b.moveInputBefore("ARG0", "ARG1");
            }
            b.moveInputBefore("op_dropdown", "ARG0");
        }
    }
}

function isUnaryOp(op: string) {
    return pxt.blocks.MATH_FUNCTIONS.unary.indexOf(op) !== -1;
}

function isInfixOp(op: string) {
    return pxt.blocks.MATH_FUNCTIONS.infix.indexOf(op) !== -1;
}

let cachedDom: Element;
function numberShadowDom() {
    // <shadow type="math_number"><field name="NUM">0</field></shadow>
    if (!cachedDom) {
        cachedDom = document.createElement("shadow")
        cachedDom.setAttribute("type", "math_number");
        const field = document.createElement("field");
        field.setAttribute("name", "NUM");
        field.textContent = "0";
        cachedDom.appendChild(field);
    }
    return cachedDom;
}


export function initMathRoundBlock() {
    const allOperations = pxt.blocks.ROUNDING_FUNCTIONS;
    const mathRoundId = "math_js_round";
    const mathRoundDef = pxt.blocks.getBlockDefinition(mathRoundId);
    Blockly.Blocks[mathRoundId] = {
        init: function () {
            const b = this as Blockly.Block;
            b.setPreviousStatement(false);
            b.setNextStatement(false);
            b.setOutput(true, "Number");
            b.setOutputShape(provider.SHAPES.ROUND);
            b.setInputsInline(true);

            const ddi = b.appendDummyInput("round_dropdown")
            ddi.appendField(
                new FieldDropdown(allOperations.map(op => [mathRoundDef.block[op], op])),
                "OP"
            );

            addArgInput(b);
        }
    };

    installHelpResources(
        mathRoundId,
        mathRoundDef.name,
        function (block: Blockly.Block) {
            return (mathRoundDef.tooltip as pxt.Map<string>)[block.getFieldValue("OP")];
        },
        mathRoundDef.url,
        pxt.toolbox.getNamespaceColor(mathRoundDef.category)
    );

    function addArgInput(b: Blockly.Block) {
        const i = b.appendValueInput("ARG0");
        i.setCheck("Number");
    }
}