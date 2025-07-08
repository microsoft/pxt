/// <reference path="../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { flyoutCategory, getAllFunctionDefinitionBlocks, LOCALIZATION_NAME_MUTATION_KEY } from "./plugins/functions";
import { DRAGGABLE_PARAM_INPUT_PREFIX } from "./loader";

const primitiveTypeRegex = /^(string|number|boolean)$/;

const typeDefaults: pxt.Map<{ field: string, block: string, defaultValue: string }> = {
    "string": {
        field: "TEXT",
        block: "text",
        defaultValue: ""
    },
    "number": {
        field: "NUM",
        block: "math_number",
        defaultValue: "0"
    },
    "boolean": {
        field: "BOOL",
        block: "logic_boolean",
        defaultValue: "false"
    },
    "Array": {
        field: "VAR",
        block: "variables_get",
        defaultValue: "list"
    }
}

// Matches arrays
export function isArrayType(type: string): string {
    const arrayTypeRegex = /^(?:Array<(.+)>)|(?:(.+)\[\])|(?:\[.+\])$/;
    let parsed = arrayTypeRegex.exec(type);
    if (parsed) {
        // Is an array, returns what type it is an array of
        if (parsed[1]) {
            // Is an array with form Array<type>
            return parsed[1];
        } else {
            // Is an array with form type[]
            return parsed[2];
        }
    } else {
        // Not an array
        return undefined;
    }
}

