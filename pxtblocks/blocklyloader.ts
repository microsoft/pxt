/// <reference path="./blockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />
import Util = pxt.Util;

let lf = Util.lf;

namespace pxt.blocks {

    const blockColors: Util.StringMap<number> = {
        loops: 120,
        images: 45,
        variables: 330,
        text: 160,
        lists: 260
    }

    // list of built-in blocks, should be touched.
    const builtinBlocks: Util.StringMap<{
        block: B.BlockDefinition;
        symbol?: ts.pxt.SymbolInfo;
    }> = {};
    Object.keys(Blockly.Blocks)
        .forEach(k => builtinBlocks[k] = { block: Blockly.Blocks[k] });

    // blocks cached
    interface CachedBlock {
        hash: string;
        fn: ts.pxt.SymbolInfo;
        block: Blockly.BlockDefinition;
    }
    let cachedBlocks: Util.StringMap<CachedBlock> = {};
    let cachedToolbox: string = "";

    export function blockSymbol(type: string): ts.pxt.SymbolInfo {
        let b = cachedBlocks[type];
        return b ? b.fn : undefined;
    }

    function createShadowValue(name: string, type: string, v?: string, shadowType?: string): Element {
        if (v && v.slice(0, 1) == "\"")
            v = JSON.parse(v);
        if (type == "number" && shadowType && shadowType == "value") {
            let field = document.createElement("field");
            field.setAttribute("name", name);
            field.appendChild(document.createTextNode("0"));
            return field;
        }

        let value = document.createElement("value");
        value.setAttribute("name", name);

        let shadowTypeType = shadowType == "variables_get" ? "block" : "shadow";
        let shadow = document.createElement(shadowTypeType); value.appendChild(shadow);
        shadow.setAttribute("type", shadowType ? shadowType : type == "number" ? "math_number" : type == "string" ? "text" : type);
        if (type == "number" || type == "string") {
            let field = document.createElement("field"); shadow.appendChild(field);
            field.setAttribute("name", shadowType == "variables_get" ? "VAR" : type == "number" ? "NUM" : "TEXT");
            field.appendChild(document.createTextNode(v || (type == "number" ? "0" : "")));
        }
        return value;
    }

    export interface BlockParameter {
        name: string;
        type?: string;
        shadowType?: string;
        shadowValue?: string;
    }

    export function parameterNames(fn: ts.pxt.SymbolInfo): Util.StringMap<BlockParameter> {
        // collect blockly parameter name mapping
        const instance = fn.kind == ts.pxt.SymbolKind.Method || fn.kind == ts.pxt.SymbolKind.Property;
        let attrNames: Util.StringMap<BlockParameter> = {};

        if (instance) attrNames["this"] = { name: "this", type: fn.namespace };
        if (fn.parameters)
            fn.parameters.forEach(pr => attrNames[pr.name] = {
                name: pr.name,
                type: pr.type,
                shadowValue: pr.defaults ? pr.defaults[0] : undefined
            });
        if (fn.attributes.block) {
            Object.keys(attrNames).forEach(k => attrNames[k].name = "");
            let rx = /%([a-zA-Z0-9_]+)(=([a-zA-Z0-9_]+))?/g;
            let m: RegExpExecArray;
            let i = 0;
            while (m = rx.exec(fn.attributes.block)) {
                if (i == 0 && instance) {
                    attrNames["this"].name = m[1];
                    if (m[3]) attrNames["this"].shadowType = m[3];
                    m = rx.exec(fn.attributes.block); if (!m) break;
                }

                let at = attrNames[fn.parameters[i++].name];
                at.name = m[1];
                if (m[3]) at.shadowType = m[3];
            }
        }
        return attrNames;
    }

