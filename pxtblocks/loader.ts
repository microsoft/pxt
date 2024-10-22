/// <reference path="../built/pxtlib.d.ts" />
import * as Blockly from "blockly";
import { optionalDummyInputPrefix, optionalInputWithFieldPrefix, provider } from "./constants";
import { initExpandableBlock, initVariableArgsBlock, appendMutation } from "./composableMutations";
import { addMutation, MutatingBlock, MutatorTypes } from "./legacyMutations";
import { initMath } from "./builtins/math";
import { FieldCustom, FieldCustomDropdownOptions, FieldCustomOptions } from "./fields";
import { FieldKind } from "./fields";
import { initFunctions } from "./builtins/functions";
import { initLists } from "./builtins/lists";
import { initLogic } from "./builtins/logic";
import { initLoops } from "./builtins/loops";
import { initText } from "./builtins/text";
import { createToolboxBlock, isArrayType } from "./toolbox";
import { mkCard } from "./help";
import { FieldMatrix } from "./fields";
import { FieldStyledLabel } from "./fields";
import { FieldUserEnum } from "./fields";
import { createFieldEditor, initFieldEditors } from "./fields";
import { promptTranslateBlock } from "./external";
import { initVariables } from "./builtins/variables";
import { initOnStart } from "./builtins/misc";
import { initContextMenu } from "./contextMenu";
import { renderCodeCard } from "./codecardRenderer";
import { FieldDropdown } from "./fields/field_dropdown";
import { setDraggableShadowBlocks, setDuplicateOnDragStrategy } from "./plugins/duplicateOnDrag";
import { applyPolyfills } from "./polyfills";


interface BlockDefinition {
    codeCard?: any;
    init: () => void;
    getVars?: () => any[];
    renameVar?: (oldName: string, newName: string) => void;
    customContextMenu?: any;
    getProcedureCall?: () => string;
    renameProcedure?: (oldName: string, newName: string) => void;
    defType_?: string;
    onchange?: (event: any) => void;
    mutationToDom?: () => Element;
    domToMutation?: (xmlElement: Element) => void;
}

// Matches tuples
export function isTupleType(type: string): string[] {
    const tupleTypeRegex = /^\[(.+)\]$/;
    let parsed = tupleTypeRegex.exec(type);
    if (parsed) {
        // Returns an array containing the types of the tuple
        return parsed[1].split(/,\s*/);
    } else {
        // Not a tuple
        return undefined;
    }
}

type NamedField = { field: Blockly.Field, name?: string };

// list of built-in blocks, should be touched.
let _builtinBlocks: pxt.Map<{
    block: BlockDefinition;
    symbol?: pxtc.SymbolInfo;
}>;
export function builtinBlocks() {
    if (!_builtinBlocks) {
        _builtinBlocks = {};
        Object.keys(Blockly.Blocks)
            .forEach(k => _builtinBlocks[k] = { block: Blockly.Blocks[k] });
    }
    return _builtinBlocks;
}
export const buildinBlockStatements: pxt.Map<boolean> = {
    "controls_if": true,
    "controls_for": true,
    "pxt_controls_for": true,
    "controls_simple_for": true,
    "controls_repeat_ext": true,
    "pxt_controls_for_of": true,
    "controls_for_of": true,
    "variables_set": true,
    "variables_change": true,
    "device_while": true
}

// Cached block info from the last inject operation
export let cachedBlockInfo: pxtc.BlocksInfo;

// blocks cached
interface CachedBlock {
    hash: string;
    fn: pxtc.SymbolInfo;
    block: BlockDefinition;
}
let cachedBlocks: pxt.Map<CachedBlock> = {};

export function blockSymbol(type: string): pxtc.SymbolInfo {
    let b = cachedBlocks[type];
    return b ? b.fn : undefined;
}

export function injectBlocks(blockInfo: pxtc.BlocksInfo): pxtc.SymbolInfo[] {
    cachedBlockInfo = blockInfo;

   setDraggableShadowBlocks(blockInfo.blocks.filter(fn => fn.attributes.duplicateShadowOnDrag).map(fn => fn.attributes.blockId));

    // inject Blockly with all block definitions
    return blockInfo.blocks
        .map(fn => {
            const comp = pxt.blocks.compileInfo(fn);
            const block = createToolboxBlock(blockInfo, fn, comp, false, 2);

            if (fn.attributes.blockBuiltin) {
                pxt.Util.assert(!!builtinBlocks()[fn.attributes.blockId]);
                const builtin = builtinBlocks()[fn.attributes.blockId];
                builtin.symbol = fn;
                builtin.block.codeCard = mkCard(fn, block);
            } else {
                injectBlockDefinition(blockInfo, fn, comp, block);
            }
            return fn;
        });
}

