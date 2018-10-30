declare namespace Blockly {
    interface Block {
        moveInputBefore(nameToMove: string, refName: string): void;
        getInput(inputName: string): Blockly.Input;
    }
}

namespace pxt.blocks {
    const allOperations = pxt.blocks.MATH_FUNCTIONS.unary.concat(pxt.blocks.MATH_FUNCTIONS.binary).concat(pxt.blocks.MATH_FUNCTIONS.infix);

    export function initMathOpBlock() {
        const mathOpId = "math_js_op";
        const mathOpDef = pxt.blocks.getBlockDefinition(mathOpId);
        Blockly.Blocks[mathOpId] = {
            init: function () {
                const b = this as Blockly.Block;
                b.setPreviousStatement(false);
                b.setNextStatement(false);
                b.setOutput(true, "Number");
                b.setOutputShape(Blockly.OUTPUT_SHAPE_ROUND);
                b.setInputsInline(true);

                const ddi = b.appendDummyInput("op_dropdown")
                ddi.appendField(
                    new Blockly.FieldDropdown(allOperations.map(op => [mathOpDef.block[op], op]),
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
                return (mathOpDef.tooltip as Map<string>)[block.getFieldValue("OP")];
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
}