    function createToolboxBlock(info: ts.pxt.BlocksInfo, fn: ts.pxt.SymbolInfo, attrNames: Util.StringMap<BlockParameter>): HTMLElement {
        //
        // toolbox update
        //
        let block = document.createElement("block");
        block.setAttribute("type", fn.attributes.blockId);
        if (fn.attributes.blockGap)
            block.setAttribute("gap", fn.attributes.blockGap);
        if ((fn.kind == ts.pxt.SymbolKind.Method || fn.kind == ts.pxt.SymbolKind.Property)
            && attrNames["this"]) {
            let attr = attrNames["this"];
            block.appendChild(createShadowValue(attr.name, attr.type, attr.shadowValue || attr.name, attr.shadowType || "variables_get"));
        }
        if (fn.parameters)
            fn.parameters.filter(pr => !!attrNames[pr.name].name &&
                (/^(string|number)$/.test(attrNames[pr.name].type)
                    || !!attrNames[pr.name].shadowType
                    || !!attrNames[pr.name].shadowValue))
                .forEach(pr => {
                    let attr = attrNames[pr.name];
                    block.appendChild(createShadowValue(attr.name, attr.type, attr.shadowValue, attr.shadowType));
                })
        return block;
    }

    function injectToolbox(tb: Element, info: ts.pxt.BlocksInfo, fn: ts.pxt.SymbolInfo, block: HTMLElement) {
        let ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
        let nsn = info.apis.byQName[ns];
        if (nsn) ns = nsn.attributes.block || ns;
        let catName = Util.capitalize(ns)
        let category = categoryElement(tb, catName);
        if (!category) {
            pxt.debug('toolbox: adding category ' + ns)
            category = document.createElement("category");
            category.setAttribute("name", catName)
            let nsWeight = (nsn ? nsn.attributes.weight : 50) || 50;
            category.setAttribute("weight", nsWeight.toString())
            if (nsn && nsn.attributes.color) category.setAttribute("colour", nsn.attributes.color)
            else if (blockColors[ns]) category.setAttribute("colour", blockColors[ns].toString());
            // find the place to insert the category        
            let categories = tb.querySelectorAll("category");
            let ci = 0;
            for (ci = 0; ci < categories.length; ++ci) {
                let cat = categories.item(ci);
                if (parseInt(cat.getAttribute("weight") || "50") < nsWeight) {
                    tb.insertBefore(category, cat);
                    break;
                }
            }
            if (ci == categories.length)
                tb.appendChild(category);
        }
        category.appendChild(block);
    }

    let iconCanvasCache: Util.StringMap<HTMLCanvasElement> = {};
    function iconToFieldImage(c: string): Blockly.FieldImage {
        let canvas = iconCanvasCache[c];
        if (!canvas) {
            canvas = iconCanvasCache[c] = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            let ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.font = "56px Icons";
            ctx.textAlign = "center";
            ctx.fillText(c, canvas.width / 2, 56);
        }
        return new Blockly.FieldImage(canvas.toDataURL(), 16, 16, '');
    }

    function injectBlockDefinition(info: ts.pxt.BlocksInfo, fn: ts.pxt.SymbolInfo, attrNames: Util.StringMap<BlockParameter>, blockXml: HTMLElement): boolean {
        let id = fn.attributes.blockId;

        if (builtinBlocks[id]) {
            pxt.reportError('trying to override builtin block ' + id, null);
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
                init: function () { initBlock(this, info, fn, attrNames) }
            }
        }

        cachedBlocks[id] = cachedBlock;
        Blockly.Blocks[id] = cachedBlock.block;

