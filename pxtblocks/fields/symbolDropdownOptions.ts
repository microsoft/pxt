/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";

export function getSymbolPickerTags(info: pxtc.BlocksInfo, symbol: pxtc.SymbolInfo): string[] {
    return pxt.sprite.getSymbolTags(info.apis, symbol).map(tag => tag.toLowerCase());
}

// Defaults can name a constant alias (such as SURVIVAL for GameMode.Survival), so map
// those to the option they stand for. Defaults that already match an option are left alone.
export function resolveDropdownDefault(info: pxtc.BlocksInfo, dd: Blockly.MenuOption[], value: string): string {
    if (!value || dd.some(option => option[1] === value)) return value;
    const identity = info.apis.byQName[value]?.attributes.enumIdentity;
    return identity && dd.some(option => option[1] === identity) ? identity : value;
}

/**
 * Returns a list of Blockly menu options from a list of pxt symbols. The `defaultValue` parameter
 * specifies the option that will always appear first in the list (if present).
 */
export function getSymbolDropdownOptions(info: pxtc.BlocksInfo, symbols: pxtc.SymbolInfo[], defaultValue: string | undefined, imgConv: pxt.ImageConverter): Blockly.MenuOption[] {
    const dd: Blockly.MenuOption[] = symbols.map(v => {
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
                value: v.name,
                tags: getSymbolPickerTags(info, v)
            } : k,
            v.namespace + "." + v.name,
            v.attributes.ariaLabel
        ];
    });
    defaultValue = resolveDropdownDefault(info, dd, defaultValue);
    if (defaultValue) {
        let shadowValueIndex = -1;
        dd.some((v, i) => {
            if (v[1] === defaultValue) {
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
    return dd;
}

/**
 * Returns a list of dropdown options for a given `fixedInstances` type (and its subtypes)
 * based on the given API info. The value passed as `defaultValue` will always appear first in
 * the resulting list if present in the API info.
 */
export function getFixedInstanceDropdownOptions(blocksInfo: pxtc.BlocksInfo, typeQName: string, defaultValue: string | undefined, imgConv: pxt.ImageConverter): Blockly.MenuOption[] {
    return getSymbolDropdownOptions(blocksInfo, pxt.blocks.getFixedInstanceDropdownValues(blocksInfo.apis, typeQName), defaultValue, imgConv);
}
