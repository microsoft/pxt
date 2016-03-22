/// <reference path="./blockly.d.ts" />
/// <reference path="../built/kindlib.d.ts" />
import Util = ks.Util;

let lf = Util.lf;

namespace ks.blocks {

    var blockColors: Util.StringMap<number> = {
        loops: 120,
        images: 45,
        variables: 330
    }

    // list of built-in blocks, should be touched.
    var builtinBlocks: Util.StringMap<any> = {};
    Object.keys(Blockly.Blocks).forEach(k => builtinBlocks[k] = Blockly.Blocks[k]);

    // blocks cached
    interface CachedBlock {
        hash: string;
        fn: ts.ks.SymbolInfo;
        block: Blockly.BlockDefinition;
    }
    var cachedBlocks: Util.StringMap<CachedBlock> = {};
    var cachedToolbox: string = "";

    function createShadowValue(name: string, type: string, v?: string, shadowType?: string): Element {
        if (v && v.slice(0, 1) == "\"")
            v = JSON.parse(v);
        if (type == "number" && shadowType && shadowType == "value") {
            let field = document.createElement("field");
            field.setAttribute("name", name);
            field.innerText = "0"
            return field;
        }

        let value = document.createElement("value");
        value.setAttribute("name", name);

        let shadow = document.createElement("shadow"); value.appendChild(shadow);
        shadow.setAttribute("type", shadowType ? shadowType : type == "number" ? "math_number" : type == "string" ? "text" : type);
        if (type == "number" || type == "string") {
            let field = document.createElement("field"); shadow.appendChild(field);
            field.setAttribute("name", type == "number" ? "NUM" : "TEXT");
            field.innerText = v || (type == "number" ? "0" : "");
        }
        return value;
    }

    export interface BlockParameter {
        name: string;
        type?: string;
        shadowType?: string;
        shadowValue?: string;
    }