function injectBlockDefinition(info: pxtc.BlocksInfo, fn: pxtc.SymbolInfo, comp: pxt.blocks.BlockCompileInfo, blockXml: HTMLElement): boolean {
    let id = fn.attributes.blockId;

    if (builtinBlocks()[id]) {
        pxt.reportError("blocks", 'trying to override builtin block', { "details": id });
        return false;
    }

    let hash = JSON.stringify(fn);
    if (cachedBlocks[id] && cachedBlocks[id].hash == hash) {
        return true;
    }

    if (Blockly.Blocks[fn.attributes.blockId]) {
        console.error("duplicate block definition: " + id);
        return false;
    }

    let cachedBlock: CachedBlock = {
        hash: hash,
        fn: fn,
        block: {
            codeCard: mkCard(fn, blockXml),
            init: function (this: Blockly.Block) { initBlock(this, info, fn, comp) }
        }
    }

    if (pxt.Util.isTranslationMode()) {
        cachedBlock.block.customContextMenu = (options: any[]) => {
            if (fn.attributes.translationId) {
                options.push({
                    enabled: true,
                    text: lf("Translate this block"),
                    callback: function () {
                        promptTranslateBlock(id, [fn.attributes.translationId]);
                    }
                })
            }
        }
    }

    cachedBlocks[id] = cachedBlock;
    Blockly.Blocks[id] = cachedBlock.block;

    return true;
}

function newLabel(part: pxtc.BlockLabel | pxtc.BlockImage): Blockly.Field {
    if (part.kind === "image") {
        return iconToFieldImage(part.uri);
    }

    const txt = removeOuterSpace(part.text)
    if (!txt) {
        return undefined;
    }

    if (part.cssClass) {
        return new Blockly.FieldLabel(txt, part.cssClass);
    }
    else if (part.style.length) {
        return new FieldStyledLabel(txt, {
            bold: part.style.indexOf("bold") !== -1,
            italics: part.style.indexOf("italics") !== -1,
            blocksInfo: undefined
        })
    }
    else {
        return new Blockly.FieldLabel(txt, undefined);
    }
}

function isSubtype(apis: pxtc.ApisInfo, specific: string, general: string) {
    if (specific == general) return true
    let inf = apis.byQName[specific]
    if (inf && inf.extendsTypes)
        return inf.extendsTypes.indexOf(general) >= 0
    return false
}