export function createShadowValue(info: pxtc.BlocksInfo, p: pxt.blocks.BlockParameter, shadowId?: string, defaultV?: string, parentIsShadow?: boolean, maxRecursion = 0): Element {
    defaultV = defaultV || p.defaultValue;
    shadowId = shadowId || p.shadowBlockId;
    if (!shadowId && p.range) shadowId = "math_number_minmax";
    let defaultValue: any;

    if (defaultV && defaultV.slice(0, 1) == "\"")
        defaultValue = JSON.parse(defaultV);
    else {
        defaultValue = defaultV;
    }

    if (p.type == "number" && shadowId == "value") {
        const field = document.createElement("field");
        field.setAttribute("name", p.definitionName);
        field.appendChild(document.createTextNode("0"));
        return field;
    }

    if (p.fieldEditor) {
        if (p.defaultValue) {
            const field = document.createElement("field");
            field.setAttribute("name", p.definitionName);
            field.appendChild(document.createTextNode(p.defaultValue));
            return field;
        }
        return undefined;
    }

    let paramType = pxt.Util.lookup(info.apis.byQName, p.type)

    let isEnum = paramType?.kind == pxtc.SymbolKind.Enum
    let isFixed = paramType && !!paramType.attributes.fixedInstances && !p.shadowBlockId;
    // let isConstantShim = !!fn.attributes.constantShim;
    let isCombined = p.type == "@combined@"

    if (!shadowId && (isEnum || isFixed || isCombined)) {
        if (defaultV) {
            const field = document.createElement("field");
            field.setAttribute("name", p.definitionName);
            field.appendChild(document.createTextNode(defaultV));
            return field;
        }
        return undefined;
    }

    const isVariable = shadowId == "variables_get";
    const isText = shadowId == "text";

    const value = document.createElement("value");
    value.setAttribute("name", p.definitionName);

    const isArray = (shadowId === "lists_create_with" || !shadowId) ? isArrayType(p.type) : undefined;

    const shadow = document.createElement(((isVariable || isArray) && !parentIsShadow) ? "block" : "shadow");

    value.appendChild(shadow);

    const typeInfo = typeDefaults[isArray || p.type];

    shadow.setAttribute("type", shadowId || (isArray ? 'lists_create_with' : typeInfo && typeInfo.block || p.type));
    shadow.setAttribute("colour", "#fff");

    if (isArray) {
        // if an array of booleans, numbers, or strings
        if (typeInfo && !shadowId) {
            let fieldValues: string[];

            switch (isArray) {
                case "number":
                    fieldValues = ["0", "1"];
                    break;
                case "string":
                    fieldValues = ["a", "b", "c"];
                    break;
                case "boolean":
                    fieldValues = ["FALSE", "FALSE", "FALSE"];
                    break;
            }
            buildArrayShadow(shadow, typeInfo.block, typeInfo.field, fieldValues);
            return value;
        }
        else if (shadowId && defaultValue) {
            buildArrayShadow(shadow, defaultValue);
            return value;
        }
    }
    if (typeInfo && (!shadowId || typeInfo.block === shadowId || shadowId === "math_number_minmax")) {
        const field = document.createElement("field");
        shadow.appendChild(field);

        let fieldName: string;
        switch (shadowId) {
            case "variables_get":
                fieldName = "VAR"; break;
            case "math_number_minmax":
                fieldName = "SLIDER"; break;
            default:
                fieldName = typeInfo.field; break;
        }

        field.setAttribute("name", fieldName);

        let value: Text;
        if (p.type == "boolean") {
            value = document.createTextNode((defaultValue || typeInfo.defaultValue).toUpperCase())
        }
        else {
            value = document.createTextNode(defaultValue || typeInfo.defaultValue)
        }

        field.appendChild(value);
    }
    else if (defaultValue) {
        const field = document.createElement("field");
        field.textContent = defaultValue;

        if (isVariable) {
            field.setAttribute("name", "VAR");
            shadow.appendChild(field);
        }
        else if (isText) {
            field.setAttribute("name", "TEXT");
            shadow.appendChild(field);
        }
        else if (shadowId) {
            const shadowInfo = info.blocksById[shadowId];
            if (shadowInfo && shadowInfo.attributes._def && shadowInfo.attributes._def.parameters.length) {
                const shadowParam = shadowInfo.attributes._def.parameters[0];
                field.setAttribute("name", shadowParam.name);
                shadow.appendChild(field);
            }
        }
        else {
            field.setAttribute("name", p.definitionName);
            shadow.appendChild(field);
        }
    }

    let mut: HTMLElement;
    if (p.range) {
        mut = document.createElement('mutation');
        mut.setAttribute('min', p.range.min.toString());
        mut.setAttribute('max', p.range.max.toString());
        mut.setAttribute('label', p.actualName.charAt(0).toUpperCase() + p.actualName.slice(1));
        if (p.fieldOptions) {
            if (p.fieldOptions['step']) mut.setAttribute('step', p.fieldOptions['step']);
            if (p.fieldOptions['color']) mut.setAttribute('color', p.fieldOptions['color']);
            if (p.fieldOptions['precision']) mut.setAttribute('precision', p.fieldOptions['precision']);
        }
    }

    if (p.fieldOptions) {
        if (!mut) mut = document.createElement('mutation');
        mut.setAttribute(`customfield`, JSON.stringify(p.fieldOptions));
    }

    if (mut) {
        shadow.appendChild(mut);
    }

    if (maxRecursion) {
        const allShadows = pxt.Util.toArray(value.getElementsByTagName("shadow"));
        for (const shadow of allShadows) {
            if (!shadow.innerHTML) {
                const shadowSymbol = info.blocks.find(s => s.attributes.blockId === shadow.getAttribute("type"));
                if (shadowSymbol) {
                    const shadowXml = createToolboxBlock(info, shadowSymbol, pxt.blocks.compileInfo(shadowSymbol), true, maxRecursion - 1);
                    while (shadowXml.firstChild) {
                        shadow.appendChild(shadowXml.firstChild.cloneNode(true));
                        shadowXml.firstChild.remove();
                    }
                }
            }
        }
    }

    return value;
}

