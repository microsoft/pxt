/// <reference path="../localtypings/blockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />

namespace pxt.blocks {

    const typeDefaults: Map<{ field: string, block: string, defaultValue: string }> = {
        "string": {
            field: "TEXT",
            block: "text",
            defaultValue: ""
        },
        "number": {
            field: "NUM",
            block: "math_number",
            defaultValue: "0"
        },
        "boolean": {
            field: "BOOL",
            block: "logic_boolean",
            defaultValue: "false"
        },
        "Array": {
            field: "VAR",
            block: "variables_get",
            defaultValue: "list"
        }
    }

    // Add numbers before input names to prevent clashes with the ones added by BlocklyLoader
    export const optionalDummyInputPrefix = "0_optional_dummy";
    export const optionalInputWithFieldPrefix = "0_optional_field";

    // Matches arrays and tuple types
    const arrayTypeRegex = /^(?:Array<.+>)|(?:.+\[\])|(?:\[.+\])$/;
    export function isArrayType(type: string) {
        return arrayTypeRegex.test(type);
    }

    type NamedField = { field: Blockly.Field, name?: string };

    // list of built-in blocks, should be touched.
    let _builtinBlocks: Map<{
        block: Blockly.BlockDefinition;
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
    export const buildinBlockStatements: Map<boolean> = {
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
    let cachedBlockInfo: pxtc.BlocksInfo;

    // blocks cached
    interface CachedBlock {
        hash: string;
        fn: pxtc.SymbolInfo;
        block: Blockly.BlockDefinition;
    }
    let cachedBlocks: Map<CachedBlock> = {};

    export function blockSymbol(type: string): pxtc.SymbolInfo {
        let b = cachedBlocks[type];
        return b ? b.fn : undefined;
    }

    export function createShadowValue(info: pxtc.BlocksInfo, p: pxt.blocks.BlockParameter, shadowId?: string, defaultV?: string): Element {
        defaultV = defaultV || p.defaultValue;
        shadowId = shadowId || p.shadowBlockId;
        if (!shadowId && p.range) shadowId = "math_number_minmax";
        let defaultValue: any;

        if (defaultV && defaultV.slice(0, 1) == "\"")
            defaultValue = JSON.parse(defaultV);
        else {
            defaultValue = defaultV;
        }

        if (p.type == "number" && shadowId == "value") {
            const field = document.createElement("field");
            field.setAttribute("name", p.definitionName);
            field.appendChild(document.createTextNode("0"));
            return field;
        }

        const isVariable = shadowId == "variables_get";

        const value = document.createElement("value");
        value.setAttribute("name", p.definitionName);

        const shadow = document.createElement(isVariable ? "block" : "shadow");
        value.appendChild(shadow);

        const typeInfo = typeDefaults[p.type];

        shadow.setAttribute("type", shadowId || typeInfo && typeInfo.block || p.type);
        shadow.setAttribute("colour", (Blockly as any).Colours.textField);

        if (typeInfo && (!shadowId || typeInfo.block === shadowId || shadowId === "math_number_minmax")) {
            const field = document.createElement("field");
            shadow.appendChild(field);

            let fieldName: string;
            switch (shadowId) {
                case "variables_get":
                    fieldName = "VAR"; break;
                case "math_number_minmax":
                    fieldName = "SLIDER"; break;
                default:
                    fieldName = typeInfo.field; break;
            }

            field.setAttribute("name", fieldName);

            let value: Text;
            if (p.type == "boolean") {
                value = document.createTextNode((defaultValue || typeInfo.defaultValue).toUpperCase())
            }
            else {
                value = document.createTextNode(defaultValue || typeInfo.defaultValue)
            }

            field.appendChild(value);
        }
        else if (defaultValue) {
            const field = document.createElement("field");
            field.textContent = defaultValue;

            if (isVariable) {
                field.setAttribute("name", "VAR");
                shadow.appendChild(field);
            }
            else if (shadowId) {
                const shadowInfo = info.blocksById[shadowId];
                if (shadowInfo && shadowInfo.attributes._def && shadowInfo.attributes._def.parameters.length) {
                    const shadowParam = shadowInfo.attributes._def.parameters[0];
                    field.setAttribute("name", shadowParam.name);
                    shadow.appendChild(field);
                }
            }
            else {
                field.setAttribute("name", p.definitionName);
                shadow.appendChild(field);
            }
        }

        let mut: HTMLElement;
        if (p.range) {
            mut = document.createElement('mutation');
            mut.setAttribute('min', p.range.min.toString());
            mut.setAttribute('max', p.range.max.toString());
            mut.setAttribute('label', p.actualName.charAt(0).toUpperCase() + p.actualName.slice(1));
            if (p.fieldOptions) {
                if (p.fieldOptions['step']) mut.setAttribute('step', p.fieldOptions['step']);
                if (p.fieldOptions['color']) mut.setAttribute('color', p.fieldOptions['color']);
                if (p.fieldOptions['precision']) mut.setAttribute('precision', p.fieldOptions['precision']);
            }
        }

        if (p.fieldOptions) {
            if (!mut) mut = document.createElement('mutation');
            mut.setAttribute(`customfield`, JSON.stringify(p.fieldOptions));
        }

        if (mut) {
            shadow.appendChild(mut);
        }

        return value;
    }

    export function createFlyoutHeadingLabel(name: string, color?: string, icon?: string, iconClass?: string) {
        const headingLabel = createFlyoutLabel(name, pxt.toolbox.convertColor(color), icon, iconClass);
        headingLabel.setAttribute('web-class', 'blocklyFlyoutHeading');
        return headingLabel;
    }

    export function createFlyoutGroupLabel(name: string, icon?: string, labelLineWidth?: string, helpCallback?: string) {
        const groupLabel = createFlyoutLabel(name, undefined, icon);
        groupLabel.setAttribute('web-class', 'blocklyFlyoutGroup');
        groupLabel.setAttribute('web-line', '1.5');
        if (labelLineWidth) groupLabel.setAttribute('web-line-width', labelLineWidth);
        if (helpCallback) {
            groupLabel.setAttribute('web-help-button', 'true');
            groupLabel.setAttribute('callbackkey', helpCallback);
        }
        return groupLabel;
    }

    function createFlyoutLabel(name: string, color?: string, icon?: string, iconClass?: string): HTMLElement {
        // Add the Heading label
        let headingLabel = goog.dom.createDom('label') as HTMLElement;
        headingLabel.setAttribute('text', name);
        if (color) {
            headingLabel.setAttribute('web-icon-color', pxt.toolbox.convertColor(color));
        }
        if (icon) {
            if (icon.length === 1) {
                headingLabel.setAttribute('web-icon', icon);
                if (iconClass) headingLabel.setAttribute('web-icon-class', iconClass);
            }
            else {
                headingLabel.setAttribute('web-icon-class', `blocklyFlyoutIcon${name}`);
            }
        }
        return headingLabel;
    }

    export function createFlyoutButton(callbackkey: string, label: string) {
        let button = goog.dom.createDom('button') as Element;
        button.setAttribute('text', label);
        button.setAttribute('callbackkey', callbackkey);
        return button;
    }

    export function createToolboxBlock(info: pxtc.BlocksInfo, fn: pxtc.SymbolInfo, comp: pxt.blocks.BlockCompileInfo): HTMLElement {
        //
        // toolbox update
        //
        let block = document.createElement("block");
        block.setAttribute("type", fn.attributes.blockId);
        if (fn.attributes.blockGap)
            block.setAttribute("gap", fn.attributes.blockGap);
        else if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.defaultBlockGap)
            block.setAttribute("gap", pxt.appTarget.appTheme.defaultBlockGap.toString());
        if (comp.thisParameter) {
            const t = comp.thisParameter;
            block.appendChild(createShadowValue(info, t, t.shadowBlockId || "variables_get", t.defaultValue || t.definitionName));
        }
        if (fn.parameters) {
            comp.parameters.filter(pr => !pr.isOptional &&
                (/^(string|number|boolean)$/.test(pr.type) || pr.shadowBlockId || pr.defaultValue))
                .forEach(pr => {
                    block.appendChild(createShadowValue(info, pr));
                })
            if (fn.attributes.draggableParameters) {
                comp.handlerArgs.forEach(arg => {
                    // draggableParameters="variable":
                    // <value name="HANDLER_DRAG_PARAM_arg">
                    // <shadow type="variables_get_reporter">
                    //     <field name="VAR">defaultName</field>
                    // </shadow>
                    // </value>

                    // draggableParameters="reporter"
                    // <value name="HANDLER_DRAG_PARAM_arg">
                    //     <shadow type="argument_reporter_custom">
                    //         <mutation typename="Sprite"></mutation>
                    //         <field name="VALUE">mySprite</field>
                    //     </shadow>
                    // </value>
                    const useReporter = fn.attributes.draggableParameters === "reporter";

                    const value = document.createElement("value");
                    value.setAttribute("name", "HANDLER_DRAG_PARAM_" + arg.name);

                    const blockType = useReporter ? pxt.blocks.reporterTypeForArgType(arg.type) : "variables_get_reporter";
                    const shadow = document.createElement("shadow");
                    shadow.setAttribute("type", blockType);

                    if (useReporter && blockType === "argument_reporter_custom") {
                        const mutation = document.createElement("mutation");
                        mutation.setAttribute("typename", arg.type);
                        shadow.appendChild(mutation);
                    }

                    const field = document.createElement("field");
                    field.setAttribute("name", useReporter ? "VALUE" : "VAR");
                    field.textContent = Util.htmlEscape(arg.name);

                    shadow.appendChild(field);
                    value.appendChild(shadow);
                    block.appendChild(value);
                });
            }
            else {
                comp.handlerArgs.forEach(arg => {
                    const field = document.createElement("field");
                    field.setAttribute("name", "HANDLER_" + arg.name);
                    field.textContent = arg.name;
                    block.appendChild(field);
                });
            }
        }
        return block;
    }

    export function injectBlocks(blockInfo: pxtc.BlocksInfo): pxtc.SymbolInfo[] {
        cachedBlockInfo = blockInfo;

        Blockly.pxtBlocklyUtils.whitelistDraggableBlockTypes(blockInfo.blocks.filter(fn => fn.attributes.duplicateShadowOnDrag).map(fn => fn.attributes.blockId));

        // inject Blockly with all block definitions
        return blockInfo.blocks
            .map(fn => {
                if (fn.attributes.blockBuiltin) {
                    Util.assert(!!builtinBlocks()[fn.attributes.blockId]);
                    builtinBlocks()[fn.attributes.blockId].symbol = fn;
                } else {
                    let comp = compileInfo(fn);
                    let block = createToolboxBlock(blockInfo, fn, comp);
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
        /* tslint:disable:possible-timing-attack (not a security critical codepath) */
        if (cachedBlocks[id] && cachedBlocks[id].hash == hash) {
            return true;
        }
        /* tslint:enable:possible-timing-attack */

        if (Blockly.Blocks[fn.attributes.blockId]) {
            console.error("duplicate block definition: " + id);
            return false;
        }

        let cachedBlock: CachedBlock = {
            hash: hash,
            fn: fn,
            block: {
                codeCard: mkCard(fn, blockXml),
                init: function () { initBlock(this, info, fn, comp) }
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
            return new pxtblockly.FieldStyledLabel(txt, {
                bold: part.style.indexOf("bold") !== -1,
                italics: part.style.indexOf("italics") !== -1,
                blocksInfo: undefined
            })
        }
        else {
            return new Blockly.FieldLabel(txt, undefined);
        }
    }

    function cleanOuterHTML(el: HTMLElement): string {
        // remove IE11 junk
        return el.outerHTML.replace(/^<\?[^>]*>/, '');
    }

    function mkCard(fn: pxtc.SymbolInfo, blockXml: HTMLElement): pxt.CodeCard {
        return {
            name: fn.namespace + '.' + fn.name,
            shortName: fn.name,
            description: fn.attributes.jsDoc,
            url: fn.attributes.help ? 'reference/' + fn.attributes.help.replace(/^\//, '') : undefined,
            blocksXml: `<xml xmlns="http://www.w3.org/1999/xhtml">${cleanOuterHTML(blockXml)}</xml>`,
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

        if (fn.attributes.help)
            block.setHelpUrl("/reference/" + fn.attributes.help.replace(/^\//, ''));
        else if (fn.pkg && !pxt.appTarget.bundledpkgs[fn.pkg]) {// added package
            let anchor = fn.qName.toLowerCase().split('.');
            if (anchor[0] == fn.pkg) anchor.shift();
            block.setHelpUrl(`/pkg/${fn.pkg}#${encodeURIComponent(anchor.join('-'))}`)
        }

        block.setColour(color, fn.attributes.colorSecondary, fn.attributes.colorTertiary);
        let blockShape = Blockly.OUTPUT_SHAPE_ROUND;
        if (fn.retType == "boolean")
            blockShape = Blockly.OUTPUT_SHAPE_HEXAGONAL;

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
                    input.fieldRow.forEach((fieldRow: Blockly.FieldCustom) => {
                        if (fieldRow.isFieldCustom_ && fieldRow.saveOptions) {
                            const getOptions = fieldRow.saveOptions();
                            el.setAttribute(`customfield`, JSON.stringify(getOptions));
                        }
                    })
                })
                return el;
            },
            domToMutation: (saved: Element) => {
                block.inputList.forEach(input => {
                    input.fieldRow.forEach((fieldRow: Blockly.FieldCustom) => {
                        if (fieldRow.isFieldCustom_ && fieldRow.restoreOptions) {
                            const options = JSON.parse(saved.getAttribute(`customfield`));
                            fieldRow.restoreOptions(options);
                        }
                    })
                })
            }
        });
        if (fn.attributes.imageLiteral) {
            let ri = block.appendDummyInput();
            ri.appendField(new pxtblockly.FieldMatrix("", { columns: fn.attributes.imageLiteral * 5 }), "LEDS");
        }

        if (fn.attributes.inlineInputMode === "external") {
            block.setInputsInline(false);
        }
        else if (fn.attributes.inlineInputMode === "inline") {
            block.setInputsInline(true);
        }
        else {
            block.setInputsInline(!fn.parameters || (fn.parameters.length < 4 && !fn.attributes.imageLiteral));
        }

        const body = fn.parameters ? fn.parameters.filter(pr => pr.type == "() => void" || pr.type == "Action")[0] : undefined;
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

        block.setTooltip(fn.attributes.jsDoc);
        function buildBlockFromDef(def: pxtc.ParsedBlockDef, expanded = false) {
            let anonIndex = 0;
            let firstParam = !expanded && !!comp.thisParameter;

            const inputs = splitInputs(def);
            const imgConv = new ImageConverter()

            if (fn.attributes.shim === "ENUM_GET") {
                if (comp.parameters.length > 1 || comp.thisParameter) {
                    console.warn(`Enum blocks may only have 1 parameter but ${fn.attributes.blockId} has ${comp.parameters.length}`);
                    return;
                }
            }

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
                        U.assert(!!fn.attributes.enumName, "Trying to create an ENUM_GET block without a valid enum name")
                        fields.push({
                            name: "MEMBER",
                            field: new pxtblockly.FieldUserEnum(info.enumsByName[fn.attributes.enumName])
                        });
                        return;
                    }
                    else {
                        // find argument
                        let pr = getParameterFromDef(part, comp, firstParam);

                        firstParam = false;
                        if (!pr) {
                            console.error("block " + fn.attributes.blockId + ": unkown parameter " + part.name + (part.ref ? ` (${part.ref})` : ""));
                            return;
                        }

                        if (isHandlerArg(pr)) {
                            inputName = "HANDLER_DRAG_PARAM_" + pr.name;
                            inputCheck = fn.attributes.draggableParameters === "reporter" ? getBlocklyCheckForType(pr.type, info) : "Variable";
                            return;
                        }

                        let typeInfo = U.lookup(info.apis.byQName, pr.type)

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
                                syms = fn.combinedProperties.map(p => U.lookup(info.apis.byQName, p))
                            }
                            else {
                                syms = getConstantDropdownValues(info.apis, fn.qName);
                            }

                            if (syms.length == 0) {
                                console.error(`no instances of ${typeInfo.qName} found`)
                            }
                            const dd = syms.map(v => {
                                let k = v.attributes.block || v.attributes.blockId || v.name;
                                let comb = v.attributes.blockCombine
                                if (v.attributes.jresURL && !v.attributes.iconURL && U.startsWith(v.attributes.jresURL, "data:image/x-mkcd-f")) {
                                    v.attributes.iconURL = imgConv.convert(v.attributes.jresURL)
                                }
                                if (!!comb)
                                    k = k.replace(/@set/, "")
                                return [
                                    v.attributes.iconURL || v.attributes.blockImage ? {
                                        src: v.attributes.iconURL || Util.pathJoin(pxt.webConfig.commitCdnUrl, `blocks/${v.namespace.toLowerCase()}/${v.name.toLowerCase()}.png`),
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
                                    if (v[1] === (pr as BlockParameter).defaultValue) {
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
                                } as Blockly.FieldCustomDropdownOptions;
                                Util.jsonMergeFrom(options, fn.attributes.paramFieldEditorOptions && fn.attributes.paramFieldEditorOptions[actName] || {});
                                fields.push(namedField(createFieldEditor(customField, defl, options), defName));
                            }
                            else
                                fields.push(namedField(new Blockly.FieldDropdown(dd), defName));

                        } else if (customField) {
                            const defl = fn.attributes.paramDefl[pr.actualName] || "";
                            const options = {
                                colour: color,
                                label: fieldLabel,
                                type: fieldType,
                                blocksInfo: info
                            } as Blockly.FieldCustomOptions;
                            Util.jsonMergeFrom(options, fn.attributes.paramFieldEditorOptions && fn.attributes.paramFieldEditorOptions[pr.actualName] || {});
                            fields.push(namedField(createFieldEditor(customField, defl, options), pr.definitionName));
                        } else {
                            inputName = defName;
                            if (instance && part.name === "this") {
                                inputCheck = pr.type;
                            } else if (pr.type == "number") {
                                if (pr.shadowBlockId && pr.shadowBlockId == "value") {
                                    inputName = undefined;
                                    fields.push(namedField(new Blockly.FieldTextInput("0", Blockly.FieldTextInput.numberValidator), defName));
                                }
                                else {
                                    inputCheck = "Number"
                                }
                            } else if (pr.type == "boolean") {
                                inputCheck = "Boolean"
                            } else if (pr.type == "string") {
                                if (pr.shadowOptions && pr.shadowOptions.toString) {
                                    inputCheck = undefined;
                                }
                                else {
                                    inputCheck = "String"
                                }
                            } else if (pr.type == "any") {
                                inputCheck = null;
                            } else {
                                inputCheck = pr.type == "T" ? undefined : (isArrayType(pr.type) ? ["Array", pr.type] : pr.type);
                            }
                        }
                    }
                });

                let input: Blockly.Input;

                if (inputName) {
                    input = block.appendValueInput(inputName);
                    input.setAlign(Blockly.ALIGN_LEFT);
                }
                else if (expanded) {
                    const prefix = hasParameter ? optionalInputWithFieldPrefix : optionalDummyInputPrefix;
                    input = block.appendDummyInput(prefix + (anonIndex++));
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

    function getParameterFromDef(part: pxtc.BlockParameter, comp: BlockCompileInfo, isThis = false): HandlerArg | BlockParameter {
        if (part.ref) {
            const result = (part.name === "this") ? comp.thisParameter : comp.actualNameToParam[part.name];

            if (!result) {
                let ha: HandlerArg;
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

    function isHandlerArg(arg: HandlerArg | BlockParameter): arg is HandlerArg {
        return !(arg as BlockParameter).definitionName;
    }

    export function hasArrowFunction(fn: pxtc.SymbolInfo): boolean {
        const r = fn.parameters
            ? fn.parameters.filter(pr => pr.type === "Action" || /^\([^\)]*\)\s*=>/.test(pr.type))[0]
            : undefined;
        return !!r;
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
        init();
        injectBlocks(blockInfo);
    }

    /**
     * Used by main app to initialize blockly blocks.
     * Blocks are injected separately by called injectBlocks
     */
    export function initialize(blockInfo: pxtc.BlocksInfo) {
        init();
        initTooltip(blockInfo);
        initJresIcons(blockInfo);
    }

    let blocklyInitialized = false;
    function init() {
        if (blocklyInitialized) return;
        blocklyInitialized = true;

        goog.provide('Blockly.Blocks.device');
        goog.require('Blockly.Blocks');

        Blockly.FieldCheckbox.CHECK_CHAR = '■';
        Blockly.BlockSvg.START_HAT = !!pxt.appTarget.appTheme.blockHats;

        initFieldEditors();
        initContextMenu();
        initOnStart();
        initMath();
        initVariables();
        initFunctions();
        initLists();
        initLoops();
        initLogic();
        initText();
        initDrag();
        initDebugger();
        initComments();

        // PXT is in charge of disabling, don't record undo for disabled events
        (Blockly.Block as any).prototype.setDisabled = function (disabled: any) {
            if (this.disabled != disabled) {
                let oldRecordUndo = (Blockly as any).Events.recordUndo;
                (Blockly as any).Events.recordUndo = false;
                Blockly.Events.fire(new Blockly.Events.BlockChange(
                    this, 'disabled', null, this.disabled, disabled));
                (Blockly as any).Events.recordUndo = oldRecordUndo;
                this.disabled = disabled;
            }
        };
    }

    /**
     * Converts a TypeScript type into an array of type checks for Blockly inputs/outputs. Use
     * with block.setOutput() and input.setCheck().
     *
     * @returns An array of checks if the type is valid, undefined if there are no valid checks
     *      (e.g. type is void), and null if all checks should be accepted (e.g. type is generic)
     */
    function getBlocklyCheckForType(type: string, info: pxtc.BlocksInfo) {
        switch (type) {
            // Blockly capitalizes primitive types for its builtin math/string/logic blocks
            case "number": return ["Number"];
            case "string": return ["String"];
            case "boolean": return ["Boolean"];
            case "any": return null;
            case "void": return undefined
            default:
                if (type !== "T") {
                    // We add "Array" to the front for array types so that they can be connected
                    // to the blocks that accept any array (e.g. length, push, pop, etc)
                    const opt_check = isArrayType(type) ? ["Array"] : [];

                    // Blockly has no concept of inheritance, so we need to add all
                    // super classes to the check array
                    const si_r = info.apis.byQName[type];
                    if (si_r && si_r.extendsTypes && 0 < si_r.extendsTypes.length) {
                        opt_check.push(...si_r.extendsTypes);
                    } else {
                        opt_check.push(type);
                    }

                    return opt_check;
                } else {
                    // The type is generic, so accept any checks. This is mostly used with functions that
                    // get values from arrays. This could be improved if we ever add proper type
                    // inference for generic types
                    return null;
                }
        }
    }

    function setOutputCheck(block: Blockly.Block, retType: string, info: pxtc.BlocksInfo) {
        const check = getBlocklyCheckForType(retType, info);

        if (check || check === null) {
            block.setOutput(true, check);
        }
    }

    function setBuiltinHelpInfo(block: any, id: string) {
        const info = pxt.blocks.getBlockDefinition(id);
        setHelpResources(block, id, info.name, info.tooltip, info.url, pxt.toolbox.getNamespaceColor(info.category));
    }

    function installBuiltinHelpInfo(id: string) {
        const info = pxt.blocks.getBlockDefinition(id);
        installHelpResources(id, info.name, info.tooltip, info.url, pxt.toolbox.getNamespaceColor(info.category));
    }

    function setHelpResources(block: any, id: string, name: string, tooltip: any, url: string, colour: string, colourSecondary?: string, colourTertiary?: string, undeletable?: boolean) {
        if (tooltip && (typeof tooltip === "string" || typeof tooltip === "function")) block.setTooltip(tooltip);
        if (url) block.setHelpUrl(url);
        if (colour) block.setColour(colour, colourSecondary, colourTertiary);
        if (undeletable) block.setDeletable(false);

        let tb = document.getElementById('blocklyToolboxDefinition');
        let xml: HTMLElement = tb ? getFirstChildWithAttr(tb, "block", "type", id) as HTMLElement : undefined;
        block.codeCard = <pxt.CodeCard>{
            header: name,
            name: name,
            software: 1,
            description: goog.isFunction(tooltip) ? tooltip(block) : tooltip,
            blocksXml: xml ? (`<xml xmlns="http://www.w3.org/1999/xhtml">` + (cleanOuterHTML(xml) || `<block type="${id}"></block>`) + "</xml>") : undefined,
            url: url
        };
    }

    export function installHelpResources(id: string, name: string, tooltip: any, url: string, colour: string, colourSecondary?: string, colourTertiary?: string) {
        let block = Blockly.Blocks[id];
        let old = block.init;
        if (!old) return;

        block.init = function () {
            old.call(this);
            let block = this;
            setHelpResources(this, id, name, tooltip, url, colour, colourSecondary, colourTertiary);
        }
    }

    export let openHelpUrl: (url: string) => void;

    function initLists() {
        const msg = Blockly.Msg;

        // lists_create_with
        const listsCreateWithId = "lists_create_with";
        const listsCreateWithDef = pxt.blocks.getBlockDefinition(listsCreateWithId);
        msg.LISTS_CREATE_EMPTY_TITLE = listsCreateWithDef.block["LISTS_CREATE_EMPTY_TITLE"];
        msg.LISTS_CREATE_WITH_INPUT_WITH = listsCreateWithDef.block["LISTS_CREATE_WITH_INPUT_WITH"];
        msg.LISTS_CREATE_WITH_CONTAINER_TITLE_ADD = listsCreateWithDef.block["LISTS_CREATE_WITH_CONTAINER_TITLE_ADD"];
        msg.LISTS_CREATE_WITH_ITEM_TITLE = listsCreateWithDef.block["LISTS_CREATE_WITH_ITEM_TITLE"];
        installBuiltinHelpInfo(listsCreateWithId);

        // lists_length
        const listsLengthId = "lists_length";
        const listsLengthDef = pxt.blocks.getBlockDefinition(listsLengthId);
        msg.LISTS_LENGTH_TITLE = listsLengthDef.block["LISTS_LENGTH_TITLE"];

        // We have to override this block definition because the builtin block
        // allows both Strings and Arrays in its input check and that confuses
        // our Blockly compiler
        let block = Blockly.Blocks[listsLengthId];
        block.init = function () {
            this.jsonInit({
                "message0": msg.LISTS_LENGTH_TITLE,
                "args0": [
                    {
                        "type": "input_value",
                        "name": "VALUE",
                        "check": ['Array']
                    }
                ],
                "output": 'Number',
                "outputShape": Blockly.OUTPUT_SHAPE_ROUND
            });
        }

        installBuiltinHelpInfo(listsLengthId);
    }

    function initLoops() {
        const msg = Blockly.Msg;

        // controls_repeat_ext
        const controlsRepeatExtId = "controls_repeat_ext";
        const controlsRepeatExtDef = pxt.blocks.getBlockDefinition(controlsRepeatExtId);
        msg.CONTROLS_REPEAT_TITLE = controlsRepeatExtDef.block["CONTROLS_REPEAT_TITLE"];
        msg.CONTROLS_REPEAT_INPUT_DO = controlsRepeatExtDef.block["CONTROLS_REPEAT_INPUT_DO"];
        installBuiltinHelpInfo(controlsRepeatExtId);

        // device_while
        const deviceWhileId = "device_while";
        const deviceWhileDef = pxt.blocks.getBlockDefinition(deviceWhileId);
        Blockly.Blocks[deviceWhileId] = {
            init: function () {
                this.jsonInit({
                    "message0": deviceWhileDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "COND",
                            "check": "Boolean"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": pxt.toolbox.getNamespaceColor('loops')
                });
                this.appendStatementInput("DO")
                    .appendField(deviceWhileDef.block["appendField"]);

                setBuiltinHelpInfo(this, deviceWhileId);
            }
        };

        // pxt_controls_for
        const pxtControlsForId = "pxt_controls_for";
        const pxtControlsForDef = pxt.blocks.getBlockDefinition(pxtControlsForId);
        Blockly.Blocks[pxtControlsForId] = {
            /**
             * Block for 'for' loop.
             * @this Blockly.Block
             */
            init: function () {
                this.jsonInit({
                    "message0": pxtControlsForDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "VAR",
                            "variable": pxtControlsForDef.block["variable"],
                            "check": "Variable"
                        },
                        {
                            "type": "input_value",
                            "name": "TO",
                            "check": "Number"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": pxt.toolbox.getNamespaceColor('loops'),
                    "inputsInline": true
                });
                this.appendStatementInput('DO')
                    .appendField(pxtControlsForDef.block["appendField"]);

                let thisBlock = this;
                setHelpResources(this,
                    pxtControlsForId,
                    pxtControlsForDef.name,
                    function () {
                        return U.rlf(<string>pxtControlsForDef.tooltip,
                            thisBlock.getInputTargetBlock('VAR') ? thisBlock.getInputTargetBlock('VAR').getField('VAR').getText() : '');
                    },
                    pxtControlsForDef.url,
                    String(pxt.toolbox.getNamespaceColor('loops'))
                );
            },
            /**
             * Return all variables referenced by this block.
             * @return {!Array.<string>} List of variable names.
             * @this Blockly.Block
             */
            getVars: function (): any[] {
                return [this.getField('VAR').getText()];
            },
            /**
             * Notification that a variable is renaming.
             * If the name matches one of this block's variables, rename it.
             * @param {string} oldName Previous name of variable.
             * @param {string} newName Renamed variable.
             * @this Blockly.Block
             */
            renameVar: function (oldName: string, newName: string) {
                const varField = this.getField('VAR');
                if (Blockly.Names.equals(oldName, varField.getText())) {

                    varField.setText(newName);
                }
            },
            /**
             * Add menu option to create getter block for loop variable.
             * @param {!Array} options List of menu options to add to.
             * @this Blockly.Block
             */
            customContextMenu: function (options: any[]) {
                if (!this.isCollapsed()) {
                    let option: any = { enabled: true };
                    option.text = lf("Create 'get {0}'", name);
                    let xmlField = goog.dom.createDom('field', null, name);
                    xmlField.setAttribute('name', 'VAR');
                    let xmlBlock = goog.dom.createDom('block', null, xmlField) as HTMLElement;
                    xmlBlock.setAttribute('type', 'variables_get');
                    option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
                    options.push(option);
                }
            }
        };

        // controls_simple_for
        const controlsSimpleForId = "controls_simple_for";
        const controlsSimpleForDef = pxt.blocks.getBlockDefinition(controlsSimpleForId);
        Blockly.Blocks[controlsSimpleForId] = {
            /**
             * Block for 'for' loop.
             * @this Blockly.Block
             */
            init: function () {
                this.jsonInit({
                    "message0": controlsSimpleForDef.block["message0"],
                    "args0": [
                        {
                            "type": "field_variable",
                            "name": "VAR",
                            "variable": controlsSimpleForDef.block["variable"]
                            // Please note that most multilingual characters
                            // cannot be used as variable name at this point.
                            // Translate or decide the default variable name
                            // with care.
                        },
                        {
                            "type": "input_value",
                            "name": "TO",
                            "check": "Number"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": pxt.toolbox.getNamespaceColor('loops'),
                    "inputsInline": true
                });
                this.appendStatementInput('DO')
                    .appendField(controlsSimpleForDef.block["appendField"]);

                let thisBlock = this;
                setHelpResources(this,
                    controlsSimpleForId,
                    controlsSimpleForDef.name,
                    function () {
                        return U.rlf(<string>controlsSimpleForDef.tooltip, thisBlock.getField('VAR').getText());
                    },
                    controlsSimpleForDef.url,
                    String(pxt.toolbox.getNamespaceColor('loops'))
                );
            },
            /**
             * Return all variables referenced by this block.
             * @return {!Array.<string>} List of variable names.
             * @this Blockly.Block
             */
            getVars: function (): any[] {
                return [this.getField('VAR').getText()];
            },
            /**
             * Notification that a variable is renaming.
             * If the name matches one of this block's variables, rename it.
             * @param {string} oldName Previous name of variable.
             * @param {string} newName Renamed variable.
             * @this Blockly.Block
             */
            renameVar: function (oldName: string, newName: string) {
                const varField = this.getField('VAR');
                if (Blockly.Names.equals(oldName, varField.getText())) {

                    varField.setText(newName);
                }
            },
            /**
             * Add menu option to create getter block for loop variable.
             * @param {!Array} options List of menu options to add to.
             * @this Blockly.Block
             */
            customContextMenu: function (options: any[]) {
                if (!this.isCollapsed()) {
                    let option: any = { enabled: true };
                    let name = this.getField('VAR').getText();
                    option.text = lf("Create 'get {0}'", name);
                    let xmlField = goog.dom.createDom('field', null, name);
                    xmlField.setAttribute('name', 'VAR');
                    let xmlBlock = goog.dom.createDom('block', null, xmlField) as HTMLElement;
                    xmlBlock.setAttribute('type', 'variables_get');
                    option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
                    options.push(option);
                }
            }
        };
    }

    export let onShowContextMenu: (workspace: Blockly.Workspace,
        items: Blockly.ContextMenu.MenuItem[]) => void = undefined;

    /**
     * The following patch to blockly is to add the Trash icon on top of the toolbox,
     * the trash icon should only show when a user drags a block that is already in the workspace.
     */
    function initDrag() {
        const calculateDistance = (elemBounds: any, mouseX: any) => {
            return Math.abs(mouseX - (elemBounds.left + (elemBounds.width / 2)));
        }

        /**
         * Execute a step of block dragging, based on the given event.  Update the
         * display accordingly.
         * @param {!Event} e The most recent move event.
         * @param {!goog.math.Coordinate} currentDragDeltaXY How far the pointer has
         *     moved from the position at the start of the drag, in pixel units.
         * @package
         */
        const blockDrag = (<any>Blockly).BlockDragger.prototype.dragBlock;
        (<any>Blockly).BlockDragger.prototype.dragBlock = function (e: any, currentDragDeltaXY: any) {
            const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolboxDiv')[0] as HTMLElement;
            const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement;
            const trashIcon = document.getElementById("blocklyTrashIcon");
            if (blocklyTreeRoot && trashIcon) {
                const distance = calculateDistance(blocklyTreeRoot.getBoundingClientRect(), e.clientX);
                if (distance < 200) {
                    const opacity = distance / 200;
                    trashIcon.style.opacity = `${1 - opacity}`;
                    trashIcon.style.display = 'block';
                    blocklyTreeRoot.style.opacity = `${opacity}`;
                    if (distance < 50) {
                        blocklyToolboxDiv.classList.add('blocklyToolboxDeleting');
                    }
                } else {
                    trashIcon.style.display = 'none';
                    blocklyTreeRoot.style.opacity = '1';
                    blocklyToolboxDiv.classList.remove('blocklyToolboxDeleting');
                }
            }
            return blockDrag.call(this, e, currentDragDeltaXY);
        };

        /**
         * Finish dragging the workspace and put everything back where it belongs.
         * @param {!goog.math.Coordinate} currentDragDeltaXY How far the pointer has
         *     moved from the position at the start of the drag, in pixel coordinates.
         * @package
         */
        const blockEndDrag = (<any>Blockly).BlockDragger.prototype.endBlockDrag;
        (<any>Blockly).BlockDragger.prototype.endBlockDrag = function (e: any, currentDragDeltaXY: any) {
            blockEndDrag.call(this, e, currentDragDeltaXY);
            const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolboxDiv')[0] as HTMLElement;
            const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement;
            const trashIcon = document.getElementById("blocklyTrashIcon");
            if (trashIcon && blocklyTreeRoot) {
                trashIcon.style.display = 'none';
                blocklyTreeRoot.style.opacity = '1';
                blocklyToolboxDiv.classList.remove('blocklyToolboxDeleting');
            }
        }
    }

    function initContextMenu() {
        // Translate the context menu for blocks.
        const msg = Blockly.Msg;
        msg.DUPLICATE_BLOCK = lf("{id:block}Duplicate");
        msg.REMOVE_COMMENT = lf("Remove Comment");
        msg.ADD_COMMENT = lf("Add Comment");
        msg.EXTERNAL_INPUTS = lf("External Inputs");
        msg.INLINE_INPUTS = lf("Inline Inputs");
        msg.EXPAND_BLOCK = lf("Expand Block");
        msg.COLLAPSE_BLOCK = lf("Collapse Block");
        msg.ENABLE_BLOCK = lf("Enable Block");
        msg.DISABLE_BLOCK = lf("Disable Block");
        msg.DELETE_BLOCK = lf("Delete Block");
        msg.DELETE_X_BLOCKS = lf("Delete Blocks");
        msg.DELETE_ALL_BLOCKS = lf("Delete All Blocks");
        msg.HELP = lf("Help");

        // inject hook to handle openings docs
        (<any>Blockly).BlockSvg.prototype.showHelp_ = function () {
            const url = goog.isFunction(this.helpUrl) ? this.helpUrl() : this.helpUrl;
            if (url) (pxt.blocks.openHelpUrl || window.open)(url);
        };

        /**
         * Show the context menu for the workspace.
         * @param {!Event} e Mouse event.
         * @private
         */
        (<any>Blockly).WorkspaceSvg.prototype.showContextMenu_ = function (e: any) {
            if (this.options.readOnly || this.isFlyout) {
                return;
            }
            let menuOptions: Blockly.ContextMenu.MenuItem[] = [];
            let topBlocks = this.getTopBlocks();
            let topComments = this.getTopComments();
            let eventGroup = Blockly.utils.genUid();
            let ws = this;

            // Option to add a workspace comment.
            if (this.options.comments && !BrowserUtils.isIE()) {
                menuOptions.push((Blockly.ContextMenu as any).workspaceCommentOption(ws, e));
            }

            // Add a little animation to deleting.
            const DELAY = 10;

            // Option to delete all blocks.
            // Count the number of blocks that are deletable.
            let deleteList = Blockly.WorkspaceSvg.buildDeleteList_(topBlocks);
            let deleteCount = 0;
            for (let i = 0; i < deleteList.length; i++) {
                if (!deleteList[i].isShadow()) {
                    deleteCount++;
                }
            }

            function deleteNext() {
                (<any>Blockly).Events.setGroup(eventGroup);
                let block = deleteList.shift();
                if (block) {
                    if (block.workspace) {
                        block.dispose(false, true);
                        setTimeout(deleteNext, DELAY);
                    } else {
                        deleteNext();
                    }
                }
                Blockly.Events.setGroup(false);
            }

            const deleteOption = {
                text: deleteCount == 1 ? msg.DELETE_BLOCK : msg.DELETE_ALL_BLOCKS,
                enabled: deleteCount > 0,
                callback: function () {
                    pxt.tickEvent("blocks.context.delete", undefined, { interactiveConsent: true });
                    if (deleteCount < 2) {
                        deleteNext();
                    } else {
                        Blockly.confirm(lf("Delete all {0} blocks?", deleteCount), (ok) => {
                            if (ok) {
                                deleteNext();
                            }
                        });
                    }
                }
            };
            menuOptions.push(deleteOption);

            const formatCodeOption = {
                text: lf("Format Code"),
                enabled: true,
                callback: () => {
                    pxt.tickEvent("blocks.context.format", undefined, { interactiveConsent: true });
                    pxt.blocks.layout.flow(this, { useViewWidth: true });
                }
            }
            menuOptions.push(formatCodeOption);

            if (pxt.blocks.layout.screenshotEnabled()) {
                const screenshotOption = {
                    text: lf("Snapshot"),
                    enabled: topBlocks.length > 0 || topComments.length > 0,
                    callback: () => {
                        pxt.tickEvent("blocks.context.screenshot", undefined, { interactiveConsent: true });
                        pxt.blocks.layout.screenshotAsync(this)
                            .done((uri) => {
                                if (pxt.BrowserUtils.isSafari())
                                    uri = uri.replace(/^data:image\/[^;]/, 'data:application/octet-stream');
                                BrowserUtils.browserDownloadDataUri(
                                    uri,
                                    `${pxt.appTarget.nickname || pxt.appTarget.id}-${lf("screenshot")}.png`);
                            });
                    }
                };
                menuOptions.push(screenshotOption);
            }

            // custom options...
            if (onShowContextMenu)
                onShowContextMenu(this, menuOptions);

            Blockly.ContextMenu.show(e, menuOptions, this.RTL);
        };

        // Get rid of bumping behavior
        (Blockly as any).Constants.Logic.LOGIC_COMPARE_ONCHANGE_MIXIN.onchange = function () { }
    }

    function initOnStart() {
        // on_start
        const onStartDef = pxt.blocks.getBlockDefinition(ts.pxtc.ON_START_TYPE);
        Blockly.Blocks[ts.pxtc.ON_START_TYPE] = {
            init: function () {
                this.jsonInit({
                    "message0": onStartDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_dummy"
                        },
                        {
                            "type": "input_statement",
                            "name": "HANDLER"
                        }
                    ],
                    "colour": (pxt.appTarget.runtime ? pxt.appTarget.runtime.onStartColor : '') || pxt.toolbox.getNamespaceColor('loops')
                });

                setHelpResources(this,
                    ts.pxtc.ON_START_TYPE,
                    onStartDef.name,
                    onStartDef.tooltip,
                    onStartDef.url,
                    String((pxt.appTarget.runtime ? pxt.appTarget.runtime.onStartColor : '') || pxt.toolbox.getNamespaceColor('loops')),
                    undefined, undefined,
                    pxt.appTarget.runtime ? pxt.appTarget.runtime.onStartUnDeletable : false
                );
            }
        };

        Blockly.Blocks[pxtc.TS_STATEMENT_TYPE] = {
            init: function () {
                let that: Blockly.Block = this;
                that.setColour("#717171")
                that.setPreviousStatement(true);
                that.setNextStatement(true);
                that.setInputsInline(false);

                this.domToMutation = (element: Element) => {
                    const n = parseInt(element.getAttribute("numlines"));
                    this.declaredVariables = element.getAttribute("declaredvars");
                    for (let i = 0; i < n; i++) {
                        const line = element.getAttribute("line" + i);
                        that.appendDummyInput().appendField(line, "LINE" + i);
                    }
                };

                this.mutationToDom = () => {
                    let mutation = document.createElement("mutation");
                    let i = 0;

                    while (true) {
                        const val = that.getFieldValue("LINE" + i);
                        if (val === null) {
                            break;
                        }

                        mutation.setAttribute("line" + i, val);
                        i++;
                    }

                    mutation.setAttribute("numlines", i.toString());
                    if (this.declaredVariables) {
                        mutation.setAttribute("declaredvars", this.declaredVariables);
                    }

                    return mutation;
                };

                that.setEditable(false);

                setHelpResources(this,
                    pxtc.TS_STATEMENT_TYPE,
                    lf("JavaScript statement"),
                    lf("A JavaScript statement that could not be converted to blocks"),
                    '/blocks/javascript-blocks',
                    '#717171'
                );
            }
        };

        Blockly.Blocks[pxtc.TS_OUTPUT_TYPE] = {
            init: function () {
                let that: Blockly.Block = this;
                that.setColour("#717171")
                that.setPreviousStatement(false);
                that.setNextStatement(false);
                that.setOutput(true);
                that.setEditable(false);
                that.appendDummyInput().appendField(new pxtblockly.FieldTsExpression(""), "EXPRESSION");

                setHelpResources(that,
                    pxtc.TS_OUTPUT_TYPE,
                    lf("JavaScript expression"),
                    lf("A JavaScript expression that could not be converted to blocks"),
                    '/blocks/javascript-blocks',
                    "#717171"
                );
            }
        };

        if (pxt.appTarget.runtime && pxt.appTarget.runtime.pauseUntilBlock) {
            const blockOptions = pxt.appTarget.runtime.pauseUntilBlock;
            const blockDef = pxt.blocks.getBlockDefinition(ts.pxtc.PAUSE_UNTIL_TYPE);
            Blockly.Blocks[pxtc.PAUSE_UNTIL_TYPE] = {
                init: function () {
                    const color = blockOptions.color || pxt.toolbox.getNamespaceColor('loops');

                    this.jsonInit({
                        "message0": blockDef.block["message0"],
                        "args0": [
                            {
                                "type": "input_value",
                                "name": "PREDICATE",
                                "check": "Boolean"
                            }
                        ],
                        "inputsInline": true,
                        "previousStatement": null,
                        "nextStatement": null,
                        "colour": color
                    });

                    setHelpResources(this,
                        ts.pxtc.PAUSE_UNTIL_TYPE,
                        blockDef.name,
                        blockDef.tooltip,
                        blockDef.url,
                        color,
                        undefined/*colourSecondary*/,
                        undefined/*colourTertiary*/,
                        false/*undeletable*/
                    );
                }
            }
        }

        // pxt_controls_for_of
        const pxtControlsForOfId = "pxt_controls_for_of";
        const pxtControlsForOfDef = pxt.blocks.getBlockDefinition(pxtControlsForOfId);
        Blockly.Blocks[pxtControlsForOfId] = {
            init: function () {
                this.jsonInit({
                    "message0": pxtControlsForOfDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "VAR",
                            "variable": pxtControlsForOfDef.block["variable"],
                            "check": "Variable"
                        },
                        {
                            "type": "input_value",
                            "name": "LIST",
                            "check": "Array"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": pxt.toolbox.blockColors['loops'],
                    "inputsInline": true
                });

                this.appendStatementInput('DO')
                    .appendField(pxtControlsForOfDef.block["appendField"]);

                let thisBlock = this;
                setHelpResources(this,
                    pxtControlsForOfId,
                    pxtControlsForOfDef.name,
                    function () {
                        return U.rlf(<string>pxtControlsForOfDef.tooltip,
                            thisBlock.getInputTargetBlock('VAR') ? thisBlock.getInputTargetBlock('VAR').getField('VAR').getText() : '');
                    },
                    pxtControlsForOfDef.url,
                    String(pxt.toolbox.getNamespaceColor('loops'))
                );
            }
        };

        // controls_for_of
        const controlsForOfId = "controls_for_of";
        const controlsForOfDef = pxt.blocks.getBlockDefinition(controlsForOfId);
        Blockly.Blocks[controlsForOfId] = {
            init: function () {
                this.jsonInit({
                    "message0": controlsForOfDef.block["message0"],
                    "args0": [
                        {
                            "type": "field_variable",
                            "name": "VAR",
                            "variable": controlsForOfDef.block["variable"]
                            // Please note that most multilingual characters
                            // cannot be used as variable name at this point.
                            // Translate or decide the default variable name
                            // with care.
                        },
                        {
                            "type": "input_value",
                            "name": "LIST",
                            "check": "Array"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": pxt.toolbox.blockColors['loops'],
                    "inputsInline": true
                });

                this.appendStatementInput('DO')
                    .appendField(controlsForOfDef.block["appendField"]);

                let thisBlock = this;
                setHelpResources(this,
                    controlsForOfId,
                    controlsForOfDef.name,
                    function () {
                        return U.rlf(<string>controlsForOfDef.tooltip, thisBlock.getField('VAR').getText());
                    },
                    controlsForOfDef.url,
                    String(pxt.toolbox.getNamespaceColor('loops'))
                );
            }
        };

        // lists_index_get
        const listsIndexGetId = "lists_index_get";
        const listsIndexGetDef = pxt.blocks.getBlockDefinition(listsIndexGetId);
        Blockly.Blocks["lists_index_get"] = {
            init: function () {
                this.jsonInit({
                    "message0": listsIndexGetDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "LIST",
                            "check": "Array"
                        },
                        {
                            "type": "input_value",
                            "name": "INDEX",
                            "check": "Number"
                        }
                    ],
                    "colour": pxt.toolbox.blockColors['arrays'],
                    "outputShape": Blockly.OUTPUT_SHAPE_ROUND,
                    "inputsInline": true
                });

                this.setPreviousStatement(false);
                this.setNextStatement(false);
                this.setOutput(true);
                setBuiltinHelpInfo(this, listsIndexGetId);
            }
        };

        // lists_index_set
        const listsIndexSetId = "lists_index_set";
        const listsIndexSetDef = pxt.blocks.getBlockDefinition(listsIndexSetId);
        Blockly.Blocks[listsIndexSetId] = {
            init: function () {
                this.jsonInit({
                    "message0": listsIndexSetDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "LIST",
                            "check": "Array"
                        },
                        {
                            "type": "input_value",
                            "name": "INDEX",
                            "check": "Number"
                        },
                        {
                            "type": "input_value",
                            "name": "VALUE",
                            "check": null
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": pxt.toolbox.blockColors['arrays'],
                    "inputsInline": true
                });
                setBuiltinHelpInfo(this, listsIndexSetId);
            }
        };
    }

    function initMath() {
        // math_op2
        const mathOp2Id = "math_op2";
        const mathOp2Def = pxt.blocks.getBlockDefinition(mathOp2Id);
        const mathOp2Tooltips = <Map<string>>mathOp2Def.tooltip;
        Blockly.Blocks[mathOp2Id] = {
            init: function () {
                this.jsonInit({
                    "message0": lf("%1 of %2 and %3"),
                    "args0": [
                        {
                            "type": "field_dropdown",
                            "name": "op",
                            "options": [
                                [lf("{id:op}min"), "min"],
                                [lf("{id:op}max"), "max"]
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
                    "outputShape": Blockly.OUTPUT_SHAPE_ROUND,
                    "colour": pxt.toolbox.getNamespaceColor('math')
                });

                let thisBlock = this;
                setHelpResources(this,
                    mathOp2Id,
                    mathOp2Def.name,
                    function (block: any) {
                        return mathOp2Tooltips[block.getFieldValue('op')];
                    },
                    mathOp2Def.url,
                    pxt.toolbox.getNamespaceColor(mathOp2Def.category)
                );
            }
        };

        // math_op3
        const mathOp3Id = "math_op3";
        const mathOp3Def = pxt.blocks.getBlockDefinition(mathOp3Id);
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
                    "outputShape": Blockly.OUTPUT_SHAPE_ROUND,
                    "colour": pxt.toolbox.getNamespaceColor('math')
                });

                setBuiltinHelpInfo(this, mathOp3Id);
            }
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
                (Blockly as any).Colours.textField,
                (Blockly as any).Colours.textField,
                (Blockly as any).Colours.textField
            );
        })

        // builtin math_arithmetic
        const msg = Blockly.Msg;
        const mathArithmeticId = "math_arithmetic";
        const mathArithmeticDef = pxt.blocks.getBlockDefinition(mathArithmeticId);
        const mathArithmeticTooltips = <Map<string>>mathArithmeticDef.tooltip;
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

    function initVariables() {
        // We only give types to "special" variables like enum members and we don't
        // want those showing up in the variable dropdown so filter the variables
        // that show up to only ones that have an empty type
        (Blockly.FieldVariable.prototype as any).getVariableTypes_ = () => [""];

        let varname = lf("{id:var}item");
        Blockly.Variables.flyoutCategory = function (workspace: Blockly.WorkspaceSvg) {
            let xmlList: HTMLElement[] = [];

            if (!pxt.appTarget.appTheme.hideFlyoutHeadings) {
                // Add the Heading label
                let headingLabel = createFlyoutHeadingLabel(lf("Variables"),
                    pxt.toolbox.getNamespaceColor('variables'),
                    pxt.toolbox.getNamespaceIcon('variables'));
                xmlList.push(headingLabel);
            }

            let button = goog.dom.createDom('button') as HTMLElement;
            button.setAttribute('text', lf("Make a Variable..."));
            button.setAttribute('callbackkey', 'CREATE_VARIABLE');

            workspace.registerButtonCallback('CREATE_VARIABLE', function (button) {
                Blockly.Variables.createVariable(button.getTargetWorkspace());
            });

            xmlList.push(button);

            let blockList = Blockly.Variables.flyoutCategoryBlocks(workspace) as HTMLElement[];
            xmlList = xmlList.concat(blockList);
            return xmlList;
        };
        Blockly.Variables.flyoutCategoryBlocks = function (workspace) {
            let variableModelList = workspace.getVariablesOfType('');

            let xmlList: HTMLElement[] = [];
            if (variableModelList.length > 0) {
                let mostRecentVariable = variableModelList[variableModelList.length - 1];
                variableModelList.sort(Blockly.VariableModel.compareByName);
                // variables getters first
                for (let i = 0; i < variableModelList.length; i++) {
                    const variable = variableModelList[i];
                    if (Blockly.Blocks['variables_get']) {
                        let blockText = '<xml>' +
                            '<block type="variables_get" gap="8">' +
                            Blockly.Variables.generateVariableFieldXmlString(variable) +
                            '</block>' +
                            '</xml>';
                        let block = Blockly.Xml.textToDom(blockText).firstChild as HTMLElement;
                        xmlList.push(block);
                    }
                }
                xmlList[xmlList.length - 1].setAttribute('gap', '24');

                if (Blockly.Blocks['variables_set']) {
                    let gap = Blockly.Blocks['variables_change'] ? 8 : 24;
                    let blockText = '<xml>' +
                        '<block type="variables_set" gap="' + gap + '">' +
                        Blockly.Variables.generateVariableFieldXmlString(mostRecentVariable) +
                        '</block>' +
                        '</xml>';
                    let block = Blockly.Xml.textToDom(blockText).firstChild as HTMLElement;
                    {
                        let value = goog.dom.createDom('value');
                        value.setAttribute('name', 'VALUE');
                        let shadow = goog.dom.createDom('shadow');
                        shadow.setAttribute("type", "math_number");
                        value.appendChild(shadow);
                        let field = goog.dom.createDom('field');
                        field.setAttribute('name', 'NUM');
                        field.appendChild(document.createTextNode("0"));
                        shadow.appendChild(field);
                        block.appendChild(value);
                    }
                    xmlList.push(block);
                }
                if (Blockly.Blocks['variables_change']) {
                    let gap = Blockly.Blocks['variables_get'] ? 20 : 8;
                    let blockText = '<xml>' +
                        '<block type="variables_change" gap="' + gap + '">' +
                        Blockly.Variables.generateVariableFieldXmlString(mostRecentVariable) +
                        '<value name="DELTA">' +
                        '<shadow type="math_number">' +
                        '<field name="NUM">1</field>' +
                        '</shadow>' +
                        '</value>' +
                        '</block>' +
                        '</xml>';
                    let block = Blockly.Xml.textToDom(blockText).firstChild as HTMLElement;
                    {
                        let value = goog.dom.createDom('value');
                        value.setAttribute('name', 'VALUE');
                        let shadow = goog.dom.createDom('shadow');
                        shadow.setAttribute("type", "math_number");
                        value.appendChild(shadow);
                        let field = goog.dom.createDom('field');
                        field.setAttribute('name', 'NUM');
                        field.appendChild(document.createTextNode("1"));
                        shadow.appendChild(field);
                        block.appendChild(value);
                    }
                    xmlList.push(block);
                }
            }
            return xmlList;
        };

        // builtin variables_get
        const msg = Blockly.Msg;
        const variablesGetId = "variables_get";
        const variablesGetDef = pxt.blocks.getBlockDefinition(variablesGetId);
        msg.VARIABLES_GET_CREATE_SET = variablesGetDef.block["VARIABLES_GET_CREATE_SET"];
        installBuiltinHelpInfo(variablesGetId);

        const variablesReporterGetId = "variables_get_reporter";
        installBuiltinHelpInfo(variablesReporterGetId);

        // Dropdown menu of variables_get
        msg.RENAME_VARIABLE = lf("Rename variable...");
        msg.DELETE_VARIABLE = lf("Delete the \"%1\" variable");
        msg.DELETE_VARIABLE_CONFIRMATION = lf("Delete %1 uses of the \"%2\" variable?");

        // builtin variables_set
        const variablesSetId = "variables_set";
        const variablesSetDef = pxt.blocks.getBlockDefinition(variablesSetId);
        msg.VARIABLES_SET = variablesSetDef.block["VARIABLES_SET"];
        msg.VARIABLES_DEFAULT_NAME = varname;
        msg.VARIABLES_SET_CREATE_GET = lf("Create 'get %1'");
        installBuiltinHelpInfo(variablesSetId);

        // pxt variables_change
        const variablesChangeId = "variables_change";
        const variablesChangeDef = pxt.blocks.getBlockDefinition(variablesChangeId);
        Blockly.Blocks[variablesChangeId] = {
            init: function () {
                this.jsonInit({
                    "message0": variablesChangeDef.block["message0"],
                    "args0": [
                        {
                            "type": "field_variable",
                            "name": "VAR",
                            "variable": varname
                        },
                        {
                            "type": "input_value",
                            "name": "VALUE",
                            "check": "Number"
                        }
                    ],
                    "inputsInline": true,
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": pxt.toolbox.getNamespaceColor('variables')
                });

                setBuiltinHelpInfo(this, variablesChangeId);
            }
        };

        // New variable dialog
        msg.NEW_VARIABLE_TITLE = lf("New variable name:");
    }

    function initFunctions() {
        const msg = Blockly.Msg;

        // New functions implementation messages
        msg.FUNCTION_CREATE_NEW = lf("Make a Function...");
        msg.FUNCTION_WARNING_DUPLICATE_ARG = lf("Functions cannot use the same argument name more than once.");
        msg.FUNCTION_WARNING_ARG_NAME_IS_FUNCTION_NAME = lf("Argument names must not be the same as the function name.");
        msg.FUNCTION_WARNING_EMPTY_NAME = lf("Function and argument names cannot be empty.");
        msg.FUNCTIONS_DEFAULT_FUNCTION_NAME = lf("doSomething");
        msg.FUNCTIONS_DEFAULT_BOOLEAN_ARG_NAME = lf("bool");
        msg.FUNCTIONS_DEFAULT_STRING_ARG_NAME = lf("text");
        msg.FUNCTIONS_DEFAULT_NUMBER_ARG_NAME = lf("num");
        msg.FUNCTIONS_DEFAULT_CUSTOM_ARG_NAME = lf("arg");
        msg.PROCEDURES_HUE = pxt.toolbox.getNamespaceColor("functions");
        msg.REPORTERS_HUE = pxt.toolbox.getNamespaceColor("variables");

        // builtin procedures_defnoreturn
        const proceduresDefId = "procedures_defnoreturn";
        const proceduresDef = pxt.blocks.getBlockDefinition(proceduresDefId);

        msg.PROCEDURES_DEFNORETURN_TITLE = proceduresDef.block["PROCEDURES_DEFNORETURN_TITLE"];
        (msg as any).PROCEDURE_ALREADY_EXISTS = proceduresDef.block["PROCEDURE_ALREADY_EXISTS"];

        Blockly.Blocks['procedures_defnoreturn'].init = function () {
            let nameField = new Blockly.FieldTextInput('',
                (Blockly as any).Procedures.rename);
            //nameField.setSpellcheck(false); //TODO
            this.appendDummyInput()
                .appendField((Blockly as any).Msg.PROCEDURES_DEFNORETURN_TITLE)
                .appendField(nameField, 'NAME')
                .appendField('', 'PARAMS');
            this.setColour(pxt.toolbox.getNamespaceColor('functions'));
            this.arguments_ = [];
            this.argumentVarModels_ = [];
            this.setStartHat(true);
            this.setStatements_(true);
            this.statementConnection_ = null;
        };
        installBuiltinHelpInfo(proceduresDefId);

        // builtin procedures_defnoreturn
        const proceduresCallId = "procedures_callnoreturn";
        const proceduresCallDef = pxt.blocks.getBlockDefinition(proceduresCallId);

        msg.PROCEDURES_CALLRETURN_TOOLTIP = proceduresDef.tooltip;

        Blockly.Blocks['procedures_callnoreturn'] = {
            init: function () {
                let nameField = new pxtblockly.FieldProcedure('');
                nameField.setSourceBlock(this);
                this.appendDummyInput('TOPROW')
                    .appendField(proceduresCallDef.block['PROCEDURES_CALLNORETURN_TITLE'])
                    .appendField(nameField, 'NAME');
                this.setPreviousStatement(true);
                this.setNextStatement(true);
                this.setColour(pxt.toolbox.getNamespaceColor('functions'));
                this.arguments_ = [];
                this.quarkConnections_ = {};
                this.quarkIds_ = null;
            },
            /**
             * Returns the name of the procedure this block calls.
             * @return {string} Procedure name.
             * @this Blockly.Block
             */
            getProcedureCall: function () {
                // The NAME field is guaranteed to exist, null will never be returned.
                return /** @type {string} */ (this.getFieldValue('NAME'));
            },
            /**
             * Notification that a procedure is renaming.
             * If the name matches this block's procedure, rename it.
             * @param {string} oldName Previous name of procedure.
             * @param {string} newName Renamed procedure.
             * @this Blockly.Block
             */
            renameProcedure: function (oldName: string, newName: string) {
                if (Blockly.Names.equals(oldName, this.getProcedureCall())) {
                    this.setFieldValue(newName, 'NAME');
                }
            },
            /**
             * Procedure calls cannot exist without the corresponding procedure
             * definition.  Enforce this link whenever an event is fired.
             * @param {!Blockly.Events.Abstract} event Change event.
             * @this Blockly.Block
             */
            onchange: function (event: any) {
                if (!this.workspace || this.workspace.isFlyout || this.isInsertionMarker()) {
                    // Block is deleted or is in a flyout or insertion marker.
                    return;
                }
                if (event.type == Blockly.Events.CREATE &&
                    event.ids.indexOf(this.id) != -1) {
                    // Look for the case where a procedure call was created (usually through
                    // paste) and there is no matching definition.  In this case, create
                    // an empty definition block with the correct signature.
                    let name = this.getProcedureCall();
                    let def = Blockly.Procedures.getDefinition(name, this.workspace);
                    if (def && (def.type != this.defType_ ||
                        JSON.stringify((def as any).arguments_) != JSON.stringify(this.arguments_))) {
                        // The signatures don't match.
                        def = null;
                    }
                    if (!def) {
                        Blockly.Events.setGroup(event.group);
                        /**
                         * Create matching definition block.
                         * <xml>
                         *   <block type="procedures_defreturn" x="10" y="20">
                         *     <field name="NAME">test</field>
                         *   </block>
                         * </xml>
                         */
                        let xml = goog.dom.createDom('xml');
                        let block = goog.dom.createDom('block');
                        block.setAttribute('type', this.defType_);
                        let xy = this.getRelativeToSurfaceXY();
                        let x = xy.x + (Blockly as any).SNAP_RADIUS * (this.RTL ? -1 : 1);
                        let y = xy.y + (Blockly as any).SNAP_RADIUS * 2;
                        block.setAttribute('x', x);
                        block.setAttribute('y', y);
                        let field = goog.dom.createDom('field');
                        field.setAttribute('name', 'NAME');
                        field.appendChild(document.createTextNode(this.getProcedureCall()));
                        block.appendChild(field);
                        xml.appendChild(block);
                        pxt.blocks.domToWorkspaceNoEvents(xml, this.workspace);
                        Blockly.Events.setGroup(false);
                    }
                } else if (event.type == Blockly.Events.DELETE) {
                    // Look for the case where a procedure definition has been deleted,
                    // leaving this block (a procedure call) orphaned.  In this case, delete
                    // the orphan.
                    let name = this.getProcedureCall();
                    let def = Blockly.Procedures.getDefinition(name, this.workspace);
                    if (!def) {
                        Blockly.Events.setGroup(event.group);
                        this.dispose(true, false);
                        Blockly.Events.setGroup(false);
                    }
                }
            },
            mutationToDom: function () {
                const mutationElement = document.createElement("mutation");
                mutationElement.setAttribute("name", this.getProcedureCall());
                return mutationElement;
            },
            domToMutation: function (element: Element) {
                const name = element.getAttribute("name");
                this.renameProcedure(this.getProcedureCall(), name);
            },
            /**
             * Add menu option to find the definition block for this call.
             * @param {!Array} options List of menu options to add to.
             * @this Blockly.Block
             */
            customContextMenu: function (options: any) {
                let option: any = { enabled: true };
                option.text = (Blockly as any).Msg.PROCEDURES_HIGHLIGHT_DEF;
                let name = this.getProcedureCall();
                let workspace = this.workspace;
                option.callback = function () {
                    let def = Blockly.Procedures.getDefinition(name, workspace) as Blockly.BlockSvg;
                    if (def) def.select();
                };
                options.push(option);
            },
            defType_: 'procedures_defnoreturn'
        }
        installBuiltinHelpInfo(proceduresCallId);

        // New functions implementation function_definition
        const functionDefinitionId = "function_definition";
        const functionDefinition = pxt.blocks.getBlockDefinition(functionDefinitionId);

        msg.FUNCTIONS_EDIT_OPTION = functionDefinition.block["FUNCTIONS_EDIT_OPTION"];
        installBuiltinHelpInfo(functionDefinitionId);

        // New functions implementation function_call
        const functionCallId = "function_call";
        const functionCall = pxt.blocks.getBlockDefinition(functionCallId);

        msg.FUNCTIONS_CALL_TITLE = functionCall.block["FUNCTIONS_CALL_TITLE"];
        installBuiltinHelpInfo(functionCallId);

        Blockly.Procedures.flyoutCategory = function (workspace: Blockly.WorkspaceSvg) {
            let xmlList: HTMLElement[] = [];

            if (!pxt.appTarget.appTheme.hideFlyoutHeadings) {
                // Add the Heading label
                let headingLabel = createFlyoutHeadingLabel(lf("Functions"),
                    pxt.toolbox.getNamespaceColor('functions'),
                    pxt.toolbox.getNamespaceIcon('functions'),
                    'blocklyFlyoutIconfunctions');
                xmlList.push(headingLabel);
            }

            const newFunction = lf("Make a Function...");
            const newFunctionTitle = lf("New function name:");

            // Add the "Make a function" button
            let button = goog.dom.createDom('button');
            button.setAttribute('text', newFunction);
            button.setAttribute('callbackkey', 'CREATE_FUNCTION');

            let createFunction = (name: string) => {
                /**
                 * Create matching definition block.
                 * <xml>
                 *   <block type="procedures_defreturn" x="10" y="20">
                 *     <field name="NAME">test</field>
                 *   </block>
                 * </xml>
                 */
                let topBlock = workspace.getTopBlocks(true)[0];
                let x = 10, y = 10;
                if (topBlock) {
                    let xy = topBlock.getRelativeToSurfaceXY();
                    x = xy.x + (Blockly as any).SNAP_RADIUS * (topBlock.RTL ? -1 : 1);
                    y = xy.y + (Blockly as any).SNAP_RADIUS * 2;
                }
                let xml = goog.dom.createDom('xml');
                let block = goog.dom.createDom('block');
                block.setAttribute('type', 'procedures_defnoreturn');
                block.setAttribute('x', String(x));
                block.setAttribute('y', String(y));
                let field = goog.dom.createDom('field');
                field.setAttribute('name', 'NAME');
                field.appendChild(document.createTextNode(name));
                block.appendChild(field);
                xml.appendChild(block);
                let newBlockIds = pxt.blocks.domToWorkspaceNoEvents(xml, workspace);
                // Close flyout and highlight block
                Blockly.hideChaff();
                let newBlock = workspace.getBlockById(newBlockIds[0]) as Blockly.BlockSvg;
                newBlock.select();
                // Center on the new block so we know where it is
                workspace.centerOnBlock(newBlock.id);
            }

            workspace.registerButtonCallback('CREATE_FUNCTION', function (button) {
                let promptAndCheckWithAlert = (defaultName: string) => {
                    Blockly.prompt(newFunctionTitle, defaultName, function (newFunc) {
                        // Merge runs of whitespace.  Strip leading and trailing whitespace.
                        // Beyond this, all names are legal.
                        if (newFunc) {
                            newFunc = newFunc.replace(/[\s\xa0]+/g, ' ').replace(/^ | $/g, '');
                            if (newFunc == newFunction) {
                                // Ok, not ALL names are legal...
                                newFunc = null;
                            }
                        }
                        if (newFunc) {
                            if (workspace.getVariable(newFunc)) {
                                Blockly.alert((Blockly as any).Msg.VARIABLE_ALREADY_EXISTS.replace('%1',
                                    newFunc.toLowerCase()),
                                    function () {
                                        promptAndCheckWithAlert(newFunc);  // Recurse
                                    });
                            }
                            else if (!Blockly.Procedures.isLegalName_(newFunc, workspace)) {
                                Blockly.alert((Blockly.Msg as any).PROCEDURE_ALREADY_EXISTS.replace('%1',
                                    newFunc.toLowerCase()),
                                    function () {
                                        promptAndCheckWithAlert(newFunc);  // Recurse
                                    });
                            }
                            else {
                                createFunction(newFunc);
                            }
                        }
                    });
                };
                promptAndCheckWithAlert('doSomething');
            });
            xmlList.push(button as HTMLElement);

            function populateProcedures(procedureList: any, templateName: any) {
                for (let i = 0; i < procedureList.length; i++) {
                    let name = procedureList[i][0];
                    let args = procedureList[i][1];
                    // <block type="procedures_callnoreturn" gap="16">
                    //   <field name="NAME">name</field>
                    // </block>
                    let block = goog.dom.createDom('block');
                    block.setAttribute('type', templateName);
                    block.setAttribute('gap', '16');
                    block.setAttribute('colour', pxt.toolbox.getNamespaceColor('functions'));
                    let field = goog.dom.createDom('field', null, name);
                    field.setAttribute('name', 'NAME');
                    block.appendChild(field);
                    xmlList.push(block as HTMLElement);
                }
            }

            let tuple = Blockly.Procedures.allProcedures(workspace);
            populateProcedures(tuple[0], 'procedures_callnoreturn');

            return xmlList;
        }

        // Patch new functions flyout to add the heading
        const oldFlyout = Blockly.Functions.flyoutCategory;
        Blockly.Functions.flyoutCategory = (workspace) => {
            const elems = oldFlyout(workspace);
            const headingLabel = createFlyoutHeadingLabel(lf("Functions"),
                pxt.toolbox.getNamespaceColor('functions'),
                pxt.toolbox.getNamespaceIcon('functions'),
                'blocklyFlyoutIconfunctions');
            elems.unshift(headingLabel);
            return elems;
        };

        // Configure function editor argument icons
        const iconsMap: pxt.Map<string> = {
            number: pxt.blocks.defaultIconForArgType("number"),
            boolean: pxt.blocks.defaultIconForArgType("boolean"),
            string: pxt.blocks.defaultIconForArgType("string")
        };
        const customNames: pxsim.Map<string> = {};

        const functionOptions = pxt.appTarget.runtime && pxt.appTarget.runtime.functionsOptions;
        if (functionOptions && functionOptions.extraFunctionEditorTypes) {
            functionOptions.extraFunctionEditorTypes.forEach(t => {
                iconsMap[t.typeName] = t.icon || pxt.blocks.defaultIconForArgType();

                if (t.defaultName) {
                    customNames[t.typeName] = t.defaultName;
                }
            });
        }
        Blockly.PXTBlockly.FunctionUtils.argumentIcons = iconsMap;
        Blockly.PXTBlockly.FunctionUtils.argumentDefaultNames = customNames;

        if (Blockly.Blocks["argument_reporter_custom"]) {
            // The logic for setting the output check relies on the internals of PXT
            // too much to be refactored into pxt-blockly, so we need to monkey patch
            // it here
            Blockly.Blocks["argument_reporter_custom"].domToMutation = function(xmlElement: Element) {
                const typeName = xmlElement.getAttribute('typename');
                this.typeName_ = typeName;

                setOutputCheck(this, typeName, cachedBlockInfo);
            };
        }
    }

    function initLogic() {
        const msg = Blockly.Msg;

        // builtin controls_if
        const controlsIfId = "controls_if";
        const controlsIfDef = pxt.blocks.getBlockDefinition(controlsIfId);
        const controlsIfTooltips = <Map<string>>controlsIfDef.tooltip;
        msg.CONTROLS_IF_MSG_IF = controlsIfDef.block["CONTROLS_IF_MSG_IF"];
        msg.CONTROLS_IF_MSG_THEN = controlsIfDef.block["CONTROLS_IF_MSG_THEN"];
        msg.CONTROLS_IF_MSG_ELSE = controlsIfDef.block["CONTROLS_IF_MSG_ELSE"];
        msg.CONTROLS_IF_MSG_ELSEIF = controlsIfDef.block["CONTROLS_IF_MSG_ELSEIF"];
        msg.CONTROLS_IF_TOOLTIP_1 = controlsIfTooltips["CONTROLS_IF_TOOLTIP_1"];
        msg.CONTROLS_IF_TOOLTIP_2 = controlsIfTooltips["CONTROLS_IF_TOOLTIP_2"];
        msg.CONTROLS_IF_TOOLTIP_3 = controlsIfTooltips["CONTROLS_IF_TOOLTIP_3"];
        msg.CONTROLS_IF_TOOLTIP_4 = controlsIfTooltips["CONTROLS_IF_TOOLTIP_4"];
        installBuiltinHelpInfo(controlsIfId);

        // builtin logic_compare
        const logicCompareId = "logic_compare";
        const logicCompareDef = pxt.blocks.getBlockDefinition(logicCompareId);
        const logicCompareTooltips = <Map<string>>logicCompareDef.tooltip;
        msg.LOGIC_COMPARE_TOOLTIP_EQ = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_EQ"];
        msg.LOGIC_COMPARE_TOOLTIP_NEQ = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_NEQ"];
        msg.LOGIC_COMPARE_TOOLTIP_LT = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_LT"];
        msg.LOGIC_COMPARE_TOOLTIP_LTE = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_LTE"];
        msg.LOGIC_COMPARE_TOOLTIP_GT = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_GT"];
        msg.LOGIC_COMPARE_TOOLTIP_GTE = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_GTE"];
        installBuiltinHelpInfo(logicCompareId);

        // builtin logic_operation
        const logicOperationId = "logic_operation";
        const logicOperationDef = pxt.blocks.getBlockDefinition(logicOperationId);
        const logicOperationTooltips = <Map<string>>logicOperationDef.tooltip;
        msg.LOGIC_OPERATION_AND = logicOperationDef.block["LOGIC_OPERATION_AND"];
        msg.LOGIC_OPERATION_OR = logicOperationDef.block["LOGIC_OPERATION_OR"];
        msg.LOGIC_OPERATION_TOOLTIP_AND = logicOperationTooltips["LOGIC_OPERATION_TOOLTIP_AND"];
        msg.LOGIC_OPERATION_TOOLTIP_OR = logicOperationTooltips["LOGIC_OPERATION_TOOLTIP_OR"];
        installBuiltinHelpInfo(logicOperationId);

        // builtin logic_negate
        const logicNegateId = "logic_negate";
        const logicNegateDef = pxt.blocks.getBlockDefinition(logicNegateId);
        msg.LOGIC_NEGATE_TITLE = logicNegateDef.block["LOGIC_NEGATE_TITLE"];
        installBuiltinHelpInfo(logicNegateId);

        // builtin logic_boolean
        const logicBooleanId = "logic_boolean";
        const logicBooleanDef = pxt.blocks.getBlockDefinition(logicBooleanId);
        msg.LOGIC_BOOLEAN_TRUE = logicBooleanDef.block["LOGIC_BOOLEAN_TRUE"];
        msg.LOGIC_BOOLEAN_FALSE = logicBooleanDef.block["LOGIC_BOOLEAN_FALSE"];
        installBuiltinHelpInfo(logicBooleanId);
    }

    function initText() {
        // builtin text
        const textInfo = pxt.blocks.getBlockDefinition('text');
        installHelpResources('text', textInfo.name, textInfo.tooltip, textInfo.url,
            (Blockly as any).Colours.textField,
            (Blockly as any).Colours.textField,
            (Blockly as any).Colours.textField);

        // builtin text_length
        const msg = Blockly.Msg;
        const textLengthId = "text_length";
        const textLengthDef = pxt.blocks.getBlockDefinition(textLengthId);
        msg.TEXT_LENGTH_TITLE = textLengthDef.block["TEXT_LENGTH_TITLE"];

        // We have to override this block definition because the builtin block
        // allows both Strings and Arrays in its input check and that confuses
        // our Blockly compiler
        let block = Blockly.Blocks[textLengthId];
        block.init = function () {
            this.jsonInit({
                "message0": msg.TEXT_LENGTH_TITLE,
                "args0": [
                    {
                        "type": "input_value",
                        "name": "VALUE",
                        "check": ['String']
                    }
                ],
                "output": 'Number',
                "outputShape": Blockly.OUTPUT_SHAPE_ROUND
            });
        }
        installBuiltinHelpInfo(textLengthId);

        // builtin text_join
        const textJoinId = "text_join";
        const textJoinDef = pxt.blocks.getBlockDefinition(textJoinId);
        msg.TEXT_JOIN_TITLE_CREATEWITH = textJoinDef.block["TEXT_JOIN_TITLE_CREATEWITH"];
        installBuiltinHelpInfo(textJoinId);
    }

    function initDebugger() {

        Blockly.Blocks[pxtc.TS_DEBUGGER_TYPE] = {
            init: function () {
                let that: Blockly.Block = this;
                that.setColour(pxt.toolbox.getNamespaceColor('debug'))
                that.setPreviousStatement(true);
                that.setNextStatement(true);
                that.setInputsInline(false);
                that.appendDummyInput('ON_OFF')
                    .appendField(new Blockly.FieldLabel(lf("breakpoint"), undefined), "DEBUGGER")
                    .appendField(new pxtblockly.FieldBreakpoint("1", { 'type': 'number' } as any), "ON_OFF");

                setHelpResources(this,
                    pxtc.TS_DEBUGGER_TYPE,
                    lf("Debugger statement"),
                    lf("A debugger statement invokes any available debugging functionality"),
                    '/javascript/debugger',
                    pxt.toolbox.getNamespaceColor('debug')
                );
            }
        };
    }

    function initComments() {
        Blockly.Msg.WORKSPACE_COMMENT_DEFAULT_TEXT = '';
    }

    function initTooltip(blockInfo: pxtc.BlocksInfo) {

        const renderTip = (el: any) => {
            if (el.disabled)
                return lf("This block is disabled and will not run. Attach this block to an event to enable it.")
            let tip = el.tooltip;
            while (goog.isFunction(tip)) {
                tip = tip(el);
            }
            return tip;
        }
        // TODO: update this when pulling new blockly
        /**
         * Create the tooltip and show it.
         * @private
         */
        Blockly.Tooltip.show_ = function () {
            Blockly.Tooltip.poisonedElement_ = Blockly.Tooltip.element_;
            if (!Blockly.Tooltip.DIV) {
                return;
            }
            // Erase all existing text.
            goog.dom.removeChildren(/** @type {!Element} */(Blockly.Tooltip.DIV));
            // Get the new text.
            const card = Blockly.Tooltip.element_.codeCard as pxt.CodeCard;

            function render() {
                let rtl = Blockly.Tooltip.element_.RTL;
                let windowSize = goog.dom.getViewportSize();
                // Display the tooltip.
                let tooltip = Blockly.Tooltip.DIV as HTMLElement;
                tooltip.style.direction = rtl ? 'rtl' : 'ltr';
                tooltip.style.display = 'block';
                Blockly.Tooltip.visible = true;
                // Move the tooltip to just below the cursor.
                let anchorX = Blockly.Tooltip.lastX_;
                if (rtl) {
                    anchorX -= Blockly.Tooltip.OFFSET_X + tooltip.offsetWidth;
                } else {
                    anchorX += Blockly.Tooltip.OFFSET_X;
                }
                let anchorY = Blockly.Tooltip.lastY_ + Blockly.Tooltip.OFFSET_Y;

                if (anchorY + tooltip.offsetHeight >
                    windowSize.height + window.scrollY) {
                    // Falling off the bottom of the screen; shift the tooltip up.
                    anchorY -= tooltip.offsetHeight + 2 * Blockly.Tooltip.OFFSET_Y;
                }
                if (rtl) {
                    // Prevent falling off left edge in RTL mode.
                    anchorX = Math.max(Blockly.Tooltip.MARGINS - window.scrollX, anchorX);
                } else {
                    if (anchorX + tooltip.offsetWidth >
                        windowSize.width + window.scrollX - 2 * Blockly.Tooltip.MARGINS) {
                        // Falling off the right edge of the screen;
                        // clamp the tooltip on the edge.
                        anchorX = windowSize.width - tooltip.offsetWidth -
                            2 * Blockly.Tooltip.MARGINS;
                    }
                }
                tooltip.style.top = anchorY + 'px';
                tooltip.style.left = anchorX + 'px';
            }
            if (card) {
                const cardEl = pxt.docs.codeCard.render({
                    header: renderTip(Blockly.Tooltip.element_)
                })
                Blockly.Tooltip.DIV.appendChild(cardEl);
                render();
            } else {
                let tip = renderTip(Blockly.Tooltip.element_);
                tip = Blockly.utils.wrap(tip, Blockly.Tooltip.LIMIT);
                // Create new text, line by line.
                let lines = tip.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    let div = document.createElement('div');
                    div.appendChild(document.createTextNode(lines[i]));
                    Blockly.Tooltip.DIV.appendChild(div);
                }
                render();
            }
        }
    }

    function removeBlock(fn: pxtc.SymbolInfo) {
        delete Blockly.Blocks[fn.attributes.blockId];
        delete cachedBlocks[fn.attributes.blockId];
    }

    /**
     * <block type="pxt_wait_until">
     *     <value name="PREDICATE">
     *          <shadow type="logic_boolean">
     *              <field name="BOOL">TRUE</field>
     *          </shadow>
     *     </value>
     * </block>
     */
    export function mkPredicateBlock(type: string) {
        const block = document.createElement("block");
        block.setAttribute("type", type);

        const value = document.createElement("value");
        value.setAttribute("name", "PREDICATE");
        block.appendChild(value);

        const shadow = mkFieldBlock("logic_boolean", "BOOL", "TRUE", true);
        value.appendChild(shadow);

        return block;
    }

    export function mkFieldBlock(type: string, fieldName: string, fieldValue: string, isShadow: boolean) {
        const fieldBlock = document.createElement(isShadow ? "shadow" : "block");
        fieldBlock.setAttribute("type", Util.htmlEscape(type));

        const field = document.createElement("field");
        field.setAttribute("name", Util.htmlEscape(fieldName));
        field.textContent = Util.htmlEscape(fieldValue);
        fieldBlock.appendChild(field);

        return fieldBlock;
    }

    let jresIconCache: Map<string> = {};
    function iconToFieldImage(id: string): Blockly.FieldImage {
        let url = jresIconCache[id];
        if (!url) {
            pxt.log(`missing jres icon ${id}`)
            return undefined;
        }
        return new Blockly.FieldImage(url, 40, 40, Util.isUserLanguageRtl(), '');
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
        return pxt.Util.values(apis.byQName).filter(sym => sym.namespace === enumName);
    }

    export function getFixedInstanceDropdownValues(apis: pxtc.ApisInfo, qName: string) {
        return pxt.Util.values(apis.byQName).filter(sym => sym.kind === pxtc.SymbolKind.Variable
            && sym.attributes.fixedInstance
            && isSubtype(apis, sym.retType, qName));
    }

    export function generateIcons(instanceSymbols: pxtc.SymbolInfo[]) {
        const imgConv = new ImageConverter();
        instanceSymbols.forEach(v => {
            if (v.attributes.jresURL && !v.attributes.iconURL && U.startsWith(v.attributes.jresURL, "data:image/x-mkcd-f")) {
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
        const varField = block.getField(fieldName);

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
            (varField as any).initModel();
            const model = (varField as any).getVariable();
            model.name = newName;
            varField.setValue(model.getId());
        }
    }
}