function initBlock(block: Blockly.Block, info: pxtc.BlocksInfo, fn: pxtc.SymbolInfo, comp: pxt.blocks.BlockCompileInfo) {
    const ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
    const instance = fn.kind == pxtc.SymbolKind.Method || fn.kind == pxtc.SymbolKind.Property;
    const nsinfo = info.apis.byQName[ns];
    const color =
        // blockNamespace overrides color on block
        (fn.attributes.blockNamespace && nsinfo && nsinfo.attributes.color)
        || fn.attributes.color
        || (nsinfo && nsinfo.attributes.color)
        || pxt.toolbox.getNamespaceColor(ns)
        || 255;

    const helpUrl = pxt.blocks.getHelpUrl(fn);
    if (helpUrl) block.setHelpUrl(helpUrl)

    setDuplicateOnDragStrategy(block);

    block.setColour(typeof color === "string" ? pxt.toolbox.getAccessibleBackground(color) : color);
    let blockShape = provider.SHAPES.ROUND;
    if (fn.retType == "boolean") {
        blockShape = provider.SHAPES.HEXAGONAL;
    }

    block.setOutputShape(blockShape);
    if (fn.attributes.undeletable)
        block.setDeletable(false);

    buildBlockFromDef(fn.attributes._def);
    let hasHandler = false;

    if (fn.attributes.mutate) {
        addMutation(block as MutatingBlock, fn, fn.attributes.mutate);
    }
    else if (fn.attributes.defaultInstance) {
        addMutation(block as MutatingBlock, fn, MutatorTypes.DefaultInstanceMutator);
    }
    else if (fn.attributes._expandedDef && fn.attributes.expandableArgumentMode !== "disabled") {
        const shouldToggle = fn.attributes.expandableArgumentMode === "toggle";
        initExpandableBlock(info, block, fn.attributes._expandedDef, comp, shouldToggle, () => buildBlockFromDef(fn.attributes._expandedDef, true));
    }
    else if (comp.handlerArgs.length) {
        /**
         * We support four modes for handler parameters: variable dropdowns,
         * expandable variable dropdowns with +/- buttons (used for chat commands),
         * draggable variable blocks, and draggable reporter blocks.
         */
        hasHandler = true;
        if (fn.attributes.optionalVariableArgs) {
            initVariableArgsBlock(block, comp.handlerArgs);
        }
        else if (fn.attributes.draggableParameters) {
            comp.handlerArgs.filter(a => !a.inBlockDef).forEach(arg => {
                const i = block.appendValueInput("HANDLER_DRAG_PARAM_" + arg.name);
                if (fn.attributes.draggableParameters == "reporter") {
                    i.setCheck(getBlocklyCheckForType(arg.type, info));
                } else {
                    i.setCheck("Variable");
                }
            });
        }
        else {
            let i = block.appendDummyInput();
            comp.handlerArgs.filter(a => !a.inBlockDef).forEach(arg => {
                i.appendField(new Blockly.FieldVariable(arg.name), "HANDLER_" + arg.name);
            });
        }
    }
    // Add mutation to save and restore custom field settings
    appendMutation(block, {
        mutationToDom: (el: Element) => {
            block.inputList.forEach(input => {
                input.fieldRow.forEach((fieldRow: FieldCustom) => {
                    if (fieldRow.isFieldCustom_ && fieldRow.saveOptions) {
                        const getOptions = fieldRow.saveOptions();
                        if (getOptions) {
                            el.setAttribute(`customfield`, JSON.stringify(getOptions));
                        }
                    }
                })
            })
            return el;
        },
        domToMutation: (saved: Element) => {
            block.inputList.forEach(input => {
                input.fieldRow.forEach((fieldRow: FieldCustom) => {
                    if (fieldRow.isFieldCustom_ && fieldRow.restoreOptions) {
                        const options = JSON.parse(saved.getAttribute(`customfield`));
                        if (options) {
                            fieldRow.restoreOptions(options);
                        }
                    }
                })
            })
        }
    });

    const gridTemplateString = fn.attributes.imageLiteral || fn.attributes.gridLiteral;
    if (gridTemplateString) {
        const columns = (fn.attributes.imageLiteralColumns || 5) * gridTemplateString;
        const rows = fn.attributes.imageLiteralRows || 5;
        const scale = fn.attributes.imageLiteralScale;
        const onColor = fn.attributes.gridLiteralOnColor;
        const offColor = fn.attributes.gridLiteralOffColor;
        let ri = block.appendDummyInput();
        ri.appendField(new FieldMatrix("", { columns, rows, scale, onColor, offColor }), "LEDS");
    }

    if (fn.attributes.inlineInputMode === "external") {
        block.setInputsInline(false);
    }
    else if (fn.attributes.inlineInputMode === "inline") {
        block.setInputsInline(true);
    }
    else {
        block.setInputsInline(!fn.parameters || (fn.parameters.length < 4 && !gridTemplateString));
    }

    const body = fn.parameters?.find(pr => pxtc.parameterTypeIsArrowFunction(pr));
    if (body || hasHandler) {
        block.appendStatementInput("HANDLER")
            .setCheck(null);
        block.setInputsInline(true);
    }

    setOutputCheck(block, fn.retType, info);

    // hook up/down if return value is void
    const hasHandlers = hasArrowFunction(fn);
    block.setPreviousStatement(!(hasHandlers && !fn.attributes.handlerStatement) && fn.retType == "void");
    block.setNextStatement(!(hasHandlers && !fn.attributes.handlerStatement) && fn.retType == "void");

    block.setTooltip(/^__/.test(fn.namespace) ? "" : fn.attributes.jsDoc);
    function buildBlockFromDef(def: pxtc.ParsedBlockDef, expanded = false) {
        let anonIndex = 0;
        let firstParam = !expanded && !!comp.thisParameter;

        const inputs = splitInputs(def);
        const imgConv = new pxt.ImageConverter()

        if (fn.attributes.shim === "ENUM_GET" || fn.attributes.shim === "KIND_GET") {
            if (comp.parameters.length > 1 || comp.thisParameter) {
                console.warn(`Enum blocks may only have 1 parameter but ${fn.attributes.blockId} has ${comp.parameters.length}`);
                return;
            }
        }

        const hasInput = (name: string) => block.inputList?.some(i => i.name === name);

        inputs.forEach(inputParts => {
            const fields: NamedField[] = [];
            let inputName: string;
            let inputCheck: string | string[];
            let hasParameter = false;

            inputParts.forEach(part => {
                if (part.kind !== "param") {
                    const f = newLabel(part);
                    if (f) {
                        fields.push({ field: f });
                    }
                }
                else if (fn.attributes.shim === "ENUM_GET") {
                    pxt.Util.assert(!!fn.attributes.enumName, "Trying to create an ENUM_GET block without a valid enum name")
                    fields.push({
                        name: "MEMBER",
                        field: new FieldUserEnum(info.enumsByName[fn.attributes.enumName])
                    });
                    return;
                }
                else if (fn.attributes.shim === "KIND_GET") {
                    fields.push({
                        name: "MEMBER",
                        field: new FieldKind(info.kindsByName[fn.attributes.kindNamespace || fn.attributes.blockNamespace || fn.namespace])
                    });
                    return;
                }
                else {
                    // find argument
                    let pr = getParameterFromDef(part, comp, firstParam);

                    firstParam = false;
                    if (!pr) {
                        console.error("block " + fn.attributes.blockId + ": unknown parameter " + part.name + (part.ref ? ` (${part.ref})` : ""));
                        return;
                    }

                    if (isHandlerArg(pr)) {
                        inputName = "HANDLER_DRAG_PARAM_" + pr.name;
                        inputCheck = fn.attributes.draggableParameters === "reporter" ? getBlocklyCheckForType(pr.type, info) : "Variable";
                        return;
                    }

                    let typeInfo = pxt.Util.lookup(info.apis.byQName, pr.type)

                    hasParameter = true;
                    const defName = pr.definitionName;
                    const actName = pr.actualName;

                    let isEnum = typeInfo && typeInfo.kind == pxtc.SymbolKind.Enum
                    let isFixed = typeInfo && !!typeInfo.attributes.fixedInstances && !pr.shadowBlockId;
                    let isConstantShim = !!fn.attributes.constantShim;
                    let isCombined = pr.type == "@combined@"
                    let customField = pr.fieldEditor;
                    let fieldLabel = defName.charAt(0).toUpperCase() + defName.slice(1);
                    let fieldType = pr.type;

                    if (isEnum || isFixed || isConstantShim || isCombined) {
                        let syms: pxtc.SymbolInfo[];

                        if (isEnum) {
                            syms = getEnumDropdownValues(info.apis, pr.type);
                        }
                        else if (isFixed) {
                            syms = getFixedInstanceDropdownValues(info.apis, typeInfo.qName);
                        }
                        else if (isCombined) {
                            syms = fn.combinedProperties.map(p => pxt.Util.lookup(info.apis.byQName, p))
                        }
                        else {
                            syms = getConstantDropdownValues(info.apis, fn.qName);
                        }

                        if (syms.length == 0) {
                            console.error(`no instances of ${typeInfo.qName} found`)
                        }
                        const dd: Blockly.MenuOption[] = syms.map(v => {
                            let k = v.attributes.block || v.attributes.blockId || v.name;
                            let comb = v.attributes.blockCombine
                            if (v.attributes.jresURL && !v.attributes.iconURL && pxt.Util.startsWith(v.attributes.jresURL, "data:image/x-mkcd-f")) {
                                v.attributes.iconURL = imgConv.convert(v.attributes.jresURL)
                            }
                            if (!!comb)
                                k = k.replace(/@set/, "")
                            return [
                                v.attributes.iconURL || v.attributes.blockImage ? {
                                    src: v.attributes.iconURL || pxt.Util.pathJoin(pxt.webConfig.commitCdnUrl, `blocks/${v.namespace.toLowerCase()}/${v.name.toLowerCase()}.png`),
                                    alt: k,
                                    width: 36,
                                    height: 36,
                                    value: v.name
                                } : k,
                                v.namespace + "." + v.name
                            ];
                        });
                        // if a value is provided, move it first
                        if (pr.defaultValue) {
                            let shadowValueIndex = -1;
                            dd.some((v, i) => {
                                if (v[1] === (pr as pxt.blocks.BlockParameter).defaultValue) {
                                    shadowValueIndex = i;
                                    return true;
                                }
                                return false;
                            });
                            if (shadowValueIndex > -1) {
                                const shadowValue = dd.splice(shadowValueIndex, 1)[0];
                                dd.unshift(shadowValue);
                            }
                        }

                        if (customField) {
                            let defl = fn.attributes.paramDefl[actName] || "";
                            const options = {
                                data: dd,
                                colour: color,
                                label: fieldLabel,
                                type: fieldType,
                                blocksInfo: info
                            } as FieldCustomDropdownOptions;
                            pxt.Util.jsonMergeFrom(options, fn.attributes.paramFieldEditorOptions && fn.attributes.paramFieldEditorOptions[actName] || {});
                            fields.push(namedField(createFieldEditor(customField, defl, options), defName));
                        }
                        else
                            fields.push(namedField(new FieldDropdown(dd), defName));

                    } else if (customField) {
                        const defl = fn.attributes.paramDefl[pr.actualName] || "";
                        const options = {
                            colour: color,
                            label: fieldLabel,
                            type: fieldType,
                            blocksInfo: info
                        } as FieldCustomOptions;
                        pxt.Util.jsonMergeFrom(options, fn.attributes.paramFieldEditorOptions && fn.attributes.paramFieldEditorOptions[pr.actualName] || {});
                        fields.push(namedField(createFieldEditor(customField, defl, options), pr.definitionName));
                    } else {
                        inputName = defName;
                        if (instance && part.name === "this") {
                            inputCheck = pr.type;
                        } else if (pr.type == "number" && pr.shadowBlockId && pr.shadowBlockId == "value") {
                            inputName = undefined;
                            fields.push(namedField(new Blockly.FieldNumber("0"), defName));
                        } else if (pr.type == "string" && pr.shadowOptions && pr.shadowOptions.toString) {
                            inputCheck = null;
                        } else {
                            inputCheck = getBlocklyCheckForType(pr.type, info);
                        }
                    }
                }
            });

            let input: Blockly.Input;

            if (inputName) {
                // Don't add duplicate inputs
                if (hasInput(inputName)) return;

                input = block.appendValueInput(inputName);
                input.setAlign(Blockly.inputs.Align.LEFT);
            }
            else if (expanded) {
                const prefix = hasParameter ? optionalInputWithFieldPrefix : optionalDummyInputPrefix;
                inputName = prefix + (anonIndex++);

                // Don't add duplicate inputs
                if (hasInput(inputName)) return;
                input = block.appendDummyInput(inputName);
            }
            else {
                input = block.appendDummyInput();
            }

            if (inputCheck) {
                input.setCheck(inputCheck);
            }

            fields.forEach(f => input.appendField(f.field, f.name));
        });

        imgConv.logTime()
    }
}

