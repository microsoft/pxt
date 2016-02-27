/// <reference path="./blockly.d.ts" />

import * as compiler from "./compiler"
import Util = yelm.Util;

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
    fn: ts.yelm.SymbolInfo;
    block: {
        init: () => void;
    };
}
var cachedBlocks: Util.StringMap<CachedBlock> = {};
var cachedToolbox: string = "";

function createShadowValue(name: string, type: string, v?: string): Element {
    if (v && v.slice(0, 1) == "\"")
        v = JSON.parse(v);
    let value = document.createElement("value");
    value.setAttribute("name", name);
    let shadow = document.createElement("shadow"); value.appendChild(shadow);
    shadow.setAttribute("type", type == "number" ? "math_number" : type == "string" ? "text" : type);
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

export function parameterNames(fn: ts.yelm.SymbolInfo): Util.StringMap<BlockParameter> {
    // collect blockly parameter name mapping
    const instance = fn.kind == ts.yelm.SymbolKind.Method || fn.kind == ts.yelm.SymbolKind.Property;
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
                m = rx.exec(fn.attributes.block); if (!m) break;
            }

            var at = attrNames[fn.parameters[i++].name];
            at.name = m[1];
            if (m[3]) at.shadowType = m[3];
        }
    }
    return attrNames;
}

function injectToolbox(tb: Element, info: BlocksInfo, fn: ts.yelm.SymbolInfo, attrNames: Util.StringMap<BlockParameter>) {
    //
    // toolbox update
    //
    let block = document.createElement("block");
    block.setAttribute("type", fn.attributes.blockId);
    if (fn.attributes.blockGap)
        block.setAttribute("gap", fn.attributes.blockGap);

    fn.parameters.filter(pr => !!attrNames[pr.name].name &&
        (/string|number/.test(attrNames[pr.name].type)
            || !!attrNames[pr.name].shadowType
            || !!attrNames[pr.name].shadowValue))
        .forEach(pr => {
            let attr = attrNames[pr.name];
            block.appendChild(createShadowValue(attr.name, attr.type, attr.shadowValue));
        })

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

function injectBlockDefinition(info: BlocksInfo, fn: ts.yelm.SymbolInfo, attrNames: Util.StringMap<BlockParameter>): boolean {
    let id = fn.attributes.blockId;

    if (builtinBlocks[id]) {
        console.error('trying to override builtin block ' + id);
        return false;
    }

    let hash = JSON.stringify(fn);
    if (cachedBlocks[id] && cachedBlocks[id].hash == hash) {
        console.log('block already in toolbox: ' + id);
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
            init: function() { initBlock(this, info, fn, attrNames) }
        }
    }

    cachedBlocks[id] = cachedBlock;
    Blockly.Blocks[id] = cachedBlock.block;

    return true;
}

function initField(i: any, ni: number, fn: ts.yelm.SymbolInfo, pre: string, right?: boolean, type?: string): any {
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

function initBlock(block: any, info: BlocksInfo, fn: ts.yelm.SymbolInfo, attrNames: Util.StringMap<BlockParameter>) {
    block.setHelpUrl("./" + fn.attributes.help);
    const ns = fn.namespace.split('.')[0];
    const instance = fn.kind == ts.yelm.SymbolKind.Method || fn.kind == ts.yelm.SymbolKind.Property;
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
                i = initField(block.appendValueInput(p), ni, fn, pre, true, "Number");
            }
            else if (pr.type == "boolean") {
                i = initField(block.appendValueInput(p), ni, fn, pre, true, "Boolean");
            } else if (pr.type == "string") {
                i = initField(block.appendValueInput(p), ni, fn, pre, true, "String");
            } else {
                let prtype = Util.lookup(info.apis.byQName, pr.type);
                if (prtype && prtype.kind == ts.yelm.SymbolKind.Enum) {
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
                ri.appendField(new Blockly.FieldCheckbox("FALSE"), "LED" + r + c);
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

export function injectBlocks(workspace: Blockly.Workspace, toolbox: Element, blockInfo: BlocksInfo): void {

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
    let tb = <Element>toolbox.cloneNode(true);
    blockInfo.blocks
        .filter(fn => !tb.querySelector("block[type='" + fn.attributes.blockId + "']"))
        .forEach(fn => {
            let pnames = parameterNames(fn);
            if (injectBlockDefinition(blockInfo, fn, pnames)) {
                injectToolbox(tb, blockInfo, fn, pnames);
                currentBlocks[fn.attributes.blockId] = 1;
            }
        })

    // remove ununsed blocks
    Object
        .keys(cachedBlocks).filter(k => !currentBlocks[k])
        .forEach(k => removeBlock(cachedBlocks[k].fn));

    // update toolbox   
    if (tb.innerHTML != cachedToolbox) {
        cachedToolbox = tb.innerHTML;
        workspace.updateToolbox(tb)
    }
}

function removeBlock(fn: ts.yelm.SymbolInfo) {
    delete Blockly.Blocks[fn.attributes.blockId];
    delete cachedBlocks[fn.attributes.blockId];
}

export interface BlocksInfo {
    apis: ts.yelm.ApisInfo;
    blocks: ts.yelm.SymbolInfo[];
}

export function getBlocksAsync(): Promise<BlocksInfo> {
    return compiler.getApisInfoAsync()
        .then(info => {
            return {
                apis: info,
                blocks: Util.values(info.byQName).filter(s => !!s.attributes.block && !!s.attributes.blockId)
            }
        })
}
