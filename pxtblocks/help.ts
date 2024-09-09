/// <reference path="../built/pxtlib.d.ts" />

import * as Blockly from "blockly";

import { cleanOuterHTML, getFirstChildWithAttr } from "./xml";
import { promptTranslateBlock } from "./external";
import { createToolboxBlock } from "./toolbox";
import { DuplicateOnDragStrategy, setDuplicateOnDragStrategy } from "./plugins/duplicateOnDrag";

export function setBuiltinHelpInfo(block: any, id: string) {
    const info = pxt.blocks.getBlockDefinition(id);
    setHelpResources(block, id, info.name, info.tooltip, info.url, pxt.toolbox.getNamespaceColor(info.category));
}

export function installBuiltinHelpInfo(id: string) {
    const info = pxt.blocks.getBlockDefinition(id);
    installHelpResources(id, info.name, info.tooltip, info.url, pxt.toolbox.getNamespaceColor(info.category));
}

export function setHelpResources(block: Blockly.BlockSvg, id: string, name: string, tooltip: any, url: string, colour: string, colourSecondary?: string, colourTertiary?: string, undeletable?: boolean) {
    if (tooltip && (typeof tooltip === "string" || typeof tooltip === "function")) block.setTooltip(tooltip);
    if (url) block.setHelpUrl(url);
    if (colour) block.setColour(colour);
    if (undeletable) block.setDeletable(false);

    setDuplicateOnDragStrategy(block);

    let tb = document.getElementById('blocklyToolboxDefinition');
    let xml: HTMLElement = tb ? getFirstChildWithAttr(tb, "block", "type", id) as HTMLElement : undefined;
    (block as any).codeCard = <pxt.CodeCard>{
        header: name,
        name: name,
        software: 1,
        description: typeof tooltip === "function" ? tooltip(block) : tooltip,
        blocksXml: xml ? (`<xml xmlns="http://www.w3.org/1999/xhtml">` + (cleanOuterHTML(xml) || `<block type="${id}"></block>`) + "</xml>") : undefined,
        url: url
    };
    if (pxt.Util.isTranslationMode()) {
        block.customContextMenu = (options: any[]) => {
            const blockd = pxt.blocks.getBlockDefinition(block.type);
            if (blockd && blockd.translationIds) {
                options.push({
                    enabled: true,
                    text: lf("Translate this block"),
                    callback: function () {
                        promptTranslateBlock(id, blockd.translationIds);
                    }
                })
            }
        };
    }
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

export function mkCard(fn: pxtc.SymbolInfo, blockXml: HTMLElement): pxt.CodeCard {
    return {
        name: fn.namespace + '.' + fn.name,
        shortName: fn.name,
        description: fn.attributes.jsDoc,
        url: fn.attributes.help ? 'reference/' + fn.attributes.help.replace(/^\//, '') : undefined,
        blocksXml: `<xml xmlns="http://www.w3.org/1999/xhtml">${cleanOuterHTML(blockXml)}</xml>`,
    }
}

export function attachCardInfo(blockInfo: pxtc.BlocksInfo, qName: string): pxt.CodeCard | void {
    const toModify: pxtc.SymbolInfo = blockInfo.apis.byQName[qName];
    if (toModify) {
        const comp = pxt.blocks.compileInfo(toModify);
        const xml = createToolboxBlock(blockInfo, toModify, comp);
        return mkCard(toModify, xml);
    }
}