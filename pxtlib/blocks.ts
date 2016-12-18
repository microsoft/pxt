namespace pxt.blocks {
    export interface BlockParameter {
        name: string;
        type?: string;
        shadowType?: string;
        shadowValue?: string;
    }

    export function parameterNames(fn: pxtc.SymbolInfo): Map<BlockParameter> {
        // collect blockly parameter name mapping
        const instance = fn.kind == pxtc.SymbolKind.Method || fn.kind == pxtc.SymbolKind.Property;
        let attrNames: Map<BlockParameter> = {};

        if (instance) attrNames["this"] = { name: "this", type: fn.namespace };
        if (fn.parameters)
            fn.parameters.forEach(pr => attrNames[pr.name] = {
                name: pr.name,
                type: pr.type,
                shadowValue: pr.defaults ? pr.defaults[0] : undefined
            });
        if (fn.attributes.block) {
            Object.keys(attrNames).forEach(k => attrNames[k].name = "");
            let rx = /%([a-zA-Z0-9_]+)(=([a-zA-Z0-9_]+))?/g;
            let m: RegExpExecArray;
            let i = 0;
            while (m = rx.exec(fn.attributes.block)) {
                if (i == 0 && instance) {
                    attrNames["this"].name = m[1];
                    if (m[3]) attrNames["this"].shadowType = m[3];
                    m = rx.exec(fn.attributes.block); if (!m) break;
                }

                let at = attrNames[fn.parameters[i++].name];
                at.name = m[1];
                if (m[3]) at.shadowType = m[3];
            }
        }
        return attrNames;
    }


    export interface FieldDescription {
        n: string;
        pre?: string;
        p?: string;
        ni: number;
    }

    export function parseFields(b: string): FieldDescription[] {
        // normalize and validate common errors
        // made while translating
        let nb = b.replace(/%\s+/g, '%');
        if (nb != b)
            pxt.log(`block has extra spaces: ${b}`);
        if (nb[0] == nb[0].toLocaleUpperCase() && nb[0] != nb[0].toLowerCase())
            pxt.log(`block is capitalized: ${b}`);

        nb = nb.replace(/\s*\|\s*/g, '|');
        return nb.split('|').map((n, ni) => {
            let m = /([^%]*)\s*%([a-zA-Z0-9_]+)/.exec(n);
            if (!m) return { n, ni };

            let pre = m[1]; if (pre) pre = pre.trim();
            let p = m[2];
            return { n, ni, pre, p };
        });
    }
}
