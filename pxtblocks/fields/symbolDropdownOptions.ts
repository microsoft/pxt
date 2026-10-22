/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";

/**
 * Returns the fixed instances of the type `qName` that `apis` declares: its
 * variables marked `fixedInstance` whose type is `qName` or a type extending
 * it, by descending `weight` (50 when unset).
 * @param apis the API info declaring the type and its instances
 * @param qName the fully qualified name of the fixed-instance type
 */
export function getFixedInstanceDropdownValues(apis: pxtc.ApisInfo, qName: string) {
    const symbols = pxt.Util.values(apis.byQName).filter(sym => sym.kind === pxtc.SymbolKind.Variable
        && sym.attributes.fixedInstance
        && isSubtype(apis, sym.retType, qName))
        .sort((l, r) => (r.attributes.weight || 50) - (l.attributes.weight || 50))
    return symbols
}

function isSubtype(apis: pxtc.ApisInfo, specific: string, general: string) {
    if (specific == general) return true
    let inf = apis.byQName[specific]
    if (inf && inf.extendsTypes)
        return inf.extendsTypes.indexOf(general) >= 0
    return false
}

/**
 * Returns the dropdown options of `symbols`, in their order, except that the
 * option whose value is `defaultValue` comes first. An option's value is its
 * symbol's qualified name (`namespace.name`) and its third element the
 * symbol's `ariaLabel`. Its label is the symbol's `block` attribute, else its
 * `blockId`, else its name, less `@set` for a `blockCombine` symbol; a symbol
 * with an icon or a `blockImage` shows as an image descriptor whose `alt` is
 * that label and whose `value` is the symbol's name. A symbol holding a jres
 * image and no icon gets its `iconURL` set to the image converted by
 * `imgConv`.
 * @param symbols the symbols to list
 * @param defaultValue the value of the option to list first; undefined to keep the order of `symbols`
 * @param imgConv the converter of jres images to icons
 */
export function getSymbolDropdownOptions(symbols: pxtc.SymbolInfo[], defaultValue: string | undefined, imgConv: pxt.ImageConverter): Blockly.MenuOption[] {
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
                value: v.name
            } : k,
            v.namespace + "." + v.name,
            v.attributes.ariaLabel
        ];
    });
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
 * Returns the dropdown options of the fixed instances of the type `typeQName`
 * that `blocksInfo` declares (its variables marked `fixedInstance` whose type
 * is `typeQName` or a type extending it), by descending `weight`, except that
 * the option whose value is `defaultValue` comes first.
 * @param blocksInfo the API info declaring the type and its instances
 * @param typeQName the fully qualified name of the fixed-instance type
 * @param defaultValue the value of the option to list first; undefined to keep the instances' order
 * @param imgConv the converter of jres images to icons
 */
export function getFixedInstanceDropdownOptions(blocksInfo: pxtc.BlocksInfo, typeQName: string, defaultValue: string | undefined, imgConv: pxt.ImageConverter): Blockly.MenuOption[] {
    return getSymbolDropdownOptions(getFixedInstanceDropdownValues(blocksInfo.apis, typeQName), defaultValue, imgConv);
}
