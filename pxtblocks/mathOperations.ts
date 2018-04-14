namespace pxt.blocks {
    const allOperations = pxt.blocks.MATH_FUNCTIONS.unary.concat(pxt.blocks.MATH_FUNCTIONS.binary);

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

                // Because the number of inputs changes, we need a mutation. Technically the op tells us
                // how many inputs we should have but we can't read its value at init time
                appendMutation(b, {
                    mutationToDom: mutation => {
                        mutation.setAttribute("op-type", ((b as any).getInput("ARG1", true) ? "binary" : "unary").toString());
                        return mutation;
                    },
                    domToMutation: saved => {
                        if (saved.hasAttribute("op-type")) {
                            if (saved.getAttribute("op-type") == "binary") {
                                addArgInput(b, true);
                            }
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
            else if (!((b as any).getInput("ARG1"))) {
                addArgInput(b, true);
            }
        }

        function addArgInput(b: Blockly.Block, second: boolean) {
            const i = b.appendValueInput("ARG" + (second ? 1 : 0));
            i.setCheck("Number");
            if (second) {
                (i.connection as any).setShadowDom(numberShadowDom());
                (i.connection as any).respawnShadow_();
            }
        }
    }

    function isUnaryOp(op: string) {
        return pxt.blocks.MATH_FUNCTIONS.unary.indexOf(op) !== -1;
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