function getParameterFromDef(part: pxtc.BlockParameter, comp: pxt.blocks.BlockCompileInfo, isThis = false): pxt.blocks.HandlerArg | pxt.blocks.BlockParameter {
    if (part.ref) {
        const result = (part.name === "this") ? comp.thisParameter : comp.actualNameToParam[part.name];

        if (!result) {
            let ha: pxt.blocks.HandlerArg;
            comp.handlerArgs.forEach(arg => {
                if (arg.name === part.name) ha = arg;
            });
            if (ha) return ha;
        }
        return result;
    }
    else {
        return isThis ? comp.thisParameter : comp.definitionNameToParam[part.name];
    }
}

function isHandlerArg(arg: pxt.blocks.HandlerArg | pxt.blocks.BlockParameter): arg is pxt.blocks.HandlerArg {
    return !(arg as pxt.blocks.BlockParameter).definitionName;
}

export function hasArrowFunction(fn: pxtc.SymbolInfo): boolean {
    return !!fn.parameters?.some(pr => pxtc.parameterTypeIsArrowFunction(pr));
}

export function cleanBlocks() {
    pxt.debug('removing all custom blocks')
    for (const b in cachedBlocks)
        removeBlock(cachedBlocks[b].fn);
}

/**
 * Used by pxtrunner to initialize blocks in the docs
 */