        return true;
    }

    function initField(i: any, ni: number, fn: ts.pxt.SymbolInfo, pre: string, right?: boolean, type?: string): any {
        if (ni == 0 && fn.attributes.icon)
            i.appendField(iconToFieldImage(fn.attributes.icon))
        if (pre)
            i.appendField(pre);
        if (right)
            i.setAlign(Blockly.ALIGN_RIGHT)
        // ignore generic types
        if (type && type != "T")
            i.setCheck(type);
        return i;
    }

    function cleanOuterHTML(el: HTMLElement): string {
        // remove IE11 junk
        return el.outerHTML.replace(/^<\?[^>]*>/, '');
    }

    function mkCard(fn: ts.pxt.SymbolInfo, blockXml: HTMLElement): pxt.CodeCard {
        let xml = blockXml.outerHTML
            // remove IE11
            .replace(/^<\?[^>]*>/, '');
        return {
            name: fn.namespace + '.' + fn.name,
            description: fn.attributes.jsDoc,
            url: fn.attributes.help ? 'reference/' + fn.attributes.help.replace(/^\//, '') : undefined,
            blocksXml: `<xml xmlns="http://www.w3.org/1999/xhtml">${cleanOuterHTML(blockXml)}</xml>`,
        }
    }

    function initBlock(block: any, info: ts.pxt.BlocksInfo, fn: ts.pxt.SymbolInfo, attrNames: Util.StringMap<BlockParameter>) {
        const ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
        const instance = fn.kind == ts.pxt.SymbolKind.Method || fn.kind == ts.pxt.SymbolKind.Property;
        const nsinfo = info.apis.byQName[ns];

        if (fn.attributes.help)
            block.setHelpUrl("/reference/" + fn.attributes.help.replace(/^\//, ''));

        block.setTooltip(fn.attributes.jsDoc);
        block.setColour(
            fn.attributes.color
            || (nsinfo ? nsinfo.attributes.color : undefined)
            || blockColors[ns]
            || 255);

        fn.attributes.block.split('|').map((n, ni) => {
            let m = /([^%]*)\s*%([a-zA-Z0-9_]+)/.exec(n);
            let i: any;
            if (!m) {
                i = initField(block.appendDummyInput(), ni, fn, n);
            } else {
                // find argument
                let pre = m[1]; if (pre) pre = pre.trim();
                let p = m[2];
                let n = Object.keys(attrNames).filter(k => attrNames[k].name == p)[0];
                if (!n) {
                    console.error("block " + fn.attributes.blockId + ": unkown parameter " + p);
                    return;
                }
                let pr = attrNames[n];
                if (/\[\]$/.test(pr.type)) { // Array type
                    i = initField(block.appendValueInput(p), ni, fn, pre, true, "Array");
                } else if (instance && n == "this") {
                    i = initField(block.appendValueInput(p), ni, fn, pre, true, pr.type);
                } else if (pr.type == "number") {
                    if (pr.shadowType && pr.shadowType == "value") {
                        i = block.appendDummyInput();
                        if (pre) i.appendField(pre)
                        i.appendField(new Blockly.FieldTextInput("0", Blockly.FieldTextInput.numberValidator), p);
                    }
                    else i = initField(block.appendValueInput(p), ni, fn, pre, true, "Number");
                }
                else if (pr.type == "boolean") {
                    i = initField(block.appendValueInput(p), ni, fn, pre, true, "Boolean");
                } else if (pr.type == "string") {
                    i = initField(block.appendValueInput(p), ni, fn, pre, true, "String");
                } else {
                    let prtype = Util.lookup(info.apis.byQName, pr.type);
                    if (prtype && prtype.kind == ts.pxt.SymbolKind.Enum) {
                        let dd = Util.values(info.apis.byQName)
                            .filter(e => e.namespace == pr.type)
                            .map(v => [v.attributes.block || v.attributes.blockId || v.name, v.namespace + "." + v.name]);
                        i = initField(block.appendDummyInput(), ni, fn, pre, true);
                        i.appendField(new Blockly.FieldDropdown(dd), attrNames[n].name);
                    } else {
                        i = initField(block.appendValueInput(p), ni, fn, pre, true, pr.type);
                    }
                }
            }
        });

        let body = fn.parameters ? fn.parameters.filter(pr => pr.type == "() => void")[0] : undefined;
        if (body) {
            block.appendStatementInput("HANDLER")
                .setCheck("null");
        }

        if (fn.attributes.imageLiteral) {
            for (let r = 0; r < 5; ++r) {
                let ri = block.appendDummyInput();
                for (let c = 0; c < fn.attributes.imageLiteral * 5; ++c) {
                    if (c > 0 && c % 5 == 0) ri.appendField("  ");
                    else if (c > 0) ri.appendField(" ");
                    ri.appendField(new Blockly.FieldCheckbox("FALSE"), "LED" + c + r);
                }
            }
        }

        block.setInputsInline(!fn.attributes.blockExternalInputs && fn.parameters.length < 4 && !fn.attributes.imageLiteral);

        switch (fn.retType) {
            case "number": block.setOutput(true, "Number"); break;
            case "string": block.setOutput(true, "String"); break;
            case "boolean": block.setOutput(true, "Boolean"); break;
            case "void": break; // do nothing
            //TODO
            default: block.setOutput(true, fn.retType);
        }

        // hook up/down if return value is void
        block.setPreviousStatement(fn.retType == "void");
        block.setNextStatement(fn.retType == "void");

        block.setTooltip(fn.attributes.jsDoc);
    }

    function removeCategory(tb: Element, name: string) {
        let e = categoryElement(tb, name);
        if (e && e.parentElement)
            e.parentElement.removeChild(e);
    }

    export function initBlocks(blockInfo: ts.pxt.BlocksInfo, workspace?: Blockly.Workspace, toolbox?: Element): void {
        init();

        // create new toolbox and update block definitions
        let tb = toolbox ? <Element>toolbox.cloneNode(true) : undefined;
        blockInfo.blocks.sort((f1, f2) => {
            let ns1 = blockInfo.apis.byQName[f1.namespace.split('.')[0]];
            let ns2 = blockInfo.apis.byQName[f2.namespace.split('.')[0]];
            if (ns1 && !ns2) return -1; if (ns2 && !ns1) return 1;
            let c = 0;
            if (ns1 && ns2) {
                c = (ns2.attributes.weight || 50) - (ns1.attributes.weight || 50);
                if (c != 0) return c;
            }
            c = (f2.attributes.weight || 50) - (f1.attributes.weight || 50);
            return c;
        })

        let currentBlocks: Util.StringMap<number> = {};
        const dbg = pxt.debugMode();
        // create new toolbox and update block definitions
        blockInfo.blocks
            .filter(fn => !tb || !tb.querySelector(`block[type='${fn.attributes.blockId}']`))
            .forEach(fn => {
                if (fn.attributes.blockBuiltin) {
                    Util.assert(!!builtinBlocks[fn.attributes.blockId]);
                    builtinBlocks[fn.attributes.blockId].symbol = fn;
                } else {
                    let pnames = parameterNames(fn);
                    let block = createToolboxBlock(blockInfo, fn, pnames);
                    if (injectBlockDefinition(blockInfo, fn, pnames, block)) {
                        if (tb && (!fn.attributes.debug || dbg))
                            injectToolbox(tb, blockInfo, fn, block);
                        currentBlocks[fn.attributes.blockId] = 1;
                    }
                }
            })

        // remove ununsed blocks
        Object
            .keys(cachedBlocks).filter(k => !currentBlocks[k])
            .forEach(k => removeBlock(cachedBlocks[k].fn));

        // remove unused categories
        let config = pxt.appTarget.runtime || {};
        if (!config.mathBlocks) removeCategory(tb, "Math");
        if (!config.textBlocks) removeCategory(tb, "Text");
        if (!config.listsBlocks) removeCategory(tb, "Lists");
        if (!config.variablesBlocks) removeCategory(tb, "Variables");
        if (!config.logicBlocks) removeCategory(tb, "Logic");
        if (!config.loopsBlocks) removeCategory(tb, "Loops");

        // add extra blocks
        if (tb && pxt.appTarget.runtime && pxt.appTarget.runtime.extraBlocks) {
            pxt.appTarget.runtime.extraBlocks.forEach(eb => {
                let cat = categoryElement(tb, eb.namespace);
                if (cat) {
                    let el = document.createElement("block");
                    el.setAttribute("type", eb.type);
                    el.setAttribute("weight", (eb.weight || 50).toString());
                    if (eb.gap) el.setAttribute("gap", eb.gap.toString());
                    if (eb.fields) {
                        for (let f in eb.fields) {
                            let fe = document.createElement("field");
                            fe.setAttribute("name", f);
                            fe.appendChild(document.createTextNode(eb.fields[f]));
                            el.appendChild(fe);
                        }
                    }
                    cat.appendChild(el);
                } else {
                    console.error(`trying to add block ${eb.type} to unknown category ${eb.namespace}`)
                }
            })
        }

        // update shadow types
        if (tb) {
            $(tb).find('shadow:empty').each((i, shadow) => {
                let type = shadow.getAttribute('type');
                let b = $(tb).find(`block[type="${type}"]`)[0];
                if (b) shadow.innerHTML = b.innerHTML;
            })

            // update toolbox   
            if (tb.innerHTML != cachedToolbox && workspace) {
                cachedToolbox = tb.innerHTML;
                workspace.updateToolbox(tb)
            }
        }
    }

    function categoryElement(tb: Element, name: string): Element {
        return tb ? tb.querySelector(`category[name="${Util.capitalize(name)}"]`) : undefined;
    }

    export function cleanBlocks() {
        pxt.debug('removing all custom blocks')
        for (let b in cachedBlocks)
            removeBlock(cachedBlocks[b].fn);
    }

    function removeBlock(fn: ts.pxt.SymbolInfo) {
        delete Blockly.Blocks[fn.attributes.blockId];
        delete cachedBlocks[fn.attributes.blockId];
    }

    let blocklyInitialized = false;
    function init() {
        if (blocklyInitialized) blocklyInitialized = true;

        goog.provide('Blockly.Blocks.device');
        goog.require('Blockly.Blocks');

        if (window.navigator.pointerEnabled) {
            (Blockly.bindEvent_ as any).TOUCH_MAP = {
                mousedown: 'pointerdown',
                mousemove: 'pointermove',
                mouseup: 'pointerup'
            };
            document.body.style.touchAction = 'none';
        }

        Blockly.FieldCheckbox.CHECK_CHAR = '■';

        initContextMenu();
        initMath();
        initVariables();
        initLoops();

        // hats creates issues when trying to round-trip events between JS and blocks. To better support that scenario,
        // we're taking off hats.
        // Blockly.BlockSvg.START_HAT = true;

        // Here's a helper to override the help URL for a block that's *already defined
        // by Blockly*. For blocks that we define ourselves, just change the call to
        // setHelpUrl in the corresponding definition above.
        function monkeyPatchBlock(id: string, name: string, url: string) {
            let old = Blockly.Blocks[id].init;
            if (!old) return;
            // fix sethelpurl
            Blockly.Blocks[id].init = function () {
                // The magic of dynamic this-binding.
                old.call(this);
                this.setHelpUrl(/*"/blocks/" + */url);
                if (!this.codeCard) {
                    let tb = document.getElementById('blocklyToolboxDefinition');
                    let xml: HTMLElement = tb ? tb.querySelector("category block[type~='" + id + "']") as HTMLElement : undefined;
                    this.codeCard = <pxt.CodeCard>{
                        header: name,
                        name: name,
                        software: 1,
                        description: goog.isFunction(this.tooltip) ? this.tooltip() : this.tooltip,
                        blocksXml: xml ? (`<xml xmlns="http://www.w3.org/1999/xhtml">` + (cleanOuterHTML(xml) || `<block type="${id}"</block>`) + "</xml>") : undefined,
                        url: url
                    }
                }
            };
        }

        monkeyPatchBlock("controls_if", lf("a conditional statement"), "blocks/logic/if");
        monkeyPatchBlock("controls_repeat_ext", lf("a loop that repeats and increments an index"), "blocks/loops/repeat");
        monkeyPatchBlock("device_while", lf("a loop that repeats while the condition is true"), "blocks/loops/while");

        monkeyPatchBlock("variables_set", lf("assign the value of a variable"), "blocks/variables/assign");
        monkeyPatchBlock("variables_change", lf("update the value of a number variable"), "blocks/variables/change");

        monkeyPatchBlock("logic_compare", lf("comparing two numbers"), "blocks/logic/boolean");
        monkeyPatchBlock("logic_operation", lf("boolean operation"), "blocks/logic/boolean");
        monkeyPatchBlock("logic_negate", lf("logical negation"), "blocks/logic/boolean");
        monkeyPatchBlock("logic_boolean", lf("a `true` or `false` value"), "blocks/logic/boolean");

        monkeyPatchBlock("math_number", !pxt.appTarget.compile || !pxt.appTarget.compile.floatingPoint ? lf("a integer number") : lf("a decimal number"), "types/number");
        monkeyPatchBlock("math_arithmetic", lf("arithmetic operation"), "blocks/math");
        monkeyPatchBlock("math_op2", lf("minimum or maximum of 2 numbers"), "blocks/math");
        monkeyPatchBlock("math_op3", lf("absolute value of a number"), "blocks/math");
        monkeyPatchBlock("device_random", lf("pick random number"), "blocks/math");

        monkeyPatchBlock("text", lf("a piece of text"), "text");
        monkeyPatchBlock("text_length", lf("number of characters in the string"), "text/length");
    }

    function initLoops() {
        Blockly.Blocks['device_while'] = {
            init: function () {
                this.setHelpUrl('/blocks/loops/while');
                this.setColour(blockColors['loops']);
                this.appendValueInput("COND")
                    .setCheck("Boolean")
                    .appendField("while");
                this.appendStatementInput("DO")
                    .appendField("do");
                this.setPreviousStatement(true);
                this.setNextStatement(true);
                this.setTooltip(lf("Run the same sequence of actions while the condition is met."));
            }
        };

        Blockly.Blocks['controls_simple_for'] = {
            /**
             * Block for 'for' loop.
             * @this Blockly.Block
             */
            init: function () {
                this.setHelpUrl("/blocks/loops/for");
                this.setColour((<any>Blockly.Blocks).loops.HUE);
                this.appendDummyInput()
                    .appendField("for")
                    .appendField(new Blockly.FieldVariable(null), 'VAR')
                    .appendField("from 0 to");
                this.appendValueInput("TO")
                    .setCheck("Number")
                    .setAlign(Blockly.ALIGN_RIGHT);
                this.appendStatementInput('DO')
                    .appendField(Blockly.Msg.CONTROLS_FOR_INPUT_DO);
                this.setPreviousStatement(true);
                this.setNextStatement(true);
                this.setInputsInline(true);
                // Assign 'this' to a variable for use in the tooltip closure below.
                let thisBlock = this;
                this.setTooltip(function () {
                    return Blockly.Msg.CONTROLS_FOR_TOOLTIP.replace('%1',
                        thisBlock.getFieldValue('VAR'));
                });
            },
            /**
             * Return all variables referenced by this block.
             * @return {!Array.<string>} List of variable names.
             * @this Blockly.Block
             */
            getVars: function (): any[] {
                return [this.getFieldValue('VAR')];
            },
            /**
             * Notification that a variable is renaming.
             * If the name matches one of this block's variables, rename it.
             * @param {string} oldName Previous name of variable.
             * @param {string} newName Renamed variable.
             * @this Blockly.Block
             */
            renameVar: function (oldName: string, newName: string) {
                if (Blockly.Names.equals(oldName, this.getFieldValue('VAR'))) {
                    this.setFieldValue(newName, 'VAR');
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
                    let name = this.getFieldValue('VAR');
                    option.text = Blockly.Msg.VARIABLES_SET_CREATE_GET.replace('%1', name);
                    let xmlField = goog.dom.createDom('field', null, name);
                    xmlField.setAttribute('name', 'VAR');
                    let xmlBlock = goog.dom.createDom('block', null, xmlField);
                    xmlBlock.setAttribute('type', 'variables_get');
                    option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
                    options.push(option);
                }
            }
        };
    }

    export var onShowContextMenu: (workspace: Blockly.Workspace,
        items: Blockly.ContextMenu.MenuItem[]) => void = undefined;

    function initContextMenu() {
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
            let topBlocks = this.getTopBlocks(true);
            let eventGroup = Blockly.genUid();

            // Options to undo/redo previous action.
            let undoOption: any = {};
            undoOption.text = Blockly.Msg.UNDO;
            undoOption.enabled = this.undoStack_.length > 0;
            undoOption.callback = this.undo.bind(this, false);
            menuOptions.push(undoOption);
            let redoOption: any = {};
            redoOption.text = Blockly.Msg.REDO;
            redoOption.enabled = this.redoStack_.length > 0;
            redoOption.callback = this.undo.bind(this, true);
            menuOptions.push(redoOption);

            // Add a little animation to collapsing and expanding.
            const DELAY = 10;
            if (this.options.collapse) {
                let hasCollapsedBlocks = false;
                let hasExpandedBlocks = false;
                for (let i = 0; i < topBlocks.length; i++) {
                    let block = topBlocks[i];
                    while (block) {
                        if (block.isCollapsed()) {
                            hasCollapsedBlocks = true;
                        } else {
                            hasExpandedBlocks = true;
                        }
                        block = block.getNextBlock();
                    }
                }

                /**
                 * Option to collapse or expand top blocks.
                 * @param {boolean} shouldCollapse Whether a block should collapse.
                 * @private
                 */
                let toggleOption = function (shouldCollapse: boolean) {
                    let ms = 0;
                    for (let i = 0; i < topBlocks.length; i++) {
                        let block = topBlocks[i];
                        while (block) {
                            setTimeout(block.setCollapsed.bind(block, shouldCollapse), ms);
                            block = block.getNextBlock();
                            ms += DELAY;
                        }
                    }
                };

                // Option to collapse top blocks.
                let collapseOption: any = { enabled: hasExpandedBlocks };
                collapseOption.text = Blockly.Msg.COLLAPSE_ALL;
                collapseOption.callback = function () {
                    toggleOption(true);
                };
                menuOptions.push(collapseOption);

                // Option to expand top blocks.
                let expandOption: any = { enabled: hasCollapsedBlocks };
                expandOption.text = Blockly.Msg.EXPAND_ALL;
                expandOption.callback = function () {
                    toggleOption(false);
                };
                menuOptions.push(expandOption);
            }

            // Option to delete all blocks.
            // Count the number of blocks that are deletable.
            let deleteList: any[] = [];
            function addDeletableBlocks(block: any) {
                if (block.isDeletable()) {
                    deleteList = deleteList.concat(block.getDescendants());
                } else {
                    let children = block.getChildren();
                    for (let i = 0; i < children.length; i++) {
                        addDeletableBlocks(children[i]);
                    }
                }
            }
            for (let i = 0; i < topBlocks.length; i++) {
                addDeletableBlocks(topBlocks[i]);
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

            let deleteOption = {
                text: deleteList.length == 1 ? Blockly.Msg.DELETE_BLOCK :
                    Blockly.Msg.DELETE_X_BLOCKS.replace('%1', String(deleteList.length)),
                enabled: deleteList.length > 0,
                callback: function () {
                    if (deleteList.length < 2 ||
                        window.confirm(Blockly.Msg.DELETE_ALL_BLOCKS.replace('%1',
                            String(deleteList.length)))) {
                        deleteNext();
                    }
                }
            };
            menuOptions.push(deleteOption);

            let shuffleOption = {
                text: lf("Shuffle Blocks"),
                enabled: true,
                callback: () => {
                    pxt.blocks.layout.shuffle(this, 1);
                }
            };
            menuOptions.push(shuffleOption);

            // custom options...
            if (onShowContextMenu)
                onShowContextMenu(this, menuOptions);

            Blockly.ContextMenu.show(e, menuOptions, this.RTL);
        };


    }

    function initMath() {
        Blockly.Blocks['math_op2'] = {
            init: function () {
                this.setHelpUrl('/blocks/math');
                this.setColour(230);
                this.appendValueInput("x")
                    .setCheck("Number")
                    .appendField(new Blockly.FieldDropdown([["min", "min"], ["max", "max"]]), "op")
                    .appendField("of");
                this.appendValueInput("y")
                    .setCheck("Number")
                    .appendField("and");
                this.setInputsInline(true);
                this.setOutput(true, "Number");
                this.setTooltip(lf("Math operators."));
            }
        };

        Blockly.Blocks['math_op3'] = {
            init: function () {
                this.setHelpUrl('/blocks/math/abs');
                this.setColour(230);
                this.appendDummyInput()
                    .appendField("absolute of");
                this.appendValueInput("x")
                    .setCheck("Number")
                this.setInputsInline(true);
                this.setOutput(true, "Number");
                this.setTooltip(lf("Math operators."));
            }
        };

        Blockly.Blocks['device_random'] = {
            init: function () {
                this.setHelpUrl('/blocks/math/random');
                this.setColour(230);
                this.appendDummyInput()
                    .appendField("pick random 0 to");
                this.appendValueInput("limit")
                    .setCheck("Number")
                    .setAlign(Blockly.ALIGN_RIGHT);
                this.setInputsInline(true);
                this.setOutput(true, "Number");
                this.setTooltip(lf("Returns a random integer between 0 and the specified bound (inclusive)."));
            }
        };
    }

    function initVariables() {
        Blockly.Variables.flyoutCategory = function (workspace) {
            let variableList = Blockly.Variables.allVariables(workspace);
            variableList.sort(goog.string.caseInsensitiveCompare);
            // In addition to the user's variables, we also want to display the default
            // variable name at the top.  We also don't want this duplicated if the
            // user has created a variable of the same name.
            goog.array.remove(variableList, Blockly.Msg.VARIABLES_DEFAULT_NAME);
            variableList.unshift(Blockly.Msg.VARIABLES_DEFAULT_NAME);

            let xmlList: HTMLElement[] = [];
            // variables getters first
            for (let i = 0; i < variableList.length; i++) {
                // <block type="variables_get" gap="24">
                //   <field name="VAR">item</field>
                // </block>
                let block = goog.dom.createDom('block');
                block.setAttribute('type', 'variables_get');
                block.setAttribute('gap', '8');
                let field = goog.dom.createDom('field', null, variableList[i]);
                field.setAttribute('name', 'VAR');
                block.appendChild(field);
                xmlList.push(block);
            }
            xmlList[xmlList.length - 1].setAttribute('gap', '24');

            for (let i = 0; i < Math.min(1, variableList.length); i++) {
                {
                    // <block type="variables_set" gap="8">
                    //   <field name="VAR">item</field>
                    // </block>
                    let block = goog.dom.createDom('block');
                    block.setAttribute('type', 'variables_set');
                    block.setAttribute('gap', '8');
                    {
                        let field = goog.dom.createDom('field', null, variableList[i]);
                        field.setAttribute('name', 'VAR');
                        block.appendChild(field);
                    }
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
                {
                    // <block type="variables_get" gap="24">
                    //   <field name="VAR">item</field>
                    // </block>
                    let block = goog.dom.createDom('block');
                    block.setAttribute('type', 'variables_change');
                    block.setAttribute('gap', '24');
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

                    xmlList.push(block);
                }
            }
            return xmlList;
        };

        Blockly.Blocks['variables_change'] = {
            init: function () {
                this.appendDummyInput()
                    .appendField("change")
                    .appendField(new Blockly.FieldVariable("item"), "VAR");
                this.appendValueInput("VALUE")
                    .setCheck("Number")
                    .appendField("by");
                this.setInputsInline(true);
                this.setPreviousStatement(true);
                this.setNextStatement(true);
                this.setTooltip(lf("Changes the value of the variable by this amount"));
                this.setHelpUrl('/reference/assign');
                this.setColour(blockColors['variables']);
            }
        };
    }
}