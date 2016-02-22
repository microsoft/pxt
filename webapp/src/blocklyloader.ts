/// <reference path="./blockly.d.ts" />

import * as compiler from "./compiler"

var blockColors: Util.StringMap<number> = {
    basic: 190,
    led: 3,
    input: 300,
    loops: 120,
    pins: 351,
    music: 52,
    game: 176,
    images: 45,
    variables: 330,
    antenna: 156,
    radio: 270,
}

// list of built-in blocks, should be touched.
var builtinBlocks: Util.StringMap<any> = {};
Object.keys(Blockly.Blocks).forEach(k => builtinBlocks[k] = Blockly.Blocks[k]);

// blocks cached
interface CachedBlock {
    hash: string;
    block: {
        init: () => void;
    };
}
var cachedBlocks: Util.StringMap<CachedBlock> = {};

function createShadowValue(name: string, num: boolean, v: string): Element {
    var value = document.createElement("value");
    value.setAttribute("name", name);
    var shadow = document.createElement("shadow"); value.appendChild(shadow);
    shadow.setAttribute("type", num ? "math_number" : "text");
    var field = document.createElement("field"); shadow.appendChild(field);
    field.setAttribute("name", num ? "NUM" : "TEXT");
    field.innerText = v || "";

    return value;
}

export function parameterNames(fn: ts.mbit.SymbolInfo): Util.StringMap<string> {
    // collect blockly parameter name mapping
    var attrNames: Util.StringMap<string> = {};
    fn.parameters.forEach(pr => attrNames[pr.name] = pr.name);
    if (fn.attributes.block) {
        Object.keys(attrNames).forEach(k => attrNames[k] = "");
        (/%[a-zA-Z0-9]+/g.exec(fn.attributes.block) || []).forEach((m, i) => {
            attrNames[fn.parameters[i].name] = m.slice(1);
        })
    }
    return attrNames;
}

function injectToolbox(tb: Element, fn: ts.mbit.SymbolInfo, attrNames: Util.StringMap<string>) {
    //
    // toolbox update
    //
    var block = document.createElement("block");
    block.setAttribute("type", fn.attributes.blockId);
    if (fn.attributes.blockGap)
        block.setAttribute("gap", fn.attributes.blockGap);

    fn.parameters.filter(pr => !!attrNames[pr.name]).forEach(pr => {
        if (pr.type == "number")
            block.appendChild(createShadowValue(attrNames[pr.name], true, pr.initializer || "0"));
        else if (pr.type == "string")
            block.appendChild(createShadowValue(attrNames[pr.name], false, ""));
    })

    var category = tb.querySelector("category[name~='" + fn.namespace[0].toUpperCase() + fn.namespace.slice(1) + "']");
    if (!category) {
        console.log('toolbox: adding category ' + fn.namespace)
        category = document.createElement("category");
        tb.appendChild(category);
    }
    category.appendChild(block);
}

function iconToFieldImage(c: string): Blockly.FieldImage {
    var canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = "56px Icons";
    ctx.textAlign = "center";
    ctx.fillText(c, canvas.width / 2, 56);
    return new Blockly.FieldImage(canvas.toDataURL(), 16, 16, '');
}

function injectBlockDefinition(fn: ts.mbit.SymbolInfo, attrNames: Util.StringMap<string>) {
    var id = fn.attributes.blockId;
    
    if (builtinBlocks[id]) {
        console.error('trying to override builtin block ' + id);
        return;
    }
    
    var hash = JSON.stringify(fn);       
    if (cachedBlocks[id] && cachedBlocks[id].hash == hash) {
        console.log('block already in toolbox: ' + id);
        return;
    }

    if (Blockly.Blocks[fn.attributes.blockId]) {
        console.error("duplicate block definition: " + id);
        return;
    }

    var cachedBlock: CachedBlock = {
        hash: hash,
        block: {
            init: function() {
                this.setHelpUrl("./" + fn.attributes.help);
                this.setColour(blockColors[fn.namespace] || 255);

                fn.attributes.block.split('|').map(n => {
                    var m = /([^%]*)%([a-zA-Z0-0]+)/.exec(n);
                    if (!m) {
                        var i = this.appendDummyInput();
                        if (fn.attributes.icon) i.appendField(iconToFieldImage(fn.attributes.icon))
                        i.appendField(n);
                    } else {
                        // find argument
                        var pre = m[1]; var p = m[2];
                        var n = Object.keys(attrNames).filter(k => attrNames[k] == p)[0];
                        if (!n) {
                            console.error("block " + fn.attributes.blockId + ": unkown parameter " + p);
                            return;
                        }

                        var pr = fn.parameters.filter(p => p.name == n)[0];
                        if (pr.type == "number") {
                            var i = this.appendValueInput(p)
                                .setAlign(Blockly.ALIGN_RIGHT)
                                .setCheck("Number");
                            if (pre) i.appendField(pre);
                        } else if (pr.type == "string") {
                            var i = this.appendValueInput(p)
                                .setAlign(Blockly.ALIGN_RIGHT)
                                .setCheck("String");
                            if (pre) i.appendField(pre);
                        }
                    }
                })

                var body = fn.parameters.filter(pr => pr.type == "() => void")[0];
                if (body) {
                    this.appendStatementInput(attrNames[body.name] || "HANDLER")
                        .setCheck("null");
                }

                this.setInputsInline(fn.parameters.length < 4);
                if (!/^on /.test(fn.name)) {
                    this.setPreviousStatement(fn.retType == "void");
                    this.setNextStatement(fn.retType == "void");
                }
                this.setTooltip(fn.attributes.jsDoc);
            }
        }
    }
    
    cachedBlocks[id] = cachedBlock;
    Blockly.Blocks[id] = cachedBlock.block;
}

export function injectBlocks(workspace: Blockly.Workspace, toolbox: Element, blockInfo: BlocksInfo): void {
    blockInfo.blocks.sort((f1, f2) => {
        return (f2.attributes.weight || 50) - (f1.attributes.weight + 1 || 50);
    })

    var tb = <Element>toolbox.cloneNode(true);
    blockInfo.blocks
        .filter(fn => !tb.querySelector("block[type='" + fn.attributes.blockId + "']"))
        .forEach(fn => {
            var pnames = parameterNames(fn);
            injectToolbox(tb, fn, pnames);
            injectBlockDefinition(fn, pnames);
        })
    workspace.updateToolbox(tb)
}


export interface BlocksInfo {
    blocks: ts.mbit.SymbolInfo[];
}

export function getBlocksAsync(): Promise<BlocksInfo> {
    return compiler.getApisInfoAsync()
        .then(info => {
            return {
                blocks: Util.values(info.byQName).filter(s => !!s.attributes.block && !!s.attributes.blockId)
            }
        })
}