export function initializeAndInject(blockInfo: pxtc.BlocksInfo) {
    init(blockInfo);
    injectBlocks(blockInfo);
}

/**
 * Used by main app to initialize blockly blocks.
 * Blocks are injected separately by called injectBlocks
 */
export function initialize(blockInfo: pxtc.BlocksInfo) {
    init(blockInfo);
    initJresIcons(blockInfo);
}

let blocklyInitialized = false;
function init(blockInfo: pxtc.BlocksInfo) {
    if (blocklyInitialized) return;
    blocklyInitialized = true;

    applyPolyfills();

    initFieldEditors();
    initContextMenu();
    initOnStart();
    initMath(blockInfo);
    initVariables();
    initFunctions();
    initLists();
    initLoops();
    initLogic();
    initText();
    initComments();
    initTooltip();
}


/**
 * Converts a TypeScript type into an array of type checks for Blockly inputs/outputs. Use
 * with block.setOutput() and input.setCheck().
 *
 * @returns An array of checks if the type is valid, undefined if there are no valid checks
 *      (e.g. type is void), and null if all checks should be accepted (e.g. type is generic)
 */
function getBlocklyCheckForType(type: string, info: pxtc.BlocksInfo) {
    const types = type.split(/\s*\|\s*/);
    const output = [];
    for (const subtype of types) {
        switch (subtype) {
            // Blockly capitalizes primitive types for its builtin math/string/logic blocks
            case "number":
                output.push("Number");
                break;
            case "string":
                output.push("String");
                break;
            case "boolean":
                output.push("Boolean");
                break;
            case "T":
            // The type is generic, so accept any checks. This is mostly used with functions that
            // get values from arrays. This could be improved if we ever add proper type
            // inference for generic types
            case "any":
                return null;
            case "void":
                return undefined;
            default:
                // We add "Array" to the front for array types so that they can be connected
                // to the blocks that accept any array (e.g. length, push, pop, etc)
                if (isArrayType(subtype)) {
                    if (types.length > 1) {
                        // type inference will potentially break non-trivial arrays in intersections
                        // until we have better type handling in blocks,
                        // so escape and allow any block to be dropped in.
                        return null;
                    } else {
                        output.push("Array");
                    }
                }

                // Blockly has no concept of inheritance, so we need to add all
                // super classes to the check array
                const si_r = info.apis.byQName[subtype];
                if (si_r && si_r.extendsTypes && 0 < si_r.extendsTypes.length) {
                    output.push(...si_r.extendsTypes);
                } else {
                    output.push(subtype);
                }
        }
    }

    return output;
}