function buildArrayShadow(shadow: Element, blockType: string, fieldName?: string, fieldValues?: string[]) {
    const itemCount = fieldValues ? fieldValues.length : 2;
    const mut = document.createElement('mutation');
    mut.setAttribute("items", "" + itemCount);
    mut.setAttribute("horizontalafter", "" + itemCount);
    shadow.appendChild(mut);

    for (let i = 0; i < itemCount; i++) {
        const innerValue = document.createElement("value");
        innerValue.setAttribute("name", "ADD" + i);
        const innerShadow = document.createElement("shadow");
        innerShadow.setAttribute("type", blockType);
        if (fieldName) {
            const field = document.createElement("field");
            field.setAttribute("name", fieldName);
            if (fieldValues) {
                field.appendChild(document.createTextNode(fieldValues[i]));
            }
            innerShadow.appendChild(field);
        }
        innerValue.appendChild(innerShadow);
        shadow.appendChild(innerValue);
    }
}

export function createFlyoutHeadingLabel(name: string, color?: string, icon?: string, iconClass?: string) {
    const headingLabel = createFlyoutLabel(name, pxt.toolbox.convertColor(color), icon, iconClass);
    headingLabel.setAttribute('web-class', 'blocklyFlyoutHeading');
    return headingLabel;
}

export function createFlyoutGroupLabel(name: string, icon?: string, labelLineWidth?: string, helpCallback?: string) {
    const groupLabel = createFlyoutLabel(name, undefined, icon);
    groupLabel.setAttribute('web-class', 'blocklyFlyoutGroup');
    groupLabel.setAttribute('web-line', '1.5');
    if (labelLineWidth) groupLabel.setAttribute('web-line-width', labelLineWidth);
    if (helpCallback) {
        groupLabel.setAttribute('web-help-button', 'true');
        groupLabel.setAttribute('callbackKey', helpCallback);
    }
    return groupLabel;
}

function createFlyoutLabel(name: string, color?: string, icon?: string, iconClass?: string): HTMLElement {
    // Add the Heading label
    let headingLabel = Blockly.utils.xml.createElement('label') as HTMLElement;
    headingLabel.setAttribute('text', name);
    if (color) {
        headingLabel.setAttribute('web-icon-color', pxt.toolbox.convertColor(color));
    }
    if (icon) {
        if (icon.length === 1) {
            headingLabel.setAttribute('web-icon', icon);
            if (iconClass) headingLabel.setAttribute('web-icon-class', iconClass);
        }
        else {
            headingLabel.setAttribute('web-icon-class', `blocklyFlyoutIcon${name}`);
        }
    }
    return headingLabel;
}

export function createFlyoutButton(callbackKey: string, label: string) {
    let button = Blockly.utils.xml.createElement('button') as Element;
    button.setAttribute('text', label);
    button.setAttribute('callbackKey', callbackKey);
    return button;
}

export function createFlyoutGap(gap: number) {
    const sep = Blockly.utils.xml.createElement("sep");
    sep.setAttribute("gap", gap + "");
    return sep;
}

