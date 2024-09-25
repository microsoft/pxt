
import * as toolbox from "./toolbox";

// Breaks a block down into segments that can be displayed in a readable format.
export function getBlockTextParts(block: toolbox.BlockDefinition, params: pxtc.ParameterDesc[], isPython: boolean): pxt.editor.BlockTextParts | undefined {
    let description: pxt.editor.BlockTextPart[] = [];
    let compileInfo = pxt.blocks.compileInfo(block as pxtc.SymbolInfo);
    let parts = block.attributes._def && block.attributes._def.parts;
    if (block.attributes.parentBlock) {
        const parent = block.attributes.parentBlock;
        const parentBlockParts = [...parent.attributes._def.parts];
        const overrideLocation = parentBlockParts.findIndex((part: any) => part.kind === "param" && part.name === block.attributes.toolboxParentArgument);
        if (overrideLocation !== -1) {
            parentBlockParts.splice(overrideLocation, 1, ...block.attributes._def.parts);
            parts = parentBlockParts;
        }
    }

    if (parts) {
        if (params &&
            parts.filter((p: any) => p.kind == "param").length > params.length) {
            // add empty param when first argument is "this"
            params.unshift(null);
        }
        parts.forEach((part, i) => {
            switch (part.kind) {
                case "label":
                    description.push({kind: "label", content: part.text});
                    break;
                case "break":
                    description.push({kind: "break"});
                    break;
                case "param":
                    let actualParam = compileInfo?.definitionNameToParam[part.name];
                    let val = actualParam?.defaultValue
                        || part.varName
                        || actualParam?.actualName
                        || part.name
                    if (isPython && actualParam?.defaultValue) {
                        val = pxtc.tsSnippetToPySnippet(val);
                    }
                    description.push({kind: "param", content: val});
                    break;
            }
        })
    }

    return description.length > 0 ? { parts: description } : undefined;
}
