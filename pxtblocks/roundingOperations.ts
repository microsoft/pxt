namespace pxt.blocks {
    const allOperations = pxt.blocks.ROUNDING_FUNCTIONS;

    export function initMathRoundBlock() {
        const mathRoundId = "math_js_round";
        const mathRoundDef = pxt.blocks.getBlockDefinition(mathRoundId);
        Blockly.Blocks[mathRoundId] = {
            init: function () {
                const b = this as Blockly.Block;
                b.setPreviousStatement(false);
                b.setNextStatement(false);
                b.setOutput(true, "Number");
                b.setOutputShape(Blockly.OUTPUT_SHAPE_ROUND);
                b.setInputsInline(true);

                const ddi = b.appendDummyInput("round_dropdown")
                ddi.appendField(
                    new Blockly.FieldDropdown(allOperations.map(op => [mathRoundDef.block[op], op]),
                        (op: string) => onOperatorSelect(b, op)),
                    "OP");

                addArgInput(b);
            }
        };

        installHelpResources(
            mathRoundId,
            mathRoundDef.name,
            function (block: Blockly.Block) {
                return (mathRoundDef.tooltip as Map<string>)[block.getFieldValue("OP")];
            },
            mathRoundDef.url,
            pxt.toolbox.getNamespaceColor(mathRoundDef.category)
        );

        function onOperatorSelect(b: Blockly.Block, op: string) {
            // No-op
        }

        function addArgInput(b: Blockly.Block) {
            const i = b.appendValueInput("ARG0");
            i.setCheck("Number");
        }
    }
}