export function createToolboxBlock(info: pxtc.BlocksInfo, fn: pxtc.SymbolInfo, comp: pxt.blocks.BlockCompileInfo, isShadow = false, maxRecursion = 0): HTMLElement {
    let parent: HTMLElement;
    let parentInput: HTMLElement;

    if (fn.attributes.toolboxParent) {
        const parentFn = info.blocksById[fn.attributes.toolboxParent];

        if (parentFn) {
            const parentInfo = pxt.blocks.compileInfo(parentFn);
            parent = createToolboxBlock(info, parentFn, parentInfo, isShadow);

            if (fn.attributes.toolboxParentArgument) {
                parentInput = parent.querySelector(`value[name=${fn.attributes.toolboxParentArgument}]`);

                if (!parentInput && parentInfo.parameters.some(p => p.definitionName === fn.attributes.toolboxParentArgument)) {
                    // The input is valid, it just doesn't have a shadow block specified in the parent function. Create
                    // a new input and add it to the parent block
                    parentInput = document.createElement("value");
                    parentInput.setAttribute("name", fn.attributes.toolboxParentArgument);
                    parent.appendChild(parentInput);
                }
            }
            else {
                parentInput = parent.querySelector("value");

                if (!parentInput) {
                    // try looking for the first parameter that isn't a field
                    for (const param of parentInfo.parameters) {
                        if (parent.querySelector(`field[name=${param.definitionName}]`)) continue;

                        parentInput = document.createElement("value");
                        parentInput.setAttribute("name", param.definitionName);
                        parent.appendChild(parentInput);
                        break;
                    }
                }
            }

            if (parentInput) {
                while (parentInput.firstChild) parentInput.removeChild(parentInput.firstChild);
            }
            else {
                parent = undefined;
            }
        }
    }

    //
    // toolbox update
    //
    let block = document.createElement((parent || isShadow) ? "shadow" : "block");
    block.setAttribute("type", fn.attributes.blockId);
    if (fn.attributes.blockGap)
        block.setAttribute("gap", fn.attributes.blockGap);
    else if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.defaultBlockGap)
        block.setAttribute("gap", pxt.appTarget.appTheme.defaultBlockGap.toString());
    if (comp.thisParameter) {
        const t = comp.thisParameter;

        const isFixedInstance = !!info.apis.byQName[t.type]?.attributes.fixedInstances;

        let shadowId = t.shadowBlockId;
        let defaultValue = t.defaultValue;

        if (!isFixedInstance && (!shadowId || shadowId === "variables_get")) {
            shadowId = "variables_get";
            defaultValue = defaultValue || t.definitionName;
        }

        const inputOrField = createShadowValue(info, t, shadowId, defaultValue, isShadow, maxRecursion);

        if (inputOrField) {
            block.appendChild(inputOrField);
        }
    }
    if (fn.attributes.shim === "ENUM_GET" || fn.attributes.shim === "KIND_GET") {
        if (fn.parameters?.length) {
            const def = fn.parameters[0].default;

            if (def) {
                const field = document.createElement("field");
                field.setAttribute("name", "MEMBER");
                field.textContent = def;
                block.appendChild(field);
            }
        }
    }
    else if (fn.parameters) {
        comp.parameters.filter(pr => primitiveTypeRegex.test(pr.type)
                || primitiveTypeRegex.test(isArrayType(pr.type))
                || pr.shadowBlockId
                || pr.defaultValue)
            .forEach(pr => {
                const inputOrField = createShadowValue(info, pr, undefined, undefined, isShadow, maxRecursion);
                if (inputOrField) {
                    block.appendChild(inputOrField);
                }
            })
        if (fn.attributes.draggableParameters) {
            comp.handlerArgs.forEach(arg => {
                // draggableParameters="variable":
                // <value name="HANDLER_DRAG_PARAM_arg">
                // <shadow type="variables_get_reporter">
                //     <field name="VAR">defaultName</field>
                // </shadow>
                // </value>

                // draggableParameters="reporter"
                // <value name="HANDLER_DRAG_PARAM_arg">
                //     <shadow type="argument_reporter_custom">
                //         <mutation typename="Sprite"></mutation>
                //         <field name="VALUE">mySprite</field>
                //     </shadow>
                // </value>
                const useReporter = fn.attributes.draggableParameters === "reporter";

                const value = document.createElement("value");
                value.setAttribute("name", DRAGGABLE_PARAM_INPUT_PREFIX + arg.name);

                const blockType = useReporter ? pxt.blocks.reporterTypeForArgType(arg.type) : "variables_get_reporter";
                const shadow = document.createElement("block");
                shadow.setAttribute("type", blockType);

                const mutation = document.createElement("mutation");
                shadow.appendChild(mutation);
                if (useReporter && blockType === "argument_reporter_custom") {
                    mutation.setAttribute("typename", arg.type);
                }
                mutation.setAttribute(LOCALIZATION_NAME_MUTATION_KEY, arg.localizationKey);

                const field = document.createElement("field");
                field.setAttribute("name", useReporter ? "VALUE" : "VAR");

                field.textContent = pxt.Util.htmlEscape(arg.name);

                shadow.appendChild(field);
                value.appendChild(shadow);
                block.appendChild(value);
            });
        }
        else {
            comp.handlerArgs.forEach(arg => {
                const field = document.createElement("field");
                field.setAttribute("name", "HANDLER_" + arg.name);
                field.textContent = arg.name;
                block.appendChild(field);
            });
        }
    }

    if (fn.attributes.expandArgumentsInToolbox) {
        let mutation: Element;

        for (const child of block.children) {
            if (child.tagName === "mutation") {
                mutation = child;
                break;
            }
        }

        if (!mutation) {
            mutation = document.createElement("mutation");
            block.appendChild(mutation);
        }

        mutation.setAttribute("_expanded", "" + fn.attributes._expandedDef.parameters.length);
    }

    if (parent) {
        parentInput.appendChild(block);
        return parent;
    }

    return block;
}

