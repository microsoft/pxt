import * as Blockly from "blockly";

let _promptTranslateBlock: (blockId: string, blockTranslationIds: string[]) => void;

export function promptTranslateBlock(blockId: string, blockTranslationIds: string[]) {
    if (_promptTranslateBlock) {
        _promptTranslateBlock(blockId, blockTranslationIds);
    }
}

export function setPromptTranslateBlock(impl: (blockId: string, blockTranslationIds: string[]) => void) {
    _promptTranslateBlock = impl;
}

/**
 * This callback is populated from the editor extension result.
 * Allows a target to provide version specific blockly updates
 */
let _extensionBlocklyPatch: (pkgTargetVersion: string, el: Element) => void;

export function extensionBlocklyPatch(pkgTargetVersion: string, el: Element) {
    if (_extensionBlocklyPatch) {
        _extensionBlocklyPatch(pkgTargetVersion, el);
    }
}

export function setExtensionBlocklyPatch(impl: (pkgTargetVersion: string, el: Element) => void) {
    _extensionBlocklyPatch = impl;
}

let _openHelpUrl: (url: string) => void;

export function openHelpUrl(url: string) {
    if (_openHelpUrl) {
        _openHelpUrl(url);
    }
    else {
        window.open(url);
    }
}

export function setOpenHelpUrl(impl: (url: string) => void) {
    _openHelpUrl = impl;
}


let _onWorkspaceContextMenu: (workspace: Blockly.WorkspaceSvg, options: Blockly.ContextMenuRegistry.ContextMenuOption[]) => void;

export function onWorkspaceContextMenu(workspace: Blockly.WorkspaceSvg, options: Blockly.ContextMenuRegistry.ContextMenuOption[]) {
    if (_onWorkspaceContextMenu) {
        _onWorkspaceContextMenu(workspace, options);
    }
}

export function setOnWorkspaceContextMenu(impl: (workspace: Blockly.WorkspaceSvg, options: Blockly.ContextMenuRegistry.ContextMenuOption[]) => void) {
    _onWorkspaceContextMenu = impl;
}