    export function parameterNames(fn: ts.ks.SymbolInfo): Util.StringMap<BlockParameter> {
        // collect blockly parameter name mapping
        const instance = fn.kind == ts.ks.SymbolKind.Method || fn.kind == ts.ks.SymbolKind.Property;
        let attrNames: Util.StringMap<BlockParameter> = {};

        if (instance) attrNames["this"] = { name: "this", type: fn.namespace };
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

                var at = attrNames[fn.parameters[i++].name];
                at.name = m[1];
                if (m[3]) at.shadowType = m[3];
            }
        }
        return attrNames;
    }

    function createToolboxBlock(info: ts.ks.BlocksInfo, fn: ts.ks.SymbolInfo, attrNames: Util.StringMap<BlockParameter>): HTMLElement {
        //
        // toolbox update
        //
        let block = document.createElement("block");
        block.setAttribute("type", fn.attributes.blockId);
        if (fn.attributes.blockGap)
            block.setAttribute("gap", fn.attributes.blockGap);
        if ((fn.kind == ts.ks.SymbolKind.Method || fn.kind == ts.ks.SymbolKind.Property)
            && attrNames["this"] && attrNames["this"].shadowType) {
            let attr = attrNames["this"];
            block.appendChild(createShadowValue(attr.name, attr.type, attr.shadowValue, attr.shadowType));
        }
        fn.parameters.filter(pr => !!attrNames[pr.name].name &&
            (/string|number/.test(attrNames[pr.name].type)
                || !!attrNames[pr.name].shadowType
                || !!attrNames[pr.name].shadowValue))
            .forEach(pr => {
                let attr = attrNames[pr.name];
                block.appendChild(createShadowValue(attr.name, attr.type, attr.shadowValue, attr.shadowType));
            })
        return block;
    }

    function injectToolbox(tb: Element, info: ts.ks.BlocksInfo, fn: ts.ks.SymbolInfo, block: HTMLElement) {
        let ns = fn.namespace.split('.')[0];
        let catName = ns[0].toUpperCase() + ns.slice(1);
        let category = tb.querySelector("category[name~='" + catName + "']");
        if (!category) {
            console.log('toolbox: adding category ' + ns)
            category = document.createElement("category");
            category.setAttribute("name", catName)
            let nsn = info.apis.byQName[ns];
            category.setAttribute("weight", nsn.attributes.weight.toString())
            if (nsn.attributes.color) category.setAttribute("colour", nsn.attributes.color)
            // find the place to insert the category        
            let categories = tb.querySelectorAll("category");
            let ci = 0;
            for (ci = 0; ci < categories.length; ++ci) {
                let cat = categories.item(ci);
                if (parseInt(cat.getAttribute("weight") || "50") < (nsn.attributes.weight || 50)) {
                    tb.insertBefore(category, cat);
                    break;
                }
            }
            if (ci == categories.length)
                tb.appendChild(category);
        }
        category.appendChild(block);
    }

    var iconCanvasCache: Util.StringMap<HTMLCanvasElement> = {};
    function iconToFieldImage(c: string): Blockly.FieldImage {
        let canvas = iconCanvasCache[c];
        if (!canvas) {
            canvas = iconCanvasCache[c] = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.font = "56px Icons";
            ctx.textAlign = "center";
            ctx.fillText(c, canvas.width / 2, 56);
        }
        return new Blockly.FieldImage(canvas.toDataURL(), 16, 16, '');
    }

    function injectBlockDefinition(info: ts.ks.BlocksInfo, fn: ts.ks.SymbolInfo, attrNames: Util.StringMap<BlockParameter>, blockXml: HTMLElement): boolean {
        let id = fn.attributes.blockId;

        if (builtinBlocks[id]) {
            console.error('trying to override builtin block ' + id);
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

        var cachedBlock: CachedBlock = {
            hash: hash,
            fn: fn,
            block: {
                codeCard: mkCard(fn, blockXml),
                init: function() { initBlock(this, info, fn, attrNames) }
            }
        }

        cachedBlocks[id] = cachedBlock;
        Blockly.Blocks[id] = cachedBlock.block;

        return true;
    }

    function initField(i: any, ni: number, fn: ts.ks.SymbolInfo, pre: string, right?: boolean, type?: string): any {
        if (ni == 0 && fn.attributes.icon)
            i.appendField(iconToFieldImage(fn.attributes.icon))
        if (pre)
            i.appendField(pre);
        if (right)
            i.setAlign(Blockly.ALIGN_RIGHT)
        if (type)
            i.setCheck(type);
        return i;
    }

    function mkCard(fn: ts.ks.SymbolInfo, blockXml: HTMLElement): ks.CodeCard {
        return {
            header: fn.name,
            name: fn.namespace + '.' + fn.name,
            description: fn.attributes.jsDoc,
            url: fn.attributes.help,
            blocksXml: `<xml xmlns="http://www.w3.org/1999/xhtml">
        ${blockXml.outerHTML}
</xml>`,
            card: {
                software: 1
            }
        }
    }
    
    function dashify(s : string) : string {
        return s[0].toLowerCase() + s.slice(1).replace(/[A-Z]/, (s) => '-' + s.toUpperCase());
    }

    function initBlock(block: any, info: ts.ks.BlocksInfo, fn: ts.ks.SymbolInfo, attrNames: Util.StringMap<BlockParameter>) {
        const ns = fn.namespace.split('.')[0];
        const instance = fn.kind == ts.ks.SymbolKind.Method || fn.kind == ts.ks.SymbolKind.Property;

        var help = fn.attributes.help || (`${ns}/${dashify(fn.name)}`)
        var help = "./reference/" + help;
        block.setHelpUrl(help);
        
        block.setTooltip(fn.attributes.jsDoc);
        block.setColour(
            info.apis.byQName[ns].attributes.color
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
                if (instance && n == "this") {
                    i = initField(block.appendValueInput(p), ni, fn, pre, true, pr.type);
                }
                else if (pr.type == "number") {
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
                    if (prtype && prtype.kind == ts.ks.SymbolKind.Enum) {
                        let dd = Util.values(info.apis.byQName)
                            .filter(e => e.namespace == pr.type)
                            .map(v => [v.attributes.blockId || v.name, v.namespace + "." + v.name]);
                        i = initField(block.appendDummyInput(), ni, fn, pre, true);
                        i.appendField(new Blockly.FieldDropdown(dd), attrNames[n].name);
                    } else {
                        i = initField(block.appendValueInput(p), ni, fn, pre, true, pr.type);
                    }
                }
            }
        });

        let body = fn.parameters.filter(pr => pr.type == "() => void")[0];
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

        if (!/^on /.test(fn.attributes.block)) {
            block.setPreviousStatement(fn.retType == "void");
            block.setNextStatement(fn.retType == "void");
        }
        block.setTooltip(fn.attributes.jsDoc);
    }

    export function initBlocks(blockInfo: ts.ks.BlocksInfo, workspace?: Blockly.Workspace, toolbox?: Element): void {
        init();
        
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

        // create new toolbox and update block definitions
        let tb = toolbox ? <Element>toolbox.cloneNode(true) : undefined;
        blockInfo.blocks
            .filter(fn => !tb || !tb.querySelector(`block[type='${fn.attributes.blockId}']`))
            .forEach(fn => {
                let pnames = parameterNames(fn);
                let block = createToolboxBlock(blockInfo, fn, pnames);
                if (injectBlockDefinition(blockInfo, fn, pnames, block)) {
                    if (tb)
                        injectToolbox(tb, blockInfo, fn, block);
                    currentBlocks[fn.attributes.blockId] = 1;
                }
            })

        // remove ununsed blocks
        Object
            .keys(cachedBlocks).filter(k => !currentBlocks[k])
            .forEach(k => removeBlock(cachedBlocks[k].fn));

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

    export function cleanBlocks() {
        console.log('removing all custom blocks')
        for (let b in cachedBlocks)
            removeBlock(cachedBlocks[b].fn);
    }

    function removeBlock(fn: ts.ks.SymbolInfo) {
        delete Blockly.Blocks[fn.attributes.blockId];
        delete cachedBlocks[fn.attributes.blockId];
    }

    var blocklyInitialized = false;
    function init() {
        if (blocklyInitialized) blocklyInitialized = true;
        goog.provide('Blockly.Blocks.device');
        goog.require('Blockly.Blocks');

        Blockly.FieldCheckbox.prototype.init = function(block: Blockly.Block) {
            if (this.sourceBlock_) {
                // Checkbox has already been initialized once.
                return;
            }
            Blockly.FieldCheckbox.superClass_.init.call(this, block);
            // The checkbox doesn't use the inherited text element.
            // Instead it uses a custom checkmark element that is either visible or not.
            this.checkElement_ = Blockly.createSvgElement('text',
                { 'class': 'blocklyText blocklyLed', 'x': 0, 'y': 12 }, this.fieldGroup_);
            var textNode = document.createTextNode('■');
            this.checkElement_.appendChild(textNode);
            this.checkElement_.style.display = this.state_ ? 'block' : 'none';
        };

        var blockColors = {
            loops: 120,
            variables: 330,
        }

        Blockly.Variables.flyoutCategory = function(workspace) {
            var variableList = Blockly.Variables.allVariables(workspace);
            variableList.sort(goog.string.caseInsensitiveCompare);
            // In addition to the user's variables, we also want to display the default
            // variable name at the top.  We also don't want this duplicated if the
            // user has created a variable of the same name.
            goog.array.remove(variableList, Blockly.Msg.VARIABLES_DEFAULT_NAME);
            variableList.unshift(Blockly.Msg.VARIABLES_DEFAULT_NAME);

            var xmlList: HTMLElement[] = [];
            // variables getters first
            for (var i = 0; i < variableList.length; i++) {
                // <block type="variables_get" gap="24">
                //   <field name="VAR">item</field>
                // </block>
                var block = goog.dom.createDom('block');
                block.setAttribute('type', 'variables_get');
                block.setAttribute('gap', '8');
                var field = goog.dom.createDom('field', null, variableList[i]);
                field.setAttribute('name', 'VAR');
                block.appendChild(field);
                xmlList.push(block);
            }
            xmlList[xmlList.length - 1].setAttribute('gap', '24');

            for (var i = 0; i < Math.min(1, variableList.length); i++) {
                {
                    // <block type="variables_set" gap="8">
                    //   <field name="VAR">item</field>
                    // </block>
                    var block = goog.dom.createDom('block');
                    block.setAttribute('type', 'variables_set');
                    block.setAttribute('gap', '8');
                    var field = goog.dom.createDom('field', null, variableList[i]);
                    field.setAttribute('name', 'VAR');
                    block.appendChild(field);
                    
                    var value = goog.dom.createDom('value');
                    value.setAttribute('name', 'VALUE');
                    var shadow = goog.dom.createDom('shadow');
                    shadow.setAttribute("type", "math_number");
                    value.appendChild(shadow);
                    var field = goog.dom.createDom('field');
                    field.setAttribute('name', 'NUM');
                    field.innerText = '0';
                    shadow.appendChild(field);
                    block.appendChild(value);
                    
                    xmlList.push(block);
                }
                {
                    // <block type="variables_get" gap="24">
                    //   <field name="VAR">item</field>
                    // </block>
                    var block = goog.dom.createDom('block');
                    block.setAttribute('type', 'variables_change');
                    block.setAttribute('gap', '24');
                    var value = goog.dom.createDom('value');
                    value.setAttribute('name', 'VALUE');
                    var shadow = goog.dom.createDom('shadow');
                    shadow.setAttribute("type", "math_number");
                    value.appendChild(shadow);
                    var field = goog.dom.createDom('field');
                    field.setAttribute('name', 'NUM');
                    field.innerText = '1';
                    shadow.appendChild(field);
                    block.appendChild(value);

                    xmlList.push(block);
                }
            }
            return xmlList;
        };

        Blockly.Blocks['math_op2'] = {
            init: function() {
                this.setHelpUrl('./reference/math');
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
            init: function() {
                this.setHelpUrl('./blocks/contents');
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

        Blockly.Blocks['device_while'] = {
            init: function() {
                this.setHelpUrl('./reference/loops/while');
                this.setColour(blockColors.loops);
                this.appendValueInput("COND")
                    .setCheck("Boolean")
                    .appendField("while");
                this.appendStatementInput("DO")
                    .appendField("do");
                this.setPreviousStatement(true);
                this.setNextStatement(true);
                this.setTooltip(lf("Run the same sequence of actions while the condition is met. Don't forget to pause!"));
            }
        };

        Blockly.Blocks['device_random'] = {
            init: function() {
                this.setHelpUrl('./reference/math/random');
                this.setColour(230);
                this.appendDummyInput()
                    .appendField("pick random 0 to")
                    .appendField(new Blockly.FieldTextInput("0", Blockly.FieldTextInput.numberValidator), "limit");
                this.setInputsInline(true);
                this.setOutput(true, "Number");
                this.setTooltip(lf("Returns a random integer between 0 and the specified bound (inclusive)."));
            }
        };

        Blockly.Blocks['controls_simple_for'] = {
            /**
             * Block for 'for' loop.
             * @this Blockly.Block
             */
            init: function() {
                this.setHelpUrl("./reference/loops/for");
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
                var thisBlock = this;
                this.setTooltip(function() {
                    return Blockly.Msg.CONTROLS_FOR_TOOLTIP.replace('%1',
                        thisBlock.getFieldValue('VAR'));
                });
            },
            /**
             * Return all variables referenced by this block.
             * @return {!Array.<string>} List of variable names.
             * @this Blockly.Block
             */
            getVars: function(): any[] {
                return [this.getFieldValue('VAR')];
            },
            /**
             * Notification that a variable is renaming.
             * If the name matches one of this block's variables, rename it.
             * @param {string} oldName Previous name of variable.
             * @param {string} newName Renamed variable.
             * @this Blockly.Block
             */
            renameVar: function(oldName: string, newName: string) {
                if (Blockly.Names.equals(oldName, this.getFieldValue('VAR'))) {
                    this.setFieldValue(newName, 'VAR');
                }
            },
            /**
             * Add menu option to create getter block for loop variable.
             * @param {!Array} options List of menu options to add to.
             * @this Blockly.Block
             */
            customContextMenu: function(options: any[]) {
                if (!this.isCollapsed()) {
                    var option: any = { enabled: true };
                    var name = this.getFieldValue('VAR');
                    option.text = Blockly.Msg.VARIABLES_SET_CREATE_GET.replace('%1', name);
                    var xmlField = goog.dom.createDom('field', null, name);
                    xmlField.setAttribute('name', 'VAR');
                    var xmlBlock = goog.dom.createDom('block', null, xmlField);
                    xmlBlock.setAttribute('type', 'variables_get');
                    option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
                    options.push(option);
                }
            }
        };


        Blockly.Blocks['variables_change'] = {
            init: function() {
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
                this.setHelpUrl('./reference/assign');
                this.setColour(blockColors.variables);
            }
        };

        Blockly.BlockSvg.START_HAT = true;

        // Here's a helper to override the help URL for a block that's *already defined
        // by Blockly*. For blocks that we define ourselves, just change the call to
        // setHelpUrl in the corresponding definition above.
        function monkeyPatchBlock(id: string, name: string, url: string) {
            var old = Blockly.Blocks[id].init;
            // fix sethelpurl
            Blockly.Blocks[id].init = function() {
                // The magic of dynamic this-binding.
                old.call(this);
                this.setHelpUrl("./reference/" + url);
                if (!this.codeCard) {
                    let tb = document.getElementById('blocklyToolboxDefinition');
                    let xml: HTMLElement = tb ? tb.querySelector("category block[type~='" + id + "']") as HTMLElement : undefined;
                    this.codeCard = <ks.CodeCard>{
                        header: name,
                        name: name,
                        card: {
                            software: 1
                        },
                        description: goog.isFunction(this.tooltip) ? this.tooltip() : this.tooltip,
                        blocksXml: xml ? ("<xml>" + xml.outerHTML + "</xml>") : undefined,
                        url: url
                    }
                }
            };
        }

        monkeyPatchBlock("controls_if", "if", "logic/if");
        monkeyPatchBlock("controls_repeat_ext", "for loop", "loops/repeat");
        monkeyPatchBlock("variables_set", "variable assignment", "assign");
        monkeyPatchBlock("math_number", "number", "number");
        monkeyPatchBlock("logic_compare", "boolean operator", "math/math");
        monkeyPatchBlock("logic_operation", "boolean operation", "boolean");
        monkeyPatchBlock("logic_negate", "not operator", "boolean");
        monkeyPatchBlock("logic_boolean", "boolean value", "boolean");
        monkeyPatchBlock("math_arithmetic", "arithmetic operation", "math/math");
    }
}