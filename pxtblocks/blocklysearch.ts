/// <reference path="../built/blockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />

namespace pxt.blocks.search {

    export function searchAsync(searchFor: string, blockInfo: pxtc.BlocksInfo): Promise<pxtc.SymbolInfo[]> {
        return new Promise<pxtc.SymbolInfo[]>((resolve, reject) => {
            let fns: pxtc.SymbolInfo[] = [];
            blockInfo.blocks
                .filter(fn => fn.namespace.indexOf(searchFor) > -1 || fn.name.toLowerCase().indexOf(searchFor) > -1)
                .forEach(fn => {
                    fns.push(fn);
                })
            resolve(fns);
        })
    }
}