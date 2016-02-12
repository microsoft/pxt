/// <reference path="./blockly.d.ts" />

export function injectToolbox(workspace: Blockly.Workspace, toolbox: Element, blockInfo: ts.mbit.BlockInfo): void {
    blockInfo.functions.sort((f1, f2) => {
        return (f1.attributes.weight || 0) - (f2.attributes.weight || 0);
    })

    var tb = <Element>toolbox.cloneNode(true);
    console.log('toolbox base:\n' + tb.innerHTML)
    blockInfo.functions
        .filter(fn => !!fn.attributes.blockId)
        .filter(fn => !tb.querySelector("block[type='" + fn.attributes.blockId + "']"))
        .forEach(fn => {
            var block = document.createElement("block");
            block.setAttribute("type", fn.attributes.blockId);
            if (fn.attributes.blockGap)
                block.setAttribute("gap", fn.attributes.blockGap);

            // collect blockly parameter name mapping
            var attrNames : Util.StringMap<string> = {};
            fn.parameters.forEach(pr => attrNames[pr.name] = pr.name);
            if (fn.attributes.block) {
                Object.keys(attrNames).forEach(k => attrNames[k] = "");
                /%[a-zA-Z0-9]+/g.exec(fn.attributes.block).forEach((m,i) => {
                    attrNames[fn.parameters[i].name] = m.slice(1);
                })
            }
            
            fn.parameters.filter(pr => !!attrNames[pr.name]).forEach(pr => {
                if (pr.type == "number") {
                    var value = document.createElement("value"); block.appendChild(value);
                    value.setAttribute("name", attrNames[pr.name]);
                    var shadow = document.createElement("shadow"); value.appendChild(shadow);
                    shadow.setAttribute("type", "math_number");
                    var field = document.createElement("field"); shadow.appendChild(field);
                    field.setAttribute("name", "NUM");
                    field.innerText = pr.initializer || "0";
                }
            })

            var category = tb.querySelector("category[name~='" + fn.namespace[0].toUpperCase() + fn.namespace.slice(1) + "']");
            if (!category) {
                console.log('toolbox: adding category ' + fn.namespace)
                category = document.createElement("category");
                tb.appendChild(category);
            }
            category.appendChild(block);
        })

    console.log('toolbox updated:\n' + tb.innerHTML)
    workspace.updateToolbox(tb)
}