export function setOutputCheck(block: Blockly.Block, retType: string, info: pxtc.BlocksInfo) {
    const check = getBlocklyCheckForType(retType, info);

    if (check || check === null) {
        block.setOutput(true, check);
    }
}

function initComments() {
    Blockly.Msg.WORKSPACE_COMMENT_DEFAULT_TEXT = '';
}

function initTooltip() {
    const renderTip = (el: any) => {
        if (el.disabled)
            return lf("This block is disabled and will not run. Attach this block to an event to enable it.")
        let tip = el.tooltip;
        while (typeof tip === "function") {
            tip = tip(el);
        }
        return tip;
    }

    Blockly.Tooltip.setCustomTooltip((contentDiv: Element, anchor: Element) => {
        const codecard = (anchor as any).codeCard;

        if (codecard) {
            const cardEl = renderCodeCard({
                header: renderTip(anchor)
            })
            contentDiv.appendChild(cardEl);
        }
        else {
            let tip = renderTip(anchor);
            tip = Blockly.utils.string.wrap(tip, Blockly.Tooltip.LIMIT);
            // Create new text, line by line.
            let lines = tip.split('\n');
            for (let i = 0; i < lines.length; i++) {
                let div = document.createElement('div');
                div.appendChild(document.createTextNode(lines[i]));
                contentDiv.appendChild(div);
            }
        }
    });
}

