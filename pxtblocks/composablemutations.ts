namespace pxt.blocks {
    export interface ComposableMutation {
        // Set to save mutations. Should return an XML element
        mutationToDom(mutationElement: Element): Element;
        // Set to restore mutations from save
        domToMutation(savedElement: Element): void;
    }

    export function appendMutation(block: Blockly.Block, mutation: ComposableMutation) {
        const b = block as MutatingBlock;
        
        const oldMTD = b.mutationToDom;
        const oldDTM = b.domToMutation;

        b.mutationToDom = () => {
            const el = oldMTD ? oldMTD() : document.createElement("mutation");
            return mutation.mutationToDom(el);
        };

        b.domToMutation = saved => {
            if (oldDTM) {
                oldDTM(saved);
            }
            mutation.domToMutation(saved);
        }
    }

    export function initVariableArgsBlock(b: B.Block, handlerArgs: pxt.blocks.HandlerArg[]) {
        let currentlyVisible = 0;
        let actuallyVisible = 0;

        let i = b.appendDummyInput();

        let updateShape = () => {
            if (currentlyVisible === actuallyVisible) {
                return;
            }

            if (currentlyVisible > actuallyVisible) {
                const diff = currentlyVisible - actuallyVisible;
                for (let j = 0; j < diff; j++) {
                    const arg = handlerArgs[actuallyVisible + j];
                    i.insertFieldAt(i.fieldRow.length - 1, new Blockly.FieldVariable(arg.name), "HANDLER_" + arg.name);
                }
            }
            else {
                let diff = actuallyVisible - currentlyVisible;
                for (let j = 0; j < diff; j++) {
                    const arg = handlerArgs[actuallyVisible - j - 1];
                    i.removeField("HANDLER_" + arg.name);
                }
            }

            if (currentlyVisible >= handlerArgs.length) {
                i.removeField("_HANDLER_ADD");
            }
            else if (actuallyVisible >= handlerArgs.length) {
                addPlusButton();
            }

            actuallyVisible = currentlyVisible;
        };

        Blockly.Extensions.apply('inline-svgs', b, false);
        addPlusButton();

        appendMutation(b, {
            mutationToDom: (el: Element) => {
                el.setAttribute("numArgs", currentlyVisible.toString());
    
                for (let j = 0; j < currentlyVisible; j++) {
                    let varName = b.getFieldValue("HANDLER_" + handlerArgs[j].name);
                    el.setAttribute("arg" + j, varName);
                }
    
                return el;
            },
            domToMutation: (saved: Element) => {
                let numArgs = parseInt(saved.getAttribute("numargs"));
                currentlyVisible = Math.min(isNaN(numArgs) ? 0 : numArgs, handlerArgs.length);
    
                updateShape();
    
                for (let j = 0; j < currentlyVisible; j++) {
                    let varName = saved.getAttribute("arg" + j);
                    b.setFieldValue(varName, "HANDLER_" + handlerArgs[j].name);
                }
            }
        });

        function addPlusButton() {
            i.appendField(new Blockly.FieldImage((b as any).ADD_IMAGE_DATAURI, 24, 24, false, lf("Add argument"),
                () => {
                    currentlyVisible = Math.min(currentlyVisible + 1, handlerArgs.length);
                    updateShape();
                }), "_HANDLER_ADD");
        }
    }

    export function initExpandableBlock(b: Blockly.Block, def: pxtc.ParsedBlockDef) {
        const BUTTON_ID = "__expanded_button";
        let expanded: boolean;
        let expandedNames = def.parameters.map(p => p.name);

        b.appendDummyInput(BUTTON_ID)
        Blockly.Extensions.apply('inline-svgs', b, false);
        updateShape(false);

        appendMutation(b, {
            mutationToDom: (el: Element) => {
                el.setAttribute("_expanded", expanded ? "true" : "false");
                return el;
            },
            domToMutation: (saved: Element) => {
                updateShape(saved.hasAttribute("_expanded") && saved.getAttribute("_expanded") == "true");
            }
        });

        function updateShape(expand: boolean) {
            if (expanded === expand) {
                return;
            }
            expanded = expand;
            
            if (expand) {
                b.inputList.filter(i => Util.startsWith(i.name, "_expanded_") || expandedNames.indexOf(i.name) !== -1).forEach(i => {
                    i.setVisible(true);
                });

                b.removeInput(BUTTON_ID);
                b.appendDummyInput(BUTTON_ID)
                    .appendField(new Blockly.FieldImage((b as any).REMOVE_IMAGE_DATAURI, 24, 24, false, lf("Hide optional arguments"), () => updateShape(false)));
            }
            else {
                b.inputList.filter(i => Util.startsWith(i.name, "_expanded_") || expandedNames.indexOf(i.name) !== -1).forEach(i => {
                    i.setVisible(false);
                });

                b.removeInput(BUTTON_ID);
                b.appendDummyInput(BUTTON_ID)
                    .appendField(new Blockly.FieldImage((b as any).ADD_IMAGE_DATAURI, 24, 24, false, lf("Reveal optional arguments"), () => updateShape(true)));
            }
        }
    }
}