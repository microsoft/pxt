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

export interface PromptOptions {
    placeholder: string;
}

let _prompt: (message: string, defaultValue: string, callback: (value: string) => void, options?: PromptOptions) => void;

export function setPrompt(impl: (message: string, defaultValue: string, callback: (value: string) => void, options?: PromptOptions) => void, setBlocklyAlso?: boolean) {
    if (setBlocklyAlso) {
        Blockly.dialog.setPrompt(impl);
    }

    _prompt = impl;
}

export function prompt(message: string, defaultValue: string, callback: (value: string) => void, options?: PromptOptions) {
    if (_prompt) {
        _prompt(message, defaultValue, callback, options);
    }
    else {
        Blockly.dialog.prompt(message, defaultValue, callback);
    }
}

let _openWorkspaceSearch: () => void;
export function setOpenWorkspaceSearch(impl: () => void) {
    _openWorkspaceSearch = impl;
}

export function openWorkspaceSearch() {
    if (_openWorkspaceSearch) {
        _openWorkspaceSearch();
    }
}