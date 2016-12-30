/// <reference path="../built/blockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />

namespace pxt.blocks.search {
    const SEARCH_RESULT_COUNT = 10;
    // override this function to change scoring
    export var scorer = (fn: pxtc.SymbolInfo, searchFor: string): number => {
        // TOOD: fuzzy match
        const score = fn.name.indexOf(searchFor) > -1 ? 500 : 0
            + fn.namespace.indexOf(searchFor) > -1 ? 100 : 0
            + (fn.attributes.block || "").indexOf(searchFor) > -1 ? 600 : 0;

        // TODO: weight by namespace weight
        return score * (fn.attributes.weight || 50)
    }

    export function searchAsync(searchFor: string, blockInfo: pxtc.BlocksInfo): Promise<[pxtc.SymbolInfo[], pxtc.BlocksInfo]> {
        return new Promise<[pxtc.SymbolInfo[], pxtc.BlocksInfo]>((resolve, reject) => {

            const fns = blockInfo.blocks
                .sort((l, r) => - scorer(l, searchFor) + scorer(r, searchFor))
                .slice(0, SEARCH_RESULT_COUNT);

            resolve([fns, blockInfo]);
        })
    }
}