export function mkPredicateBlock(type: string) {
    const block = document.createElement("block");
    block.setAttribute("type", type);

    const value = document.createElement("value");
    value.setAttribute("name", "PREDICATE");
    block.appendChild(value);

    const shadow = mkFieldBlock("logic_boolean", "BOOL", "TRUE", true);
    value.appendChild(shadow);

    return block;
}

export function mkFieldBlock(type: string, fieldName: string, fieldValue: string, isShadow: boolean) {
    const fieldBlock = document.createElement(isShadow ? "shadow" : "block");
    fieldBlock.setAttribute("type", pxt.Util.htmlEscape(type));

    const field = document.createElement("field");
    field.setAttribute("name", pxt.Util.htmlEscape(fieldName));
    field.textContent = pxt.Util.htmlEscape(fieldValue);
    fieldBlock.appendChild(field);

    return fieldBlock;
}

export function mkVariableFieldBlock(type: string, id: string, typeString: string, name: string, isShadow: boolean) {
    const fieldBlock = document.createElement(isShadow ? "shadow" : "block");
    fieldBlock.setAttribute("type", pxt.Util.htmlEscape(type));

    const field = document.createElement("field");
    field.setAttribute("name", "VAR");
    field.id = id;
    field.setAttribute("variabletype", pxt.Util.htmlEscape(typeString))

    field.textContent = pxt.Util.htmlEscape(name);
    fieldBlock.appendChild(field);

    return fieldBlock;
}

export function mkReturnStatementBlock() {
    const block = document.createElement("block");
    block.setAttribute("type", "function_return");

    const value = document.createElement("value");
    value.setAttribute("name", "RETURN_VALUE");
    block.appendChild(value);

    const shadow = mkFieldBlock("math_number", "NUM", "0", true);
    value.appendChild(shadow);

    return block;
}

// Patch new functions flyout to add the heading
export function createFunctionsFlyoutCategory(workspace: Blockly.WorkspaceSvg) {
    const elems = flyoutCategory(workspace);

    if (elems.length > 1) {
        let returnBlock = mkReturnStatementBlock();
        // Add divider
        elems.splice(1, 0, createFlyoutGroupLabel(lf("Your Functions")));
        // Insert after the "make a function" button
        elems.splice(1, 0, returnBlock as HTMLElement);
    }

    const functionsWithReturn = getAllFunctionDefinitionBlocks(workspace)
        .filter(def => def.getDescendants(false).some(child => child.type === "function_return" && child.getInputTargetBlock("RETURN_VALUE")))
        .map(def => def.getField("function_name").getText())

    const headingLabel = createFlyoutHeadingLabel(lf("Functions"),
        pxt.toolbox.getNamespaceColor('functions'),
        pxt.toolbox.getNamespaceIcon('functions'),
        'blocklyFlyoutIconfunctions');
    elems.unshift(headingLabel);

    const res: Element[] = [];

    for (const e of elems) {
        res.push(e);
        if (e.getAttribute("type") === "function_call") {
            const mutation = e.children.item(0);

            if (mutation) {
                const name = mutation.getAttribute("name");
                if (functionsWithReturn.some(n => n === name)) {
                    const clone = e.cloneNode(true) as HTMLElement;
                    clone.setAttribute("type", "function_call_output");
                    res.push(clone);
                }
            }
        }
    }

    return res;
};