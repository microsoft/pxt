/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";

/**
 * Finds all the exported variable symbols of a `fixedInstances` type and sorts them based
 * on weight (defaults to 50 when not specified). Also handles subtypes that extend the
 * specified type.
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
 * Returns a list of Blockly menu options from a list of pxt symbols. The `defaultValue` parameter
 * specifies the option that will always appear first in the list (if present).
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
 * Returns a list of dropdown options for a given `fixedInstances` type (and its subtypes)
 * based on the given API info. The value passed as `defaultValue` will always appear first in
 * the resulting list if present in the API info.
 */
export function getFixedInstanceDropdownOptions(blocksInfo: pxtc.BlocksInfo, typeQName: string, defaultValue: string | undefined, imgConv: pxt.ImageConverter): Blockly.MenuOption[] {
    return getSymbolDropdownOptions(getFixedInstanceDropdownValues(blocksInfo.apis, typeQName), defaultValue, imgConv);
}
