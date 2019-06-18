/// <reference path="../localtypings/blockly.d.ts" />

declare namespace Blockly.Xml {
    function domToBlock(xml: Element, workspace: Blockly.Workspace): Blockly.Block;
}

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

    export function initVariableArgsBlock(b: Blockly.Block, handlerArgs: pxt.blocks.HandlerArg[]) {
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
                    const varField = b.getField("HANDLER_" + handlerArgs[j].name);
                    let varName = varField && varField.getText();
                    el.setAttribute("arg" + j, varName);
                }

                return el;
            },
            domToMutation: (saved: Element) => {
                let numArgs = parseInt(saved.getAttribute("numargs"));
                currentlyVisible = Math.min(isNaN(numArgs) ? 0 : numArgs, handlerArgs.length);

                updateShape();

                for (let j = 0; j < currentlyVisible; j++) {
                    const varName = saved.getAttribute("arg" + j);
                    const fieldName = "HANDLER_" + handlerArgs[j].name;
                    if (b.getField(fieldName)) {
                        setVarFieldValue(b, fieldName, varName);
                    }
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

    export function initExpandableBlock(info: pxtc.BlocksInfo, b: Blockly.Block, def: pxtc.ParsedBlockDef, comp: BlockCompileInfo, toggle: boolean, addInputs: () => void) {
        // Add numbers before input names to prevent clashes with the ones added
        // by BlocklyLoader. The number makes it an invalid JS identifier
        const buttonAddName = "0_add_button";
        const buttonRemName = "0_rem_button";
        const numVisibleAttr = "_expanded";
        const inputInitAttr = "_input_init";

        const optionNames = def.parameters.map(p => p.name);
        const totalOptions = def.parameters.length;
        const buttonDelta = toggle ? totalOptions : 1;

        const state = new MutationState(b as MutatingBlock);
        state.setEventsEnabled(false);
        state.setValue(numVisibleAttr, 0);
        state.setValue(inputInitAttr, false);
        state.setEventsEnabled(true);

        let addShown = false;
        let remShown = false;

        Blockly.Extensions.apply('inline-svgs', b, false);

        addPlusButton();

        appendMutation(b, {
            mutationToDom: (el: Element) => {
                // The reason we store the inputsInitialized variable separately from visibleOptions
                // is because it's possible for the block to get into a state where all inputs are
                // initialized but they aren't visible (i.e. the user hit the - button). Blockly
                // gets upset if a block has a different number of inputs when it is saved and restored.
                el.setAttribute(numVisibleAttr, state.getString(numVisibleAttr));
                el.setAttribute(inputInitAttr, state.getString(inputInitAttr));
                return el;
            },
            domToMutation: (saved: Element) => {
                state.setEventsEnabled(false);
                if (saved.hasAttribute(inputInitAttr) && saved.getAttribute(inputInitAttr) == "true" && !state.getBoolean(inputInitAttr)) {
                    state.setValue(inputInitAttr, true)
                    initOptionalInputs();
                }

                if (saved.hasAttribute(numVisibleAttr)) {
                    const val = parseInt(saved.getAttribute(numVisibleAttr));
                    if (!isNaN(val)) {
                        const delta = val - (state.getNumber(numVisibleAttr) || 0);
                        if (state.getBoolean(inputInitAttr)) {
                            if ((b as Blockly.BlockSvg).rendered) {
                                updateShape(delta, true);
                            }
                            else {
                                state.setValue(numVisibleAttr, addDelta(delta));
                            }
                        }
                        else {
                            updateShape(delta, true);
                        }
                    }
                }
                state.setEventsEnabled(true);
            }
        });

        // Blockly only lets you hide an input once it is rendered, so we can't
        // hide the inputs in init() or domToMutation(). This will get executed after
        // the block is rendered
        setTimeout(() => {
            if ((b as Blockly.BlockSvg).rendered && !(b.workspace as Blockly.WorkspaceSvg).isDragging()) {
                updateShape(0, undefined, true);
                updateButtons();
            }
        }, 1);

        // Set skipRender to true if the block is still initializing. Otherwise
        // the inputs will render before their shadow blocks are created and
        // leave behind annoying artifacts
        function updateShape(delta: number, skipRender = false, force = false) {
            const newValue = addDelta(delta);
            if (!force && !skipRender && newValue === state.getNumber(numVisibleAttr)) return;

            state.setValue(numVisibleAttr, newValue);
            const visibleOptions = newValue;

            if (!state.getBoolean(inputInitAttr) && visibleOptions > 0) {
                initOptionalInputs();
                if (!(b as Blockly.BlockSvg).rendered) {
                    return;
                }
            }

            let optIndex = 0
            for (let i = 0; i < b.inputList.length; i++) {
                const input = b.inputList[i];
                if (Util.startsWith(input.name, optionalDummyInputPrefix)) {
                    // The behavior for dummy inputs (i.e. labels) is that whenever a parameter is revealed,
                    // all earlier labels are made visible as well. If the parameter is the last one in the
                    // block then all labels are made visible
                    setInputVisible(input, optIndex < visibleOptions || visibleOptions === totalOptions);
                }
                else if (Util.startsWith(input.name, optionalInputWithFieldPrefix) || optionNames.indexOf(input.name) !== -1) {
                    const visible = optIndex < visibleOptions;
                    setInputVisible(input, visible);
                    if (visible && input.connection && !(input.connection as any).isConnected() && !b.isInsertionMarker()) {
                        const param = comp.definitionNameToParam[def.parameters[optIndex].name];
                        let shadow = createShadowValue(info, param);

                        if (shadow.tagName.toLowerCase() === "value") {
                            // Unwrap the block
                            shadow = shadow.firstElementChild;
                        }

                        Blockly.Events.disable();

                        const nb = Blockly.Xml.domToBlock(shadow, b.workspace);
                        if (nb) {
                            input.connection.connect(nb.outputConnection);
                        }

                        Blockly.Events.enable();
                    }
                    ++optIndex;
                }
            }

            updateButtons();
            if (!skipRender) (b as Blockly.BlockSvg).render();
        }

        function addButton(name: string, uri: string, alt: string, delta: number) {
            b.appendDummyInput(name)
            .appendField(new Blockly.FieldImage(uri, 24, 24, false, alt, () => updateShape(delta)))
        }

        function updateButtons() {
            const visibleOptions = state.getNumber(numVisibleAttr);
            const showAdd = visibleOptions !== totalOptions;
            const showRemove = visibleOptions !== 0;

            if (!showAdd) {
                addShown = false;
                b.removeInput(buttonAddName, true);
            }
            if (!showRemove) {
                remShown = false;
                b.removeInput(buttonRemName, true);
            }

            if (showRemove && !remShown) {
                if (addShown) {
                    b.removeInput(buttonAddName, true);
                    addMinusButton();
                    addPlusButton();
                }
                else {
                    addMinusButton();
                }
            }

            if (showAdd && !addShown) {
                addPlusButton();
            }
        }

        function addPlusButton() {
            addShown = true;
            addButton(buttonAddName, (b as any).ADD_IMAGE_DATAURI, lf("Reveal optional arguments"), buttonDelta);
        }

        function addMinusButton() {
            remShown = true;
            addButton(buttonRemName, (b as any).REMOVE_IMAGE_DATAURI, lf("Hide optional arguments"), -1 * buttonDelta);
        }

        function initOptionalInputs() {
            state.setValue(inputInitAttr, true);
            addInputs();
            updateButtons();
        }

        function addDelta(delta: number) {
            return Math.min(Math.max(state.getNumber(numVisibleAttr) + delta, 0), totalOptions);
        }

        function setInputVisible(input: Blockly.Input, visible: boolean) {
            // If the block isn't rendered, Blockly will crash
            if ((b as Blockly.BlockSvg).rendered) {
                let renderList = input.setVisible(visible);
                renderList.forEach((block: Blockly.BlockSvg) => {
                    block.render();
                });
            }
        }
    }

    class MutationState {
        private state: pxt.Map<string>;
        private fireEvents = true;

        constructor(public block: MutatingBlock, initState?: pxt.Map<string>) {
            this.state = initState || {};
        }

        setValue(attr: string, value: boolean | number | string) {
            if (this.fireEvents && this.block.mutationToDom) {
                const oldMutation = this.block.mutationToDom();
                this.state[attr] = value.toString();
                const newMutation = this.block.mutationToDom();

                Object.keys(this.state).forEach(key => {
                    if (oldMutation.getAttribute(key) !== this.state[key]) {
                        newMutation.setAttribute(key, this.state[key]);
                    }
                });

                const oldText = Blockly.Xml.domToText(oldMutation);
                const newText = Blockly.Xml.domToText(newMutation);

                if (oldText != newText) {
                    Blockly.Events.fire(new Blockly.Events.BlockChange(this.block, "mutation", null, oldText, newText));
                }
            }
            else {
                this.state[attr] = value.toString();
            }
        }

        getNumber(attr: string) {
            return parseInt(this.state[attr]);
        }

        getBoolean(attr: string) {
            return this.state[attr] != "false";
        }

        getString(attr: string) {
            return this.state[attr];
        }

        setEventsEnabled(enabled: boolean) {
            this.fireEvents = enabled;
        }
    }
}