function removeBlock(fn: pxtc.SymbolInfo) {
    delete Blockly.Blocks[fn.attributes.blockId];
    delete cachedBlocks[fn.attributes.blockId];
}

let jresIconCache: pxt.Map<string> = {};
function iconToFieldImage(id: string): Blockly.FieldImage {
    let url = jresIconCache[id];
    if (!url) {
        pxt.log(`missing jres icon ${id}`)
        return undefined;
    }
    return new Blockly.FieldImage(url, 40, 40, '', null, pxt.Util.isUserLanguageRtl());
}

function initJresIcons(blockInfo: pxtc.BlocksInfo) {
    jresIconCache = {}; // clear previous cache
    const jres = blockInfo.apis.jres;
    if (!jres) return;

    Object.keys(jres).forEach((jresId) => {
        const jresObject = jres[jresId];
        if (jresObject && jresObject.icon)
            jresIconCache[jresId] = jresObject.icon;
    })
}

function splitInputs(def: pxtc.ParsedBlockDef): pxtc.BlockContentPart[][] {
    const res: pxtc.BlockContentPart[][] = [];
    let current: pxtc.BlockContentPart[] = [];

    def.parts.forEach(part => {
        switch (part.kind) {
            case "break":
                newInput();
                break;
            case "param":
                current.push(part);
                newInput();
                break;
            case "image":
            case "label":
                current.push(part);
                break;
        }
    });

    newInput();

    return res;

    function newInput() {
        if (current.length) {
            res.push(current);
            current = [];
        }
    }
}

function namedField(field: Blockly.Field, name: string): NamedField {
    return { field, name };
}

function getEnumDropdownValues(apis: pxtc.ApisInfo, enumName: string) {
    return pxt.Util.values(apis.byQName).filter(sym => sym.namespace === enumName && !sym.attributes.blockHidden);
}

export function getFixedInstanceDropdownValues(apis: pxtc.ApisInfo, qName: string) {
    const symbols = pxt.Util.values(apis.byQName).filter(sym => sym.kind === pxtc.SymbolKind.Variable
        && sym.attributes.fixedInstance
        && isSubtype(apis, sym.retType, qName))
        .sort((l, r) => (r.attributes.weight || 50) - (l.attributes.weight || 50))
    return symbols
}

export function generateIcons(instanceSymbols: pxtc.SymbolInfo[]) {
    const imgConv = new pxt.ImageConverter();
    instanceSymbols.forEach(v => {
        if (v.attributes.jresURL && !v.attributes.iconURL && pxt.Util.startsWith(v.attributes.jresURL, "data:image/x-mkcd-f")) {
            v.attributes.iconURL = imgConv.convert(v.attributes.jresURL)
        }
    });
}

function getConstantDropdownValues(apis: pxtc.ApisInfo, qName: string) {
    return pxt.Util.values(apis.byQName).filter(sym => sym.attributes.blockIdentity === qName);
}

// Trims off a single space from beginning and end (if present)
function removeOuterSpace(str: string) {
    if (str === " ") {
        return "";
    }
    else if (str.length > 1) {
        const startSpace = str.charAt(0) == " ";
        const endSpace = str.charAt(str.length - 1) == " ";

        if (startSpace || endSpace) {
            return str.substring(startSpace ? 1 : 0, endSpace ? str.length - 1 : str.length);
        }
    }

    return str;
}

/**
 * Blockly variable fields can't be set directly; you either have to use the
 * variable ID or set the value of the model and not the field
 */
export function setVarFieldValue(block: Blockly.Block, fieldName: string, newName: string) {
    const varField = block.getField(fieldName) as Blockly.FieldVariable;

    // Check for an existing model with this name; otherwise we'll create
    // a second variable with the same name and it will show up twice in the UI
    const vars = block.workspace.getAllVariables();
    let foundIt = false;
    if (vars && vars.length) {
        for (let v = 0; v < vars.length; v++) {
            const model = vars[v];
            if (model.name === newName) {
                varField.setValue(model.getId());
                foundIt = true;
            }
        }
    }
    if (!foundIt) {
        varField.initModel();
        const model = varField.getVariable();
        model.name = newName;
        varField.setValue(model.getId());
    }
}
