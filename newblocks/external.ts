let _promptTranslateBlock: (blockId: string, blockTranslationIds: string[]) => void;

export function promptTranslateBlock(blockId: string, blockTranslationIds: string[]) {
    if (_promptTranslateBlock) {
        _promptTranslateBlock(blockId, blockTranslationIds);
    }
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

let _openHelpUrl: (url: string) => void;

export function openHelpUrl(url: string) {
    if (_openHelpUrl) {
        _openHelpUrl(url);
    }
    else {
        window.open(url);
    }
}