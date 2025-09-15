/// <reference path="../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { createShadowValue } from "./toolbox";
import { MutatingBlock } from "./legacyMutations";
import { optionalDummyInputPrefix, optionalInputWithFieldPrefix } from "./constants";
import { FieldArgumentVariable } from "./fields";
import { DRAGGABLE_PARAM_INPUT_PREFIX, getBlocklyCheckForType, setVarFieldValue } from "./loader";
import { UpdateBeforeRenderMixin } from "./plugins/renderer";
import { FieldImageNoText } from "./fields/field_imagenotext";
import { setDuplicateOnDrag } from "./plugins/duplicateOnDrag";

export interface ComposableMutation {
    // Set to save mutations. Should return an XML element
    mutationToDom(mutationElement: Element): Element;
    // Set to restore mutations from save
    domToMutation(savedElement: Element): void;
}

export function appendMutation(block: Blockly.Block, mutation: ComposableMutation) {
    const b = block as unknown as MutatingBlock;

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
                i.insertFieldAt(i.fieldRow.length - 1, new FieldArgumentVariable(arg.name), "HANDLER_" + arg.name);
                const blockSvg = b as Blockly.BlockSvg;
                if (blockSvg?.initSvg) blockSvg.initSvg(); // call initSvg on block to initialize new fields
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
        i.appendField(new FieldImageNoText((b as any).ADD_IMAGE_DATAURI, 24, 24, lf("Add argument"),
            () => {
                currentlyVisible = Math.min(currentlyVisible + 1, handlerArgs.length);
                updateShape();
            }, false), "_HANDLER_ADD");
    }
}

export function initExpandableBlock(info: pxtc.BlocksInfo, b: Blockly.Block, def: pxtc.ParsedBlockDef, comp: pxt.blocks.BlockCompileInfo, toggle: boolean, addInputs: () => void) {
    // Add numbers before input names to prevent clashes with the ones added
    // by BlocklyLoader. The number makes it an invalid JS identifier
    const buttonAddName = "0_add_button";
    const buttonRemName = "0_rem_button";
    const buttonAddRemName = "0_add_rem_button";
    const numVisibleAttr = "_expanded";
    const inputInitAttr = "_input_init";

    const optionNames = def.parameters.map(p => p.name);
    const totalOptions = def.parameters.length;
    const buttonDelta = toggle ? totalOptions : 1;
    const variableInlineInputs = info.blocksById[b.type].attributes.inlineInputMode === "variable";
    const inlineInputModeLimit = info.blocksById[b.type].attributes.inlineInputModeLimit || 4;
    const compileHiddenArguments = info.blocksById[b.type].attributes.compileHiddenArguments;
    const breakString = info.blocksById[b.type].attributes.expandableArgumentBreaks;

    let breaks: number[];
    if (breakString) {
        breaks = breakString.split(/[;,]/).map(s => parseInt(s));
    }

    const state = new MutationState(b as unknown as MutatingBlock);
    state.setEventsEnabled(false);
    state.setValue(numVisibleAttr, 0);
    state.setValue(inputInitAttr, false);
    state.setEventsEnabled(true);

    Blockly.Extensions.apply('inline-svgs', b, false);

    let updatingInputs = false;
    let firstRender = true;

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
            }
            initOptionalInputs();

            if (saved.hasAttribute(numVisibleAttr)) {
                const val = parseInt(saved.getAttribute(numVisibleAttr));
                if (!isNaN(val)) {
                    const delta = val - (state.getNumber(numVisibleAttr) || 0);
                    if (state.getBoolean(inputInitAttr)) {
                        if ((b as Blockly.BlockSvg).rendered || b.isInsertionMarker()) {
                            updateShape(delta, true, b.isInsertionMarker());
                        }
                        else {
                            state.setValue(numVisibleAttr, addDelta(delta));
                            updateButtons();
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

    initOptionalInputs();
    if (compileHiddenArguments) {
        // Make sure all inputs have shadow blocks attached
        let optIndex = 0
        for (let i = 0; i < b.inputList.length; i++) {
            const input = b.inputList[i];
            if (pxt.Util.startsWith(input.name, optionalInputWithFieldPrefix) || optionNames.indexOf(input.name) !== -1) {
                if (input.connection && !(input.connection as any).isConnected() && !b.isInsertionMarker()) {
                    const param = comp.definitionNameToParam[def.parameters[optIndex].name];
                    attachShadowBlock(input, param);
                }
                ++optIndex;
            }
        }
    }


    // This is called inside the pxt renderer whenever the block renders
    const mixin: UpdateBeforeRenderMixin = {
        updateBeforeRender: () => {
            if (updatingInputs) return;
            if (firstRender) {
                firstRender = false;
                updatingInputs = true;
                updateShape(0, undefined, true);
                updatingInputs = false;
            }
        }
    };
    b.mixin(mixin);

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
            if (pxt.Util.startsWith(input.name, optionalDummyInputPrefix)) {
                // The behavior for dummy inputs (i.e. labels) is that whenever a parameter is revealed,
                // all earlier labels are made visible as well. If the parameter is the last one in the
                // block then all labels are made visible
                setInputVisible(input, optIndex < visibleOptions || visibleOptions === totalOptions);
            }
            else if (pxt.Util.startsWith(input.name, optionalInputWithFieldPrefix) || optionNames.indexOf(input.name) !== -1) {
                const visible = optIndex < visibleOptions;
                setInputVisible(input, visible);
                if (visible && input.connection && !(input.connection as any).isConnected() && !b.isInsertionMarker()) {
                    const param = comp.definitionNameToParam[def.parameters[optIndex].name];
                    attachShadowBlock(input, param);
                }
                ++optIndex;
            }
        }

        updateButtons();
        if (variableInlineInputs) b.setInputsInline(visibleOptions < inlineInputModeLimit);
        if (!skipRender) (b as Blockly.BlockSvg).queueRender();
    }

    function addButton(name: string, uri: string, alt: string, delta: number) {
        b.appendDummyInput(name)
        .appendField(new FieldImageNoText(uri, 24, 24, alt, () => updateShape(delta), false));
    }

    function updateButtons() {
        if (updatingInputs) return;
        const visibleOptions = state.getNumber(numVisibleAttr);
        const showPlus = visibleOptions !== totalOptions;
        const showMinus = visibleOptions !== 0;

        if (b.inputList.some(i => i.name === buttonAddName)) b.removeInput(buttonAddName, true);
        if (b.inputList.some(i => i.name === buttonRemName)) b.removeInput(buttonRemName, true);
        if (b.inputList.some(i => i.name === buttonAddRemName)) b.removeInput(buttonAddRemName, true);

        if (showPlus && showMinus) {
            addPlusAndMinusButtons();
        }
        else if (showPlus) {
            addPlusButton();
        }
        else if (showMinus) {
            addMinusButton();
        }
    }

    function addPlusAndMinusButtons() {
        b.appendDummyInput(buttonAddRemName)
            .appendField(new FieldImageNoText((b as any).REMOVE_IMAGE_DATAURI, 24, 24, lf("Hide optional arguments"), () => updateShape(-1 * buttonDelta), false))
            .appendField(new FieldImageNoText((b as any).ADD_IMAGE_DATAURI, 24, 24, lf("Reveal optional arguments"), () => updateShape(buttonDelta), false))
    }

    function addPlusButton() {
        addButton(buttonAddName, (b as any).ADD_IMAGE_DATAURI, lf("Reveal optional arguments"), buttonDelta);
    }

    function addMinusButton() {
        addButton(buttonRemName, (b as any).REMOVE_IMAGE_DATAURI, lf("Hide optional arguments"), -1 * buttonDelta);
    }

    function initOptionalInputs() {
        state.setValue(inputInitAttr, true);
        addInputs();
        updateButtons();
    }

    function addDelta(delta: number) {
        const newValue = Math.min(Math.max(state.getNumber(numVisibleAttr) + delta, 0), totalOptions);

        if (breaks) {
            if (delta >= 0) {
                if (newValue === 0) return 0;
                for (const breakpoint of breaks) {
                    if (breakpoint >= newValue) {
                        return breakpoint;
                    }
                }
                return totalOptions;
            }
            else {
                for (let i = 0; i < breaks.length; i++) {
                    if (breaks[i] >= newValue) {
                        return i > 0 ? breaks[i - 1] : 0;
                    }
                }
                return breaks[breaks.length - 1];
            }

        }

        return newValue;
    }

    function setInputVisible(input: Blockly.Input, visible: boolean) {
        // If the block isn't rendered, Blockly will crash
        input.setVisible(visible);
    }

    function attachShadowBlock(input: Blockly.Input, param: pxt.blocks.BlockParameter) {
        let shadow = createShadowValue(info, param);

        if (shadow.tagName.toLowerCase() === "value") {
            // Unwrap the block
            shadow = shadow.firstElementChild;
        }

        Blockly.Events.disable();

        try {
            let newBlock: Blockly.Block;
            if (!b.initialized) {
                // use domToBlockInternal so that we don't trigger a render while
                // the block is still being initialized
                newBlock = Blockly.Xml.domToBlockInternal(shadow, b.workspace);

                // we don't know at this time whether the parent block is an insertion marker
                // or not. doing this check lets us clean up the block in the case that it is,
                // though we get an annoying flicker
                setTimeout(() => {
                    if (newBlock.isInsertionMarker()) {
                        Blockly.Events.disable();
                        newBlock.dispose();
                        Blockly.Events.enable();
                    }
                })
            }
            else {
                newBlock = Blockly.Xml.domToBlock(shadow, b.workspace);
            }

            if (newBlock) {
                input.connection.connect(newBlock.outputConnection);
            }
        } catch (e) { }

        Blockly.Events.enable();
    }
}

export function initVariableReporterArgs(b: Blockly.Block, handlerArgs: pxt.blocks.HandlerArg[], info: pxtc.BlocksInfo) {
    const buttonAddName = "0_add_button";
    const numVisibleAttr = "numargs";

    const state = new MutationState(b as unknown as MutatingBlock);
    state.setEventsEnabled(false);
    state.setValue(numVisibleAttr, 0);
    state.setEventsEnabled(true);

    Blockly.Extensions.apply('inline-svgs', b, false);

    const populateArguments = () => {
        for (const arg of handlerArgs) {
            const input = b.getInput(DRAGGABLE_PARAM_INPUT_PREFIX + arg.name);

            if (!input) break;

            if (!input.connection.targetConnection) {
                Blockly.Events.disable();

                const type = pxt.blocks.reporterTypeForArgType(arg.type);
                const blockDom = document.createElement("block");
                blockDom.setAttribute("type", type);

                const fieldDom = document.createElement("field");
                fieldDom.setAttribute("name", "VALUE");
                fieldDom.textContent = arg.name;
                blockDom.appendChild(fieldDom);

                if (type === "argument_reporter_custom") {
                    const mutation = document.createElement("mutation");
                    mutation.setAttribute("type", arg.type);
                    blockDom.appendChild(mutation);
                }

                const newBlock = Blockly.Xml.domToBlock(blockDom, b.workspace);
                input.connection.connect(newBlock.outputConnection);

                if (!b.isInsertionMarker() && newBlock instanceof Blockly.BlockSvg) {
                    newBlock.initSvg();
                    newBlock.queueRender();
                }

                Blockly.Events.enable();
            }
        }
    }

    const updateShape = () => {
        const existingInputs = b.inputList.filter(
            i => i.name.startsWith(DRAGGABLE_PARAM_INPUT_PREFIX)
        ).length;

        const buttonExists = b.inputList.some(i => i.name === buttonAddName);

        if (existingInputs < state.getNumber(numVisibleAttr)) {
            for (let i = existingInputs; i < state.getNumber(numVisibleAttr); i++) {
                const arg = handlerArgs[i];
                if (arg) {
                    const input = b.appendValueInput(DRAGGABLE_PARAM_INPUT_PREFIX + arg.name);
                    input.setCheck(getBlocklyCheckForType(arg.type, info));

                    setDuplicateOnDrag(b.type, input.name);

                    if (buttonExists) {
                        b.moveInputBefore(input.name, buttonAddName);
                    }
                    else {
                        b.moveInputBefore(input.name, "HANDLER");
                    }
                }
            }
        }
        else if (existingInputs > state.getNumber(numVisibleAttr)) {
            for (let i = existingInputs - 1; i >= state.getNumber(numVisibleAttr); i--) {
                const arg = handlerArgs[i];
                if (arg) {
                    const input = b.getInput(DRAGGABLE_PARAM_INPUT_PREFIX + arg.name);

                    if (input.connection.targetConnection) {
                        Blockly.Events.disable();
                        input.connection.targetBlock().dispose();
                        Blockly.Events.enable();
                    }
                    b.removeInput(input.name, true);
                }
            }
        }

        if (state.getNumber(numVisibleAttr) < handlerArgs.length) {
            if (!buttonExists) {
                b.appendDummyInput(buttonAddName)
                    .appendField(new FieldImageNoText((b as any).ADD_IMAGE_DATAURI, 24, 24, lf("Add argument"),
                        () => {
                            state.setValue(numVisibleAttr, state.getNumber(numVisibleAttr) + 1);
                            updateShape();
                        }, false));
                b.moveInputBefore(buttonAddName, "HANDLER");
            }
        }
        else if (buttonExists) {
            b.removeInput(buttonAddName, true);
        }

        setTimeout(populateArguments);
    }

    updateShape();

    appendMutation(b, {
        mutationToDom: (el: Element) => {
            el.setAttribute(numVisibleAttr, state.getString(numVisibleAttr));
            return el;
        },
        domToMutation: (saved: Element) => {
            state.setEventsEnabled(false);
            if (saved.hasAttribute(numVisibleAttr)) {
                const val = parseInt(saved.getAttribute(numVisibleAttr));
                if (!isNaN(val)) {
                    state.setValue(numVisibleAttr, val);
                    updateShape();
                }
            }
            state.setEventsEnabled(true);
        }
    });
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
                Blockly.Events.fire(new Blockly.Events.BlockChange(this.block as unknown as Blockly.Block, "mutation", null, oldText, newText));
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