/// <reference path="../localtypings/blockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />
import Util = pxt.Util;

let lf = Util.lf;

namespace pxt.blocks {
    export const blockColors: Map<number | string> = {
        loops: '#107c10',
        logic: '#006970',
        math: '#712672',
        images: '#5C2D91',
        variables: '#A80000',
        functions: '#005a9e',
        text: '#996600',
        arrays: '#A94400',
        advanced: '#3c3c3c'
    }

    export enum CategoryMode {
        All,
        None,
        Basic
    }

    const typeDefaults: Map<{ field: string, block: string, defaultValue: string }> = {
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

    // Matches arrays and tuple types
    const arrayTypeRegex = /^(?:Array<.+>)|(?:.+\[\])|(?:\[.+\])$/;

    let usedBlocks: Map<boolean> = {};
    let updateUsedBlocks = false;

    // list of built-in blocks, should be touched.
    const builtinBlocks: Map<{
        block: B.BlockDefinition;
        symbol?: pxtc.SymbolInfo;
    }> = {};
    Object.keys(Blockly.Blocks)
        .forEach(k => builtinBlocks[k] = { block: Blockly.Blocks[k] });
    export const buildinBlockStatements: Map<boolean> = {
        "controls_if": true,
        "controls_for": true,
        "controls_simple_for": true,
        "controls_repeat_ext": true,
        "variables_set": true,
        "variables_change": true,
        "device_while": true
    }

    // blocks cached
    interface CachedBlock {
        hash: string;
        fn: pxtc.SymbolInfo;
        block: Blockly.BlockDefinition;
    }
    let cachedBlocks: Map<CachedBlock> = {};
    let searchElementCache: Map<Node> = {};

    export function blockSymbol(type: string): pxtc.SymbolInfo {
        let b = cachedBlocks[type];
        return b ? b.fn : undefined;
    }

    function createShadowValue(name: string, type: string, v?: string, shadowType?: string): Element {
        if (v && v.slice(0, 1) == "\"")
            v = JSON.parse(v);
        if (type == "number" && shadowType == "value") {
            const field = document.createElement("field");
            field.setAttribute("name", name);
            field.appendChild(document.createTextNode("0"));
            return field;
        }

        const value = document.createElement("value");
        value.setAttribute("name", name);

        const shadow = document.createElement(shadowType == "variables_get" ? "block" : "shadow");
        value.appendChild(shadow);

        const typeInfo = typeDefaults[type];

        shadow.setAttribute("type", shadowType || typeInfo && typeInfo.block || type);
        shadow.setAttribute("colour", (Blockly as any).Colours.textField);

        if (typeInfo) {
            const field = document.createElement("field");
            shadow.appendChild(field);

            let fieldName: string;
            switch (shadowType) {
                case "variables_get":
                    fieldName = "VAR"; break;
                case "math_number_minmax":
                    fieldName = "SLIDER"; break;
                default:
                    fieldName = typeInfo.field; break;
            }

            field.setAttribute("name", fieldName);

            let value: Text;
            if (type == "boolean") {
                value = document.createTextNode((v || typeInfo.defaultValue).toUpperCase())
            }
            else {
                value = document.createTextNode(v || typeInfo.defaultValue)
            }

            field.appendChild(value);
        }

        return value;
    }

    function createToolboxBlock(info: pxtc.BlocksInfo, fn: pxtc.SymbolInfo, attrNames: Map<BlockParameter>): HTMLElement {
        //
        // toolbox update
        //
        let block = document.createElement("block");
        block.setAttribute("type", fn.attributes.blockId);
        if (fn.attributes.blockGap)
            block.setAttribute("gap", fn.attributes.blockGap);
        else if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.defaultBlockGap)
            block.setAttribute("gap", pxt.appTarget.appTheme.defaultBlockGap.toString());
        if ((fn.kind == pxtc.SymbolKind.Method || fn.kind == pxtc.SymbolKind.Property)
            && attrNames["this"]) {
            let attr = attrNames["this"];
            block.appendChild(createShadowValue(attr.name, attr.type, attr.shadowValue || attr.name, attr.shadowType || "variables_get"));
        }
        if (fn.parameters) {
            fn.parameters.filter(pr => !!attrNames[pr.name].name &&
                (/^(string|number|boolean)$/.test(attrNames[pr.name].type)
                    || !!attrNames[pr.name].shadowType
                    || !!attrNames[pr.name].shadowValue))
                .forEach(pr => {
                    let attr = attrNames[pr.name];
                    let shadowValue: Element;
                    let container: HTMLElement;
                    if (pr.options && pr.options['min'] && pr.options['max']) {
                        shadowValue = createShadowValue(attr.name, attr.type, attr.shadowValue, 'math_number_minmax');
                        container = document.createElement('mutation');
                        container.setAttribute('min', pr.options['min'].value);
                        container.setAttribute('max', pr.options['max'].value);
                    } else {
                        shadowValue = createShadowValue(attr.name, attr.type, attr.shadowValue, attr.shadowType);
                    }
                    if (pr.options && pr.options['fieldEditorOptions']) {
                        if (!container) container = document.createElement('mutation');
                        container.setAttribute(`customfield`, JSON.stringify(pr.options['fieldEditorOptions'].value));
                    }
                    if (shadowValue && container)
                        shadowValue.firstChild.appendChild(container);
                    block.appendChild(shadowValue);
                })
        }
        searchElementCache[fn.attributes.blockId] = block.cloneNode(true);
        return block;
    }

    function createCategoryElement(name: string, nameid: string, weight: number, colour?: string, iconClass?: string): Element {
        const result = document.createElement("category");
        result.setAttribute("name", name);
        result.setAttribute("nameid", nameid.toLowerCase());
        result.setAttribute("weight", weight.toString());
        if (colour) {
            result.setAttribute("colour", colour);
        }
        if (iconClass) {
            result.setAttribute("iconclass", iconClass);
            result.setAttribute("expandedclass", iconClass);
        }
        return result;
    }

    function injectToolbox(tb: Element, info: pxtc.BlocksInfo, fn: pxtc.SymbolInfo, block: HTMLElement, showCategories = CategoryMode.Basic) {
        // identity function are just a trick to get an enum drop down in the block
        // while allowing the parameter to be a number
        if (fn.attributes.blockHidden)
            return;

        if (!fn.attributes.deprecated) {
            let ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
            let nsn = info.apis.byQName[ns];
            let isAdvanced = nsn && nsn.attributes.advanced;

            if (nsn) ns = nsn.attributes.block || ns;
            let catName = ts.pxtc.blocksCategory(fn);
            if (nsn && nsn.name)
                catName = Util.capitalize(nsn.name);

            let category = categoryElement(tb, catName);

            if (showCategories === CategoryMode.All || showCategories == CategoryMode.Basic && !isAdvanced) {
                if (!category) {
                    let categories = getChildCategories(tb)
                    let parentCategoryList = tb;

                    pxt.debug('toolbox: adding category ' + ns)

                    const nsWeight = (nsn ? nsn.attributes.weight : 50) || 50;
                    const locCatName = Util.capitalize((nsn ? nsn.attributes.block : "") || catName);
                    category = createCategoryElement(locCatName, catName, nsWeight);

                    if (nsn && nsn.attributes.color) {
                        category.setAttribute("colour", nsn.attributes.color);
                    }
                    else if (getNamespaceColor(ns)) {
                        category.setAttribute("colour", getNamespaceColor(ns));
                    }
                    if (nsn && nsn.attributes.icon) {
                        const nsnIconClassName = `blocklyTreeIcon${nsn.name.toLowerCase()}`.replace(/\s/g, '');
                        appendToolboxIconCss(nsnIconClassName, nsn.attributes.icon);
                        category.setAttribute("iconclass", nsnIconClassName);
                        category.setAttribute("expandedclass", nsnIconClassName);
                        category.setAttribute("web-icon", nsn.attributes.icon);
                    } else {
                        category.setAttribute("iconclass", `blocklyTreeIconDefault`);
                        category.setAttribute("expandedclass", `blocklyTreeIconDefault`);
                        category.setAttribute("web-icon", "\uf12e");
                    }
                    if (nsn && nsn.attributes.groups) {
                        category.setAttribute("groups", nsn.attributes.groups.join(', '));
                    }
                    if (nsn && nsn.attributes.labelLineWidth) {
                        category.setAttribute("labellinewidth", nsn.attributes.labelLineWidth);
                    }

                    insertTopLevelCategory(category, tb, nsWeight, isAdvanced);
                }
                if (fn.attributes.advanced) {
                    category = getOrAddSubcategoryByWeight(category, lf("More"), "More", 1, category.getAttribute("colour"), 'blocklyTreeIconmore')
                }
                else if (fn.attributes.subcategory) {
                    const sub = fn.attributes.subcategory;
                    const all = nsn.attributes.subcategories;
                    if (all && all.indexOf(sub) !== -1) {
                        // Respect the weights given by the package
                        const weight = 10000 - all.indexOf(sub);
                        category = getOrAddSubcategoryByWeight(category, sub, sub, weight, category.getAttribute("colour"), 'blocklyTreeIconmore')
                    }
                    else {
                        // If no weight is specified, insert alphabetically after the weighted subcategories but above "More"
                        category = getOrAddSubcategoryByName(category, sub, sub, category.getAttribute("colour"), 'blocklyTreeIconmore')
                    }
                }
            }

            if (showCategories === CategoryMode.Basic && isAdvanced) {
                const type = block.getAttribute("type");
                usedBlocks[type] = true;
            }

            if (fn.attributes.mutateDefaults) {
                const mutationValues = fn.attributes.mutateDefaults.split(";");
                mutationValues.forEach(mutation => {
                    const mutatedBlock = block.cloneNode(true) as HTMLElement;
                    mutateToolboxBlock(mutatedBlock, fn.attributes.mutate, mutation);
                    if (showCategories !== CategoryMode.None) {
                        insertBlock(mutatedBlock, category, fn.attributes.weight);
                    } else {
                        tb.appendChild(mutatedBlock);
                    }
                });
            }
            else {
                if (showCategories !== CategoryMode.None && !(showCategories === CategoryMode.Basic && isAdvanced)) {
                    insertBlock(block, category, fn.attributes.weight, fn.attributes.group);
                    injectToolboxIconCss();
                } else if (showCategories === CategoryMode.None) {
                    tb.appendChild(block);
                }
            }
        }

    }

    function insertBlock(bl: Element, cat: Element, weight?: number, group?: string) {
        const isBuiltin = !!blockColors[cat.getAttribute("nameid")];
        if (group) {
            bl.setAttribute("group", group)
        }
        if (isBuiltin && weight > 50) {
            bl.setAttribute("loaded", "true")

            let first: Element;
            for (let i = 0; i < cat.childNodes.length; i++) {
                const n = cat.childNodes.item(i) as Element;
                if (n.tagName === "block" && !n.getAttribute("loaded")) {
                    first = n;
                    break;
                }
            }

            if (first) {
                cat.insertBefore(bl, first);
            }
            else {
                cat.appendChild(bl);
            }
        }
        else {
            cat.appendChild(bl)
        }
    }

    let toolboxStyle: HTMLStyleElement;
    let toolboxStyleBuffer: string = '';
    export function appendToolboxIconCss(className: string, i: string): void {
        if (toolboxStyleBuffer.indexOf(className) > -1) return;

        if (i.length === 1) {
            const icon = Util.unicodeToChar(i);
            toolboxStyleBuffer += `
                .blocklyTreeIcon.${className}::before {
                    content: "${icon}";
                }
            `;
        }
        else {
            toolboxStyleBuffer += `
                .blocklyTreeIcon.${className} {
                    background-image: url("${pxt.webConfig.commitCdnUrl + encodeURI(i)}")!important;
                    width: 30px;
                    height: 100%;
                    background-size: 20px !important;
                    background-repeat: no-repeat !important;
                    background-position: 50% 50% !important;
                }
            `;
        }
    }

    export function injectToolboxIconCss(): void {
        if (!toolboxStyle) {
            toolboxStyle = document.createElement('style');
            toolboxStyle.id = "blocklyToolboxIcons";
            toolboxStyle.type = 'text/css';
            let head = document.head || document.getElementsByTagName('head')[0];
            head.appendChild(toolboxStyle);
        }

        if (toolboxStyle.sheet) {
            toolboxStyle.textContent = toolboxStyleBuffer + namespaceStyleBuffer;
        } else {
            toolboxStyle.appendChild(document.createTextNode(toolboxStyleBuffer + namespaceStyleBuffer));
        }
    }

    let namespaceStyleBuffer: string = '';
    export function appendNamespaceCss(namespace: string, color: string) {
        const ns = namespace.toLowerCase();
        color = color || '#dddddd'; // Default toolbox color
        if (namespaceStyleBuffer.indexOf(ns) > -1) return;
        namespaceStyleBuffer += `
            span.docs.${ns} {
                background-color: ${color} !important;
                border-color: ${Blockly.PXTUtils.fadeColour(color, 0.2, true)} !important;
            }
        `;
    }

    let iconCanvasCache: Map<string> = {};
    function iconToFieldImage(c: string): Blockly.FieldImage {
        let url = iconCanvasCache[c];
        if (!url) {
            if (c.length === 1) {
                let canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                let ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white';
                ctx.font = "56px Icons";
                ctx.textAlign = "center";
                ctx.fillText(c, canvas.width / 2, 56);
                url = iconCanvasCache[c] = canvas.toDataURL();
            }
            else {
                url = pxt.webConfig.commitCdnUrl + encodeURI(c);
            }
        }
        return new Blockly.FieldImage(url, 16, 16, '');
    }

    function getChildCategories(parent: Element) {
        const elements = parent.getElementsByTagName("category");
        const result: Element[] = [];

        for (let i = 0; i < elements.length; i++) {
            if (elements[i].parentNode === parent) { // IE11: no parentElement
                result.push(elements[i])
            }
        }

        return result;
    }

    function insertTopLevelCategory(category: Element, tb: Element, nsWeight: number, isAdvanced: boolean) {
        let categories = getChildCategories(tb);
        if (isAdvanced) {
            category.setAttribute("advanced", "true");
        }

        // Insert the category based on weight
        let ci = 0;
        for (ci = 0; ci < categories.length; ++ci) {
            let cat = categories[ci];
            const catAdvanced = cat.hasAttribute("advanced") && cat.getAttribute("advanced") !== "false";

            // Advanced categories always come last
            if (isAdvanced) {
                if (!catAdvanced) {
                    continue;
                }
            }
            else if (catAdvanced) {
                tb.insertBefore(category, cat);
                break;
            }

            if (parseInt(cat.getAttribute("weight") || "50") < nsWeight) {
                tb.insertBefore(category, cat);
                break;
            }
        }
        if (ci == categories.length)
            tb.appendChild(category);
    }

    function getOrAddSubcategoryByWeight(parent: Element, name: string, nameid: string, weight: number, colour?: string, iconClass?: string) {
        const existing = getFirstChildWithAttr(parent, "category", "nameid", nameid.toLowerCase())

        if (existing) {
            return existing;
        }

        const newCategory = createCategoryElement(name, nameid, weight, colour, iconClass);
        const siblings = parent.getElementsByTagName("category");

        let ci = 0;
        for (ci = 0; ci < siblings.length; ++ci) {
            let cat = siblings[ci];
            if (parseInt(cat.getAttribute("weight") || "50") < weight) {
                parent.insertBefore(newCategory, cat);
                break;
            }
        }
        if (ci == siblings.length)
            parent.appendChild(newCategory);

        return newCategory;
    }

    function getOrAddSubcategoryByName(parent: Element, name: string, nameid: string, colour?: string, iconClass?: string) {
        const existing = getFirstChildWithAttr(parent, "category", "nameid", nameid.toLowerCase())
        if (existing) {
            return existing;
        }

        const newCategory = createCategoryElement(name, nameid, 100, colour, iconClass);

        const siblings = parent.getElementsByTagName("category");
        const filtered: Element[] = [];

        let ci = 0;
        let inserted = false;
        let last: Element = undefined;
        for (ci = 0; ci < siblings.length; ++ci) {
            let cat = siblings[ci];
            const sibWeight = parseInt(cat.getAttribute("weight") || "50")

            if (sibWeight >= 1000) {
                continue;
            }
            else if (sibWeight === 1) {
                last = cat;
                break;
            }

            filtered.push(cat);

            if (!inserted && cat.getAttribute("name").localeCompare(name) >= 0) {
                parent.insertBefore(newCategory, cat);
                filtered.splice(filtered.length - 1, 0, newCategory);
                inserted = true;
            }
        }

        if (!inserted) {
            filtered.push(newCategory);

            if (last) {
                parent.insertBefore(newCategory, last);
            }
            else {
                parent.appendChild(newCategory);
            }
        }

        filtered.forEach((e, i) => {
            e.setAttribute("weight", (200 - i).toString());
        });

        return newCategory;
    }

    function injectBlockDefinition(info: pxtc.BlocksInfo, fn: pxtc.SymbolInfo, attrNames: Map<BlockParameter>, blockXml: HTMLElement): boolean {
        let id = fn.attributes.blockId;

        if (builtinBlocks[id]) {
            pxt.reportError("blocks", 'trying to override builtin block', { "details": id });
            return false;
        }

        let hash = JSON.stringify(fn);
        if (cachedBlocks[id] && cachedBlocks[id].hash == hash) {
            return true;
        }

        if (Blockly.Blocks[fn.attributes.blockId]) {
            console.error("duplicate block definition: " + id);
            return false;
        }

        let cachedBlock: CachedBlock = {
            hash: hash,
            fn: fn,
            block: {
                codeCard: mkCard(fn, blockXml),
                init: function () { initBlock(this, info, fn, attrNames) }
            }
        }

        cachedBlocks[id] = cachedBlock;
        Blockly.Blocks[id] = cachedBlock.block;

        return true;
    }

    function initField(i: any, ni: number, fn: pxtc.SymbolInfo, ns: pxtc.SymbolInfo, pre: string, right?: boolean, type?: string, nsinfo?: pxtc.SymbolInfo): any {
        if (ni == 0 && !pxt.appTarget.appTheme.disableBlockIcons) {
            const icon = ns && ns.attributes.icon ? ns.attributes.icon : null;
            if (icon)
                i.appendField(iconToFieldImage(icon));
        }
        if (pre)
            i.appendField(pre);
        if (right)
            i.setAlign(Blockly.ALIGN_LEFT)
        // Ignore generic types
        if (type && type != "T") {
            if (arrayTypeRegex.test(type)) {
                // All array types get the same check regardless of their subtype
                i.setCheck("Array");
            }
            else {
                i.setCheck(type);
            }
        }
        return i;
    }

    function cleanOuterHTML(el: HTMLElement): string {
        // remove IE11 junk
        return el.outerHTML.replace(/^<\?[^>]*>/, '');
    }

    function mkCard(fn: pxtc.SymbolInfo, blockXml: HTMLElement): pxt.CodeCard {
        return {
            name: fn.namespace + '.' + fn.name,
            shortName: fn.name,
            description: fn.attributes.jsDoc,
            url: fn.attributes.help ? 'reference/' + fn.attributes.help.replace(/^\//, '') : undefined,
            blocksXml: `<xml xmlns="http://www.w3.org/1999/xhtml">${cleanOuterHTML(blockXml)}</xml>`,
        }
    }

    function isSubtype(apis: pxtc.ApisInfo, specific: string, general: string) {
        if (specific == general) return true
        let inf = apis.byQName[specific]
        if (inf && inf.extendsTypes)
            return inf.extendsTypes.indexOf(general) >= 0
        return false
    }

    function initBlock(block: Blockly.Block, info: pxtc.BlocksInfo, fn: pxtc.SymbolInfo, attrNames: Map<BlockParameter>) {
        const ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
        const instance = fn.kind == pxtc.SymbolKind.Method || fn.kind == pxtc.SymbolKind.Property;
        const nsinfo = info.apis.byQName[ns];
        const color =
            fn.attributes.color
            || (nsinfo ? nsinfo.attributes.color : undefined)
            || getNamespaceColor(ns.toLowerCase())
            || 255;

        if (fn.attributes.help)
            block.setHelpUrl("/reference/" + fn.attributes.help.replace(/^\//, ''));
        else if (fn.pkg && !pxt.appTarget.bundledpkgs[fn.pkg]) {// added package
            let anchor = fn.qName.toLowerCase().split('.');
            if (anchor[0] == fn.pkg) anchor.shift();
            block.setHelpUrl(`/pkg/${fn.pkg}#${encodeURIComponent(anchor.join('-'))}`)
        }

        block.setTooltip(fn.attributes.jsDoc);
        block.setColour(color, fn.attributes.colorSecondary, fn.attributes.colorTertiary);
        let blockShape = Blockly.OUTPUT_SHAPE_ROUND;
        switch (fn.retType) {
            case "number": blockShape = Blockly.OUTPUT_SHAPE_ROUND; break;
            case "boolean": blockShape = Blockly.OUTPUT_SHAPE_HEXAGONAL; break;
            case "string": blockShape = Blockly.OUTPUT_SHAPE_SQUARE; break;
        }
        block.setOutputShape(blockShape);
        if (fn.attributes.undeletable)
            block.setDeletable(false);

        parseFields(fn.attributes.block).map(field => {
            let i: any;
            if (!field.p) {
                i = initField(block.appendDummyInput(), field.ni, fn, nsinfo, field.n);
            } else {
                // find argument
                let pre = field.pre;
                let p = field.p;
                let n = Object.keys(attrNames).filter(k => attrNames[k].name == p)[0];
                if (!n) {
                    console.error("block " + fn.attributes.blockId + ": unkown parameter " + p);
                    return;
                }
                let pr = attrNames[n];
                let typeInfo = U.lookup(info.apis.byQName, pr.type)

                let isEnum = typeInfo && typeInfo.kind == pxtc.SymbolKind.Enum
                let isFixed = typeInfo && !!typeInfo.attributes.fixedInstances
                let customField = (fn.attributes.paramFieldEditor && fn.attributes.paramFieldEditor[p]);

                if (isEnum || isFixed) {
                    const syms = Util.values(info.apis.byQName)
                        .filter(e =>
                            isEnum ? e.namespace == pr.type
                                : (e.kind == pxtc.SymbolKind.Variable
                                    && e.attributes.fixedInstance
                                    && isSubtype(info.apis, e.retType, typeInfo.qName)))
                    if (syms.length == 0) {
                        console.error(`no instances of ${typeInfo.qName} found`)
                    }
                    const dd = syms.map(v => {
                        const k = v.attributes.block || v.attributes.blockId || v.name;
                        return [
                            v.attributes.blockImage ? {
                                src: pxt.webConfig.commitCdnUrl + `blocks/${v.namespace.toLowerCase()}/${v.name.toLowerCase()}.png`,
                                alt: k,
                                width: 36,
                                height: 36,
                                value: v.name
                            } : k,
                            v.namespace + "." + v.name
                        ];
                    });
                    i = initField(block.appendDummyInput(), field.ni, fn, nsinfo, pre, true);
                    // if a value is provided, move it first
                    if (pr.shadowValue) {
                        let shadowValueIndex = -1;
                        dd.some((v, i) => {
                            if (v[1] === pr.shadowValue) {
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

                    if (customField) {
                        let defl = fn.attributes.paramDefl[pr.name] || "";
                        const options = {
                            data: dd,
                            colour: color
                        } as Blockly.FieldCustomDropdownOptions;
                        Util.jsonMergeFrom(options, fn.attributes.paramFieldEditorOptions && fn.attributes.paramFieldEditorOptions[pr.name] || {});
                        i.appendField(createFieldEditor(customField, defl, options), attrNames[n].name);
                    }
                    else
                        i.appendField(new Blockly.FieldDropdown(dd), attrNames[n].name);

                } else if (customField) {
                    i = initField(block.appendDummyInput(), field.ni, fn, nsinfo, pre, true);
                    const defl = fn.attributes.paramDefl[pr.name] || "";
                    const options = {
                        colour: color
                    } as Blockly.FieldCustomOptions;
                    Util.jsonMergeFrom(options, fn.attributes.paramFieldEditorOptions && fn.attributes.paramFieldEditorOptions[pr.name] || {});
                    i.appendField(createFieldEditor(customField, defl, options), attrNames[n].name);
                } else if (instance && n == "this") {
                    if (!fn.attributes.defaultInstance) {
                        i = initField(block.appendValueInput(p), field.ni, fn, nsinfo, pre, true, pr.type);
                    }
                } else if (pr.type == "number") {
                    if (pr.shadowType && pr.shadowType == "value") {
                        i = block.appendDummyInput();
                        if (pre) i.appendField(pre)
                        i.appendField(new Blockly.FieldTextInput("0", Blockly.FieldTextInput.numberValidator), p);
                    }
                    else i = initField(block.appendValueInput(p), field.ni, fn, nsinfo, pre, true, "Number");
                }
                else if (pr.type == "boolean") {
                    i = initField(block.appendValueInput(p), field.ni, fn, nsinfo, pre, true, "Boolean");
                } else if (pr.type == "string") {
                    i = initField(block.appendValueInput(p), field.ni, fn, nsinfo, pre, true, "String");
                } else {
                    i = initField(block.appendValueInput(p), field.ni, fn, nsinfo, pre, true, pr.type);
                }
            }
        });

        if (fn.attributes.mutate) {
            addMutation(block as MutatingBlock, fn, fn.attributes.mutate);
        }
        else if (fn.attributes.defaultInstance) {
            addMutation(block as MutatingBlock, fn, MutatorTypes.DefaultInstanceMutator);
        }

        const oldMutationToDom = (block as MutatingBlock).mutationToDom;
        const oldDomToMutation = (block as MutatingBlock).domToMutation;
        (block as MutatingBlock).mutationToDom = () => {
            let retVal = oldMutationToDom ? oldMutationToDom.call(this) : document.createElement('mutation');
            block.inputList.forEach(input => {
                input.fieldRow.forEach((fieldRow: Blockly.FieldCustom) => {
                    if (fieldRow.isFieldCustom_ && fieldRow.saveOptions) {
                        const getOptions = fieldRow.saveOptions();
                        retVal.setAttribute(`customfield`, JSON.stringify(getOptions));
                    }
                })
            })
            return retVal;
        }
        (block as MutatingBlock).domToMutation = (mutation) => {
            if (oldDomToMutation) oldDomToMutation.call(this, mutation);
            block.inputList.forEach(input => {
                input.fieldRow.forEach((fieldRow: Blockly.FieldCustom) => {
                    if (fieldRow.isFieldCustom_ && fieldRow.restoreOptions) {
                        const options = JSON.parse(mutation.getAttribute(`customfield`));
                        fieldRow.restoreOptions(options);
                    }
                })
            })
        }

        if (fn.attributes.imageLiteral) {
            for (let r = 0; r < 5; ++r) {
                let ri = block.appendDummyInput();
                for (let c = 0; c < fn.attributes.imageLiteral * 5; ++c) {
                    if (c > 0 && c % 5 == 0) ri.appendField("  ");
                    else if (c > 0) ri.appendField(" ");
                    ri.appendField(new Blockly.FieldCheckbox("FALSE"), "LED" + c + r);
                }
            }
        }

        if (fn.attributes.inlineInputMode === "external") {
            block.setInputsInline(false);
        }
        else if (fn.attributes.inlineInputMode === "inline") {
            block.setInputsInline(true);
        }
        else {
            block.setInputsInline(fn.parameters.length < 4 && !fn.attributes.imageLiteral);
        }

        const body = fn.parameters ? fn.parameters.filter(pr => pr.type == "() => void")[0] : undefined;
        if (body) {
            block.appendStatementInput("HANDLER")
                .setCheck("null");
            block.setInputsInline(true);
        }

        switch (fn.retType) {
            case "number": block.setOutput(true, "Number"); break;
            case "string": block.setOutput(true, "String"); break;
            case "boolean": block.setOutput(true, "Boolean"); break;
            case "void": break; // do nothing
            //TODO
            default:
                if (arrayTypeRegex.test(fn.retType)) {
                    block.setOutput(true, "Array");
                }
                else {
                    block.setOutput(true, fn.retType !== "T" ? fn.retType : undefined);
                }
        }

        // hook up/down if return value is void
        const hasHandlers = hasArrowFunction(fn);
        block.setPreviousStatement(!(hasHandlers && !fn.attributes.handlerStatement) && fn.retType == "void");
        block.setNextStatement(!(hasHandlers && !fn.attributes.handlerStatement) && fn.retType == "void");

        block.setTooltip(fn.attributes.jsDoc);
    }

    export function hasArrowFunction(fn: pxtc.SymbolInfo): boolean {
        const r = fn.parameters
            ? fn.parameters.filter(pr => /^\([^\)]*\)\s*=>/.test(pr.type))[0]
            : undefined;
        return !!r;
    }

    function removeCategory(tb: Element, name: string) {
        let e = categoryElement(tb, name);
        if (e && e.parentNode) // IE11: no parentElement
            e.parentNode.removeChild(e);
    }

    export interface BlockFilters {
        namespaces?: { [index: string]: FilterState; }; // Disabled = 2, Hidden = 0, Visible = 1
        blocks?: { [index: string]: FilterState; }; // Disabled = 2, Hidden = 0, Visible = 1
        defaultState?: FilterState; // hide, show or disable all by default
    }

    export enum FilterState {
        Hidden = 0,
        Visible = 1,
        Disabled = 2
    }

    export function createToolbox(blockInfo: pxtc.BlocksInfo, toolbox?: Element, showCategories = CategoryMode.Basic, filters?: BlockFilters): Element {
        init();

        // create new toolbox and update block definitions
        let tb = toolbox ? <Element>toolbox.cloneNode(true) : undefined;
        blockInfo.blocks.sort((f1, f2) => {
            let ns1 = blockInfo.apis.byQName[f1.attributes.blockNamespace || f1.namespace.split('.')[0]];
            let ns2 = blockInfo.apis.byQName[f2.attributes.blockNamespace || f2.namespace.split('.')[0]];

            if (ns1 && !ns2) return -1; if (ns2 && !ns1) return 1;
            let c = 0;
            if (ns1 && ns2) {

                c = (ns2.attributes.weight || 50) - (ns1.attributes.weight || 50);
                if (c != 0) return c;
            }
            c = (f2.attributes.weight || 50) - (f1.attributes.weight || 50);
            return c;
        })

        searchElementCache = {};
        usedBlocks = {};
        let currentBlocks: Map<number> = {};
        let showAdvanced = false;
        const dbg = pxt.options.debug;
        // create new toolbox and update block definitions
        blockInfo.blocks
            .filter(fn => !tb || !getFirstChildWithAttr(tb, "block", "type", fn.attributes.blockId))
            .forEach(fn => {
                if (fn.attributes.blockBuiltin) {
                    Util.assert(!!builtinBlocks[fn.attributes.blockId]);
                    builtinBlocks[fn.attributes.blockId].symbol = fn;
                } else {
                    let pnames = parameterNames(fn);
                    let block = createToolboxBlock(blockInfo, fn, pnames);
                    if (injectBlockDefinition(blockInfo, fn, pnames, block)) {
                        if (tb && (!fn.attributes.debug || dbg))
                            injectToolbox(tb, blockInfo, fn, block, showCategories);
                        currentBlocks[fn.attributes.blockId] = 1;
                        if (!showAdvanced && !fn.attributes.blockHidden && !fn.attributes.deprecated) {
                            let ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
                            let nsn = blockInfo.apis.byQName[ns];
                            showAdvanced = showAdvanced || (nsn && nsn.attributes.advanced);
                        }
                    }
                }
            });

        // remove unused blocks
        Object
            .keys(cachedBlocks).filter(k => !currentBlocks[k])
            .forEach(k => removeBlock(cachedBlocks[k].fn));

        // add extra blocks
        if (tb && pxt.appTarget.runtime) {
            const extraBlocks = pxt.appTarget.runtime.extraBlocks || [];
            extraBlocks.push({
                namespace: pxt.appTarget.runtime.onStartNamespace || "loops",
                weight: pxt.appTarget.runtime.onStartWeight || 10,
                type: ts.pxtc.ON_START_TYPE
            })
            extraBlocks.forEach(eb => {
                let el = document.createElement("block");
                el.setAttribute("type", eb.type);
                el.setAttribute("weight", (eb.weight || 50).toString());
                if (eb.gap) el.setAttribute("gap", eb.gap.toString());
                if (eb.fields) {
                    for (let f in eb.fields) {
                        let fe = document.createElement("field");
                        fe.setAttribute("name", f);
                        fe.appendChild(document.createTextNode(eb.fields[f]));
                        el.appendChild(fe);
                    }
                }
                if (showCategories !== CategoryMode.None) {
                    let cat = categoryElement(tb, eb.namespace);
                    if (cat) {
                        insertBlock(el, cat, eb.weight)
                    } else {
                        console.error(`trying to add block ${eb.type} to unknown category ${eb.namespace}`)
                    }
                } else {
                    tb.appendChild(el);
                }
            })
        }

        if (tb && showCategories !== CategoryMode.None) {
            // remove unused categories
            let config = pxt.appTarget.runtime || {};
            initBuiltinCategoryXml("Math", !config.mathBlocks);
            initBuiltinCategoryXml("Variables", !config.variablesBlocks);
            initBuiltinCategoryXml("Logic", !config.logicBlocks);
            initBuiltinCategoryXml("Loops", !config.loopsBlocks);
            initBuiltinCategoryXml("Text", !config.textBlocks);
            initBuiltinCategoryXml("Arrays", !config.listsBlocks);
            initBuiltinCategoryXml("Functions", !config.functionBlocks);

            if (!config.listsBlocks && config.loopsBlocks) {
                const cat = categoryElement(tb, "Loops");
                if (cat) {
                    cat.removeChild(getFirstChildWithAttr(cat, "block", "type", "controls_for_of"))
                }
            }

            // Load localized names for default categories
            let cats = tb.getElementsByTagName('category');
            for (let i = 0; i < cats.length; i++) {
                cats[i].setAttribute('name',
                    Util.rlf(`{id:category}${cats[i].getAttribute('name')}`, []));
                // Append Namespace CSS
                appendNamespaceCss(cats[i].getAttribute('name'), cats[i].getAttribute('colour'));
            }

            // update category colors and add heading
            let topCats = getDirectChildren(tb, "category")

            for (let i = 0; i < topCats.length; i++) {
                const nsColor = getNamespaceColor(topCats[i].getAttribute('nameid'));
                if (nsColor && nsColor != "") {
                    topCats[i].setAttribute('colour', nsColor);
                    // update children colors
                    const childCats = topCats[i].getElementsByTagName('category');
                    for (let j = 0; j < childCats.length; j++) {
                        childCats[j].setAttribute('colour', nsColor);
                    }
                }
                if (!pxt.appTarget.appTheme.hideFlyoutHeadings) {
                    // Add the Heading label
                    let headingLabel = goog.dom.createDom('label');
                    headingLabel.setAttribute('text', topCats[i].getAttribute('name'));
                    headingLabel.setAttribute('web-class', 'blocklyFlyoutHeading');
                    headingLabel.setAttribute('web-icon-color', topCats[i].getAttribute('colour'));
                    let icon = topCats[i].getAttribute('web-icon');
                    let iconClass = topCats[i].getAttribute('web-icon-class');
                    if (icon) {
                        if (icon.length === 1) {
                            headingLabel.setAttribute('web-icon', icon);
                            if (iconClass) headingLabel.setAttribute('web-icon-class', iconClass);
                        }
                        else {
                            toolboxStyleBuffer += `
                                .blocklyFlyoutLabelIcon.blocklyFlyoutIcon${topCats[i].getAttribute('name')} {
                                    display: inline-block !important;
                                    background-image: url("${pxt.webConfig.commitCdnUrl + encodeURI(icon)}")!important;
                                    width: 1em;
                                    height: 1em;
                                    background-size: 1em!important;
                                }
                            `;
                            injectToolboxIconCss();
                            headingLabel.setAttribute('web-icon-class', `blocklyFlyoutIcon${topCats[i].getAttribute('name')}`);
                        }
                    }
                    topCats[i].insertBefore(headingLabel, topCats[i].firstChild);
                }
            }
        }

        // Do not remove this comment.
        // These are used for category names.
        // lf("{id:category}Loops")
        // lf("{id:category}Logic")
        // lf("{id:category}Variables")
        // lf("{id:category}Math")
        // lf("{id:category}Advanced")
        // lf("{id:category}Functions")
        // lf("{id:category}Arrays")
        // lf("{id:category}Text")
        // lf("{id:category}Search")
        // lf("{id:category}More\u2026")

        // update shadow types
        if (tb) {
            $(tb).find('shadow:empty').each((i, shadow) => {
                let type = shadow.getAttribute('type');
                let b = $(tb).find(`block[type="${type}"]`)[0];
                if (b) shadow.innerHTML = b.innerHTML;
            })
        }

        // Add the "Advanced" category
        if (showAdvanced && tb && showCategories !== CategoryMode.None) {
            const cat = createCategoryElement(Util.lf("{id:category}Advanced"), "Advanced", 1, getNamespaceColor('advanced'), showCategories === CategoryMode.Basic ? 'blocklyTreeIconadvancedcollapsed' : 'blocklyTreeIconadvancedexpanded');
            insertTopLevelCategory(document.createElement("sep"), tb, 1.5, false);
            insertTopLevelCategory(cat, tb, 1, false);
        }

        if (tb && (!showAdvanced || showCategories === CategoryMode.All) && pxt.appTarget.cloud && pxt.appTarget.cloud.packages) {
            if (!showAdvanced) {
                insertTopLevelCategory(document.createElement("sep"), tb, 1.5, false);
            }
            // Add the "Add package" category
            getOrAddSubcategoryByWeight(tb, Util.lf("{id:category}Add Package"), "Add Package", 1, "#717171", 'blocklyTreeIconaddpackage')
        }

        if (tb) {
            const blocks = tb.getElementsByTagName("block");

            for (let i = 0; i < blocks.length; i++) {
                usedBlocks[blocks.item(i).getAttribute("type")] = true;
            }

            updateUsedBlocks = true;
        }

        // Rearrange blocks in the flyout and add group labels
        if (tb) {
            let categories = tb.getElementsByTagName(`category`);
            for (let ci = 0; ci < categories.length; ++ci) {
                let cat = categories.item(ci);
                let catName = cat.getAttribute("nameid");
                if (catName === "advanced") continue;

                let blocks = getDirectChildren(cat, `block`);
                let groups = cat.getAttribute("groups");
                let labelLineWidth = cat.getAttribute("labellinewidth");
                let blockGroups: {[group: string]: Element[]} = {}
                let sortedGroups: string[] = [];
                if (groups) sortedGroups = groups.split(', ');

                // Organize the blocks into the different groups
                for (let bi = 0; bi < blocks.length; ++bi) {
                    let blk = blocks[bi];
                    let group = blk.getAttribute("group") || 'other';
                    if (!blockGroups[group]) blockGroups[group] = [];
                    blockGroups[group].push(blk);
                }

                if (Object.keys(blockGroups).length > 1) {
                    // Add any missing groups to the sorted groups list
                    Object.keys(blockGroups).sort().forEach(group => {
                        if (sortedGroups.indexOf(group) == -1) {
                            sortedGroups.push(group);
                        }
                    })

                    // Add the blocks to the xmlList
                    let xmlList: Element[] = [];
                    for (let bg = 0; bg < sortedGroups.length; ++bg) {
                        let group = sortedGroups[bg];
                        // Add the group label
                        if (group != 'other') {
                            let groupLabel = goog.dom.createDom('label');
                            groupLabel.setAttribute('text', pxt.Util.rlf(`{id:group}${group}`));
                            groupLabel.setAttribute('web-class', 'blocklyFlyoutGroup');
                            groupLabel.setAttribute('web-line', '1.5');
                            if (labelLineWidth) groupLabel.setAttribute('web-line-width', labelLineWidth);
                            xmlList.push(groupLabel as HTMLElement);
                        }

                        // Add the blocks in that group
                        if (blockGroups[group])
                            blockGroups[group].forEach(groupedBlock => {
                                cat.removeChild(groupedBlock);
                                xmlList.push(groupedBlock);
                            })
                    }

                    // Add the blocks back into the category
                    xmlList.forEach(arrangedBlock => {
                        cat.appendChild(arrangedBlock);
                    })
                }
            }
        }

        // Filter the blocks
        if (tb && filters) {
            function filterBlocks(blocks: any, defaultState?: number) {
                let hasChild: boolean = false;
                for (let bi = 0; bi < blocks.length; ++bi) {
                    let blk = blocks.item(bi);
                    let type = blk.getAttribute("type");
                    let blockState = filters.blocks && filters.blocks[type] != undefined ? filters.blocks[type] : (defaultState != undefined ? defaultState : filters.defaultState);
                    switch (blockState) {
                        case FilterState.Hidden:
                            blk.parentNode.removeChild(blk); --bi; break;
                        case FilterState.Disabled:
                            blk.setAttribute("disabled", "true"); break;
                        case FilterState.Visible:
                            hasChild = true; break;
                    }
                }
                return hasChild;
            }

            if (showCategories !== CategoryMode.None) {
                // Go through namespaces and keep the ones with an override
                let categories = tb.getElementsByTagName(`category`);
                for (let ci = 0; ci < categories.length; ++ci) {
                    let cat = categories.item(ci);
                    let catName = cat.getAttribute("nameid");

                    if (catName === "more" || catName === "advanced") {
                        continue;
                    }

                    // The variables category is special and won't have any children so we
                    // need to check manually
                    if (catName === "variables" && (!filters.blocks ||
                        filters.blocks["variables_set"] ||
                        filters.blocks["variables_get"] ||
                        filters.blocks["variables_change"]) &&
                        (!filters.namespaces || filters.namespaces["variables"] !== FilterState.Disabled)) {
                        continue;
                    }

                    let categoryState = filters.namespaces && filters.namespaces[catName] != undefined ? filters.namespaces[catName] : filters.defaultState;
                    let blocks = cat.getElementsByTagName(`block`);

                    let hasVisibleChildren = filterBlocks(blocks, categoryState);
                    switch (categoryState) {
                        case FilterState.Disabled:
                            if (!hasVisibleChildren) {
                                cat.setAttribute("disabled", "true");
                                // disable sub categories
                                let subcategories = cat.getElementsByTagName(`category`);
                                for (let si = 0; si < subcategories.length; ++si) {
                                    subcategories.item(si).setAttribute("disabled", "true");
                                }
                            } break;
                        case FilterState.Visible:
                        case FilterState.Hidden:
                            if (!hasVisibleChildren) {
                                cat.parentNode.removeChild(cat); --ci;
                            } break;
                    }
                }
                // If advanced has no children, remove the category
                for (let ci = 0; ci < categories.length; ++ci) {
                    let cat = categories.item(ci);
                    let catName = cat.getAttribute("nameid");
                    if (catName == "advanced" && cat.childNodes.length == 0) {
                        cat.parentNode.removeChild(cat); --ci;
                        // Remove separator
                        const sep = tb.getElementsByTagName(`sep`)[0];
                        sep.parentNode.removeChild(sep);
                    } else {
                        continue;
                    }
                }
            } else {
                let blocks = tb.getElementsByTagName(`block`);
                filterBlocks(blocks);
            }

            if (showCategories !== CategoryMode.None) {
                // Go through all categories, hide the ones that have no blocks inside
                let categories = tb.getElementsByTagName(`category`);
                for (let ci = 0; ci < categories.length; ++ci) {
                    let cat = categories.item(ci);
                    let catName = cat.getAttribute("nameid");
                    // Don't do this for special blockly categories
                    if (catName == "variables" || catName == "functions" || catName == "advanced") continue;
                    let blockCount = cat.getElementsByTagName(`block`);
                    if (blockCount.length == 0) {
                        if (cat.parentNode) cat.parentNode.removeChild(cat);
                    }
                }
            }
        }

        return tb;


        function initBuiltinCategoryXml(name: string, remove: boolean) {
            if (remove) {
                 removeCategory(tb, name);
                 return;
            }

            const cat = categoryElement(tb, name);
            if (cat) {
                const attr = cat.getAttribute("advanced");
                if (attr && attr !== "false") {
                    showAdvanced = true;

                    // Record all block usages in case this category doesn't show up
                    // in the toolbox (i.e. advanced is collapsed)
                    const blockElements = cat.getElementsByTagName("block");
                    for (let i = 0; i < blockElements.length; i++) {
                        const b = blockElements.item(i);
                        usedBlocks[b.getAttribute("type")] = true;
                    }

                    if (showCategories === CategoryMode.Basic) {
                        removeCategory(tb, name);
                    }
                }
            }
        }
    }

    export function initBlocks(blockInfo: pxtc.BlocksInfo, toolbox?: Element, showCategories = CategoryMode.Basic, filters?: BlockFilters): Element {
        init();
        initTooltip(blockInfo);

        let tb = createToolbox(blockInfo, toolbox, showCategories, filters);

        // add trash icon to toolbox
        if (!document.getElementById("blocklyTrashIcon")) {
            let trashDiv = document.createElement('div');
            trashDiv.id = "blocklyTrashIcon";
            trashDiv.style.opacity = '0';
            trashDiv.style.display = 'none';
            let trashIcon = document.createElement('i');
            trashIcon.className = 'trash icon';
            trashDiv.appendChild(trashIcon);
            const injectionDiv = document.getElementsByClassName('injectionDiv')[0];
            if (injectionDiv) injectionDiv.appendChild(trashDiv);
        }

        return tb;
    }

    export let cachedSearchTb: Element;
    export let cachedSearchTbAll: Element;
    export function initSearch(workspace: Blockly.Workspace, tb: Element, tbAll: Element,
        searchAsync: (searchFor: pxtc.service.SearchOptions) => Promise<pxtc.service.SearchInfo[]>,
        updateToolbox: (tb: Element) => void) {

        let blocklySearchInputField = document.getElementById('blocklySearchInputField') as HTMLInputElement;
        let blocklySearchInput = document.getElementById('blocklySearchInput') as HTMLElement;
        let blocklyHiddenSearchLabel = document.getElementById('blocklySearchLabel') as HTMLElement;

        let origClassName = 'ui fluid icon input';
        if (!blocklySearchInput) {
            let blocklySearchArea = document.createElement('div');
            blocklySearchArea.id = 'blocklySearchArea';

            blocklySearchInput = document.createElement('div');
            blocklySearchInput.id = 'blocklySearchInput';
            blocklySearchInput.className = origClassName;
            blocklySearchInput.setAttribute("role", "search");

            blocklySearchInputField = document.createElement('input');
            blocklySearchInputField.type = 'text';
            blocklySearchInputField.placeholder = lf("Search...");
            blocklySearchInputField.id = 'blocklySearchInputField';
            blocklySearchInputField.className = 'blocklySearchInputField';

            // Append to dom
            let blocklySearchInputIcon = document.createElement('i');
            blocklySearchInputIcon.className = 'search icon';
            blocklySearchInputIcon.setAttribute("role", "presentation");
            blocklySearchInputIcon.setAttribute("aria-hidden", "true");

            blocklyHiddenSearchLabel = document.createElement('div');
            blocklyHiddenSearchLabel.className = 'accessible-hidden';
            blocklyHiddenSearchLabel.id = 'blocklySearchLabel';
            blocklyHiddenSearchLabel.setAttribute('aria-live', "polite");

            blocklySearchInput.appendChild(blocklySearchInputField);
            blocklySearchInput.appendChild(blocklySearchInputIcon);
            blocklySearchInput.appendChild(blocklyHiddenSearchLabel);
            blocklySearchArea.appendChild(blocklySearchInput);
            const toolboxDiv = document.getElementsByClassName('blocklyToolboxDiv')[0];
            if (toolboxDiv) // Only add if a toolbox exists, eg not in sandbox mode
                toolboxDiv.insertBefore(blocklySearchArea, toolboxDiv.firstChild);
        }

        const hasSearchFlyout = () => {
            return document.getElementsByClassName('blocklyTreeIconsearch').length > 0;
        }

        const showSearchFlyout = () => {
            const tree = (workspace as any).toolbox_.tree_;
            // Show the search flyout
            tree.setSelectedItem(tree.getChildren()[0]);
        }

        pxt.blocks.cachedSearchTb = tb;
        pxt.blocks.cachedSearchTbAll = tbAll;
        let previousSearchTerm = '';
        const searchChangeHandler = Util.debounce(() => {
            let searchField = document.getElementById('blocklySearchInputField') as HTMLInputElement;
            let searchFor = searchField.value.toLowerCase();
            let blocklyHiddenSearchLabel = document.getElementById('blocklySearchLabel') as HTMLElement;

            blocklyHiddenSearchLabel.innerText = "";

            if (searchFor != '') {
                blocklySearchInput.className += ' loading';
                previousSearchTerm = searchFor;

                pxt.tickEvent("blocks.search");
                let searchTb = pxt.blocks.cachedSearchTb ? <Element>pxt.blocks.cachedSearchTb.cloneNode(true) : undefined;

                let catName = 'Search';
                let category = categoryElement(searchTb, catName);

                if (!category) {
                    let categories = getChildCategories(searchTb)
                    let parentCategoryList = searchTb;

                    const nsWeight = 101; // Show search category on top
                    category = createCategoryElement(lf("{id:category}Search"), catName, nsWeight);
                    category.setAttribute("colour", '#000');
                    category.setAttribute("iconclass", 'blocklyTreeIconsearch');
                    category.setAttribute("expandedclass", 'blocklyTreeIconsearch');

                    // Insert the category based on weight
                    let ci = 0;
                    for (ci = 0; ci < categories.length; ++ci) {
                        let cat = categories[ci];
                        if (parseInt(cat.getAttribute("weight") || "50") < nsWeight) {
                            parentCategoryList.insertBefore(category, cat);
                            break;
                        }
                    }
                    if (ci == categories.length)
                        parentCategoryList.appendChild(category);
                }

                searchAsync({ term: searchFor, subset: updateUsedBlocks ? usedBlocks : undefined }).then(blocks => {
                    pxt.log("searching for: " + searchFor);
                    updateUsedBlocks = false;
                    if (!blocks) return;

                    if (blocks.length == 0) {
                        blocklyHiddenSearchLabel.innerText = lf("No search results...");
                    } else {
                        blocklyHiddenSearchLabel.innerText = lf("{0} result matching '{1}'", blocks.length, blocklySearchInputField.value.toLowerCase());
                    }

                    if (blocks.length == 0) {
                        let label = goog.dom.createDom('label');
                        label.setAttribute('text', lf("No search results..."));
                        category.appendChild(label);
                        return;
                    }
                    blocks.forEach(info => {
                        if (pxt.blocks.cachedSearchTbAll) {
                            const type = info.id;

                            let block = searchElementCache[type];
                            if (!block) {
                                // Catches built-in blocks that aren't loaded dynamically
                                const existing = getFirstChildWithAttr(pxt.blocks.cachedSearchTbAll, "block", "type", type);
                                if (existing) {
                                    block = (searchElementCache[type] = existing.cloneNode(true));
                                }
                            }

                            if (block) {
                                category.appendChild(block);
                            }
                        }
                    })
                }).finally(() => {
                    if (tb) {
                        updateToolbox(searchTb);
                        blocklySearchInput.className = origClassName;
                        showSearchFlyout();
                    }
                })
            } else if (previousSearchTerm != '') {
                // Clearing search
                updateToolbox(pxt.blocks.cachedSearchTb);
                blocklySearchInput.className = origClassName;
            }
            // Search
        }, 300, false);

        blocklySearchInputField.oninput = searchChangeHandler;
        blocklySearchInputField.onfocus = () => {
            blocklySearchInputField.select();
            let searchFor = blocklySearchInputField.value.toLowerCase();
            if (searchFor != '') {
                if (hasSearchFlyout()) showSearchFlyout();
                else {
                    previousSearchTerm = '';
                    searchChangeHandler();
                }
            }
        }
        if (pxt.BrowserUtils.isTouchEnabled()) {
            blocklySearchInputField.ontouchstart = () => {
                blocklySearchInputField.focus();
            };
        }

        // Override Blockly's toolbox keydown method to intercept characters typed and move the focus to the search input
        (Blockly as any).Toolbox.TreeNode.prototype.onKeyDown = function(e: any) {
            const keyCode = e.which || e.keyCode;
            const characterKey = (keyCode > 64 && keyCode < 91); // Letter keys
            const spaceEnterKey = keyCode == 32 || keyCode == 13; // Spacebar or Enter keys
            if (characterKey) {
                let searchField = document.getElementById('blocklySearchInputField') as HTMLInputElement;

                let char = String.fromCharCode(keyCode);
                searchField.value = searchField.value + char;
                searchField.focus();
                return true;
            } else {
                if (this.getTree() && this.getTree().toolbox_.horizontalLayout_) {
                    let map: {[keyCode: number]: number} = {};
                    let next = goog.events.KeyCodes.DOWN
                    let prev = goog.events.KeyCodes.UP
                    map[goog.events.KeyCodes.RIGHT] = this.rightToLeft_ ? prev : next;
                    map[goog.events.KeyCodes.LEFT] = this.rightToLeft_ ? next : prev;
                    map[goog.events.KeyCodes.UP] = goog.events.KeyCodes.LEFT;
                    map[goog.events.KeyCodes.DOWN] = goog.events.KeyCodes.RIGHT;

                    let newKeyCode = map[e.keyCode];
                    e.keyCode = newKeyCode || e.keyCode;
                }
                return (Blockly.Toolbox.TreeNode as any).superClass_.onKeyDown.call(this, e);
            }
        }
    }

    export function removeSearch() {
        let blocklySearchArea = document.getElementById('blocklySearchArea') as HTMLInputElement;

        if (blocklySearchArea) {
            blocklySearchArea.parentNode.removeChild(blocklySearchArea);
        }
    }

    function categoryElement(tb: Element, nameid: string): Element {
        return tb ? getFirstChildWithAttr(tb, "category", "nameid", nameid.toLowerCase()) : undefined;
    }

    export function cleanBlocks() {
        pxt.debug('removing all custom blocks')
        for (let b in cachedBlocks)
            removeBlock(cachedBlocks[b].fn);
    }

    function removeBlock(fn: pxtc.SymbolInfo) {
        delete Blockly.Blocks[fn.attributes.blockId];
        delete cachedBlocks[fn.attributes.blockId];
    }

    let blocklyInitialized = false;
    function init() {
        if (blocklyInitialized) return;
        blocklyInitialized = true;

        goog.provide('Blockly.Blocks.device');
        goog.require('Blockly.Blocks');

        if ((window as any).PointerEvent) {
            (Blockly.bindEvent_ as any).TOUCH_MAP = {
                mousedown: 'pointerdown',
                mousemove: 'pointermove',
                mouseup: 'pointerup'
            };
            document.body.style.touchAction = 'none';
        }

        Blockly.FieldCheckbox.CHECK_CHAR = '■';
        Blockly.BlockSvg.START_HAT = !!pxt.appTarget.appTheme.blockHats;

        initFieldEditors();
        initContextMenu();
        initOnStart();
        initMath();
        initVariables();
        initFunctions();
        initLists();
        initLoops();
        initLogic();
        initText();
        initDrag();
    }

    function setBuiltinHelpInfo(block: any, id: string) {
        const info = pxt.blocks.getBlockDefinition(id);
        setHelpResources(block, id, info.name, info.tooltip, info.url, getNamespaceColor(info.category));
    }

    function installBuiltinHelpInfo(id: string) {
        const info = pxt.blocks.getBlockDefinition(id);
        installHelpResources(id, info.name, info.tooltip, info.url, getNamespaceColor(info.category));
    }

    function setHelpResources(block: any, id: string, name: string, tooltip: any, url: string, colour: string, colourSecondary?: string, colourTertiary?: string, undeletable?: boolean) {
        if (tooltip && (typeof tooltip === "string" || typeof tooltip === "function")) block.setTooltip(tooltip);
        if (url) block.setHelpUrl(url);
        if (colour) block.setColour(colour, colourSecondary, colourTertiary);
        if (undeletable) block.setDeletable(false);

        let tb = document.getElementById('blocklyToolboxDefinition');
        let xml: HTMLElement = tb ? getFirstChildWithAttr(tb, "block", "type", id) as HTMLElement : undefined;
        block.codeCard = <pxt.CodeCard>{
            header: name,
            name: name,
            software: 1,
            description: goog.isFunction(tooltip) ? tooltip(block) : tooltip,
            blocksXml: xml ? (`<xml xmlns="http://www.w3.org/1999/xhtml">` + (cleanOuterHTML(xml) || `<block type="${id}"></block>`) + "</xml>") : undefined,
            url: url
        };
    }

    function installHelpResources(id: string, name: string, tooltip: any, url: string, colour: string, colourSecondary?: string, colourTertiary?: string) {
        let block = Blockly.Blocks[id];
        let old = block.init;
        if (!old) return;

        block.init = function () {
            old.call(this);
            let block = this;
            setHelpResources(this, id, name, tooltip, url, colour, colourSecondary, colourTertiary);
        }
    }

    export let openHelpUrl: (url: string) => void;

    function initLists() {
        const msg: any = Blockly.Msg;

        // lists_create_with
        const listsCreateWithId = "lists_create_with";
        const listsCreateWithDef = pxt.blocks.getBlockDefinition(listsCreateWithId);
        msg.LISTS_CREATE_EMPTY_TITLE = listsCreateWithDef.block["LISTS_CREATE_EMPTY_TITLE"];
        msg.LISTS_CREATE_WITH_INPUT_WITH = listsCreateWithDef.block["LISTS_CREATE_WITH_INPUT_WITH"];
        msg.LISTS_CREATE_WITH_CONTAINER_TITLE_ADD = listsCreateWithDef.block["LISTS_CREATE_WITH_CONTAINER_TITLE_ADD"];
        msg.LISTS_CREATE_WITH_ITEM_TITLE = listsCreateWithDef.block["LISTS_CREATE_WITH_ITEM_TITLE"];
        installBuiltinHelpInfo(listsCreateWithId);

        // lists_length
        const listsLengthId = "lists_length";
        const listsLengthDef = pxt.blocks.getBlockDefinition(listsLengthId);
        msg.LISTS_LENGTH_TITLE = listsLengthDef.block["LISTS_LENGTH_TITLE"];

        // We have to override this block definition because the builtin block
        // allows both Strings and Arrays in its input check and that confuses
        // our Blockly compiler
        let block = Blockly.Blocks[listsLengthId];
        block.init = function() {
            this.jsonInit({
            "message0": msg.LISTS_LENGTH_TITLE,
            "args0": [
                {
                "type": "input_value",
                "name": "VALUE",
                "check": ['Array']
                }
            ],
            "output": 'Number',
            "outputShape": Blockly.OUTPUT_SHAPE_ROUND
            });
        }

        installBuiltinHelpInfo(listsLengthId);
    }

    function initLoops() {
        const msg: any = Blockly.Msg;

        // controls_repeat_ext
        const controlsRepeatExtId = "controls_repeat_ext";
        const controlsRepeatExtDef = pxt.blocks.getBlockDefinition(controlsRepeatExtId);
        msg.CONTROLS_REPEAT_TITLE = controlsRepeatExtDef.block["CONTROLS_REPEAT_TITLE"];
        msg.CONTROLS_REPEAT_INPUT_DO = controlsRepeatExtDef.block["CONTROLS_REPEAT_INPUT_DO"];
        installBuiltinHelpInfo(controlsRepeatExtId);

        // device_while
        const deviceWhileId = "device_while";
        const deviceWhileDef = pxt.blocks.getBlockDefinition(deviceWhileId);
        Blockly.Blocks[deviceWhileId] = {
            init: function () {
                this.jsonInit({
                    "message0": deviceWhileDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "COND",
                            "check": "Boolean"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": getNamespaceColor('loops')
                });
                this.appendStatementInput("DO")
                    .appendField(deviceWhileDef.block["appendField"]);

                setBuiltinHelpInfo(this, deviceWhileId);
            }
        };

        // controls_simple_for
        const controlsSimpleForId = "controls_simple_for";
        const controlsSimpleForDef = pxt.blocks.getBlockDefinition(controlsSimpleForId);
        Blockly.Blocks[controlsSimpleForId] = {
            /**
             * Block for 'for' loop.
             * @this Blockly.Block
             */
            init: function () {
                this.jsonInit({
                    "message0": controlsSimpleForDef.block["message0"],
                    "args0": [
                        {
                            "type": "field_variable",
                            "name": "VAR",
                            "variable": controlsSimpleForDef.block["variable"]
                            // Please note that most multilingual characters
                            // cannot be used as variable name at this point.
                            // Translate or decide the default variable name
                            // with care.
                        },
                        {
                            "type": "input_value",
                            "name": "TO",
                            "check": "Number"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": getNamespaceColor('loops'),
                    "inputsInline": true
                });
                this.appendStatementInput('DO')
                    .appendField(controlsSimpleForDef.block["appendField"]);

                let thisBlock = this;
                setHelpResources(this,
                    controlsSimpleForId,
                    controlsSimpleForDef.name,
                    function () {
                        return U.rlf(<string>controlsSimpleForDef.tooltip, thisBlock.getFieldValue('VAR'));
                    },
                    controlsSimpleForDef.url,
                    String(getNamespaceColor('loops'))
                );
            },
            /**
             * Return all variables referenced by this block.
             * @return {!Array.<string>} List of variable names.
             * @this Blockly.Block
             */
            getVars: function (): any[] {
                return [this.getFieldValue('VAR')];
            },
            /**
             * Notification that a variable is renaming.
             * If the name matches one of this block's variables, rename it.
             * @param {string} oldName Previous name of variable.
             * @param {string} newName Renamed variable.
             * @this Blockly.Block
             */
            renameVar: function (oldName: string, newName: string) {
                if (Blockly.Names.equals(oldName, this.getFieldValue('VAR'))) {
                    this.setFieldValue(newName, 'VAR');
                }
            },
            /**
             * Add menu option to create getter block for loop variable.
             * @param {!Array} options List of menu options to add to.
             * @this Blockly.Block
             */
            customContextMenu: function (options: any[]) {
                if (!this.isCollapsed()) {
                    let option: any = { enabled: true };
                    let name = this.getFieldValue('VAR');
                    option.text = lf("Create 'get {0}'", name);
                    let xmlField = goog.dom.createDom('field', null, name);
                    xmlField.setAttribute('name', 'VAR');
                    let xmlBlock = goog.dom.createDom('block', null, xmlField) as HTMLElement;
                    xmlBlock.setAttribute('type', 'variables_get');
                    option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
                    options.push(option);
                }
            }
        };
    }

    export var onShowContextMenu: (workspace: Blockly.Workspace,
        items: Blockly.ContextMenu.MenuItem[]) => void = undefined;

    /**
     * The following patch to blockly is to add the Trash icon on top of the toolbox,
     * the trash icon should only show when a user drags a block that is already in the workspace.
     */
    function initDrag() {
        const calculateDistance = (elemBounds: any, mouseX: any) => {
            return Math.floor(mouseX - (elemBounds.left + (elemBounds.width / 2)));
        }

        /**
         * Execute a step of block dragging, based on the given event.  Update the
         * display accordingly.
         * @param {!Event} e The most recent move event.
         * @param {!goog.math.Coordinate} currentDragDeltaXY How far the pointer has
         *     moved from the position at the start of the drag, in pixel units.
         * @package
         */
        const blockDrag = (<any>Blockly).BlockDragger.prototype.dragBlock;
        (<any>Blockly).BlockDragger.prototype.dragBlock = function (e: any, currentDragDeltaXY: any) {
            const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolboxDiv')[0] as HTMLElement;
            const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement;
            const trashIcon = document.getElementById("blocklyTrashIcon");
            if (blocklyTreeRoot && trashIcon) {
                const distance = calculateDistance(blocklyTreeRoot.getBoundingClientRect(), e.clientX);
                if (distance < 200) {
                    const opacity = distance / 200;
                    trashIcon.style.opacity = `${1 - opacity}`;
                    trashIcon.style.display = 'block';
                    blocklyTreeRoot.style.opacity = `${opacity}`;
                    if (distance < 50) {
                        blocklyToolboxDiv.classList.add('blocklyToolboxDeleting');
                    }
                } else {
                    trashIcon.style.display = 'none';
                    blocklyTreeRoot.style.opacity = '1';
                    blocklyToolboxDiv.classList.remove('blocklyToolboxDeleting');
                }
            }
            return blockDrag.call(this, e, currentDragDeltaXY);
        };

        /**
         * Finish dragging the workspace and put everything back where it belongs.
         * @param {!goog.math.Coordinate} currentDragDeltaXY How far the pointer has
         *     moved from the position at the start of the drag, in pixel coordinates.
         * @package
         */
        const blockEndDrag = (<any>Blockly).BlockDragger.prototype.endBlockDrag;
        (<any>Blockly).BlockDragger.prototype.endBlockDrag = function (e: any, currentDragDeltaXY: any) {
            blockEndDrag.call(this, e, currentDragDeltaXY);
            const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolboxDiv')[0] as HTMLElement;
            const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement;
            const trashIcon = document.getElementById("blocklyTrashIcon");
            if (trashIcon) {
                trashIcon.style.display = 'none';
                blocklyTreeRoot.style.opacity = '1';
                blocklyToolboxDiv.classList.remove('blocklyToolboxDeleting');
            }
        }
    }

    function initContextMenu() {
        // Translate the context menu for blocks.
        let msg: any = Blockly.Msg;
        msg.DUPLICATE_BLOCK = lf("{id:block}Duplicate");
        msg.REMOVE_COMMENT = lf("Remove Comment");
        msg.ADD_COMMENT = lf("Add Comment");
        msg.EXTERNAL_INPUTS = lf("External Inputs");
        msg.INLINE_INPUTS = lf("Inline Inputs");
        msg.EXPAND_BLOCK = lf("Expand Block");
        msg.COLLAPSE_BLOCK = lf("Collapse Block");
        msg.ENABLE_BLOCK = lf("Enable Block");
        msg.DISABLE_BLOCK = lf("Disable Block");
        msg.DELETE_BLOCK = lf("Delete Block");
        msg.DELETE_X_BLOCKS = lf("Delete All Blocks");
        msg.HELP = lf("Help");

        // inject hook to handle openings docs
        (<any>Blockly).BlockSvg.prototype.showHelp_ = function () {
            const url = goog.isFunction(this.helpUrl) ? this.helpUrl() : this.helpUrl;
            if (url) (pxt.blocks.openHelpUrl || window.open)(url);
        };

        /**
         * Show the context menu for the workspace.
         * @param {!Event} e Mouse event.
         * @private
         */
        (<any>Blockly).WorkspaceSvg.prototype.showContextMenu_ = function (e: any) {
            if (this.options.readOnly || this.isFlyout) {
                return;
            }
            let menuOptions: Blockly.ContextMenu.MenuItem[] = [];
            let topBlocks = this.getTopBlocks(true);
            let eventGroup = Blockly.utils.genUid();

            // Add a little animation to collapsing and expanding.
            const DELAY = 10;
            if (this.options.collapse) {
                let hasCollapsedBlocks = false;
                let hasExpandedBlocks = false;
                for (let i = 0; i < topBlocks.length; i++) {
                    let block = topBlocks[i];
                    while (block) {
                        if (block.isCollapsed()) {
                            hasCollapsedBlocks = true;
                        } else {
                            hasExpandedBlocks = true;
                        }
                        block = block.getNextBlock();
                    }
                }

                /**
                 * Option to collapse or expand top blocks.
                 * @param {boolean} shouldCollapse Whether a block should collapse.
                 * @private
                 */
                const toggleOption = function (shouldCollapse: boolean) {
                    let ms = 0;
                    for (let i = 0; i < topBlocks.length; i++) {
                        let block = topBlocks[i];
                        while (block) {
                            setTimeout(block.setCollapsed.bind(block, shouldCollapse), ms);
                            block = block.getNextBlock();
                            ms += DELAY;
                        }
                    }
                };

                // Option to collapse top blocks.
                const collapseOption: any = { enabled: hasExpandedBlocks };
                collapseOption.text = lf("Collapse Block");
                collapseOption.callback = function () {
                    pxt.tickEvent("blocks.context.collapse")
                    toggleOption(true);
                };
                menuOptions.push(collapseOption);

                // Option to expand top blocks.
                const expandOption: any = { enabled: hasCollapsedBlocks };
                expandOption.text = lf("Expand Block");
                expandOption.callback = function () {
                    pxt.tickEvent("blocks.context.expand")
                    toggleOption(false);
                };
                menuOptions.push(expandOption);
            }

            // Option to delete all blocks.
            // Count the number of blocks that are deletable.
            let deleteList: any[] = [];
            function addDeletableBlocks(block: any) {
                if (block.isDeletable()) {
                    deleteList = deleteList.concat(block.getDescendants());
                } else {
                    let children = block.getChildren();
                    for (let i = 0; i < children.length; i++) {
                        addDeletableBlocks(children[i]);
                    }
                }
            }
            for (let i = 0; i < topBlocks.length; i++) {
                addDeletableBlocks(topBlocks[i]);
            }

            function deleteNext() {
                (<any>Blockly).Events.setGroup(eventGroup);
                let block = deleteList.shift();
                if (block) {
                    if (block.workspace) {
                        block.dispose(false, true);
                        setTimeout(deleteNext, DELAY);
                    } else {
                        deleteNext();
                    }
                }
                Blockly.Events.setGroup(false);
            }

            const deleteOption = {
                text: deleteList.length == 1 ? lf("Delete Block") :
                    lf("Delete All Blocks", deleteList.length),
                enabled: deleteList.length > 0,
                callback: function () {
                    pxt.tickEvent("blocks.context.delete");
                    if (deleteList.length < 2 ||
                        window.confirm(lf("Delete all {0} blocks?", deleteList.length))) {
                        deleteNext();
                    }
                }
            };
            menuOptions.push(deleteOption);

            const formatCodeOption = {
                text: lf("Format Code"),
                enabled: true,
                callback: () => {
                    pxt.tickEvent("blocks.context.format");
                    pxt.blocks.layout.flow(this, { useViewWidth: true });
                }
            }
            menuOptions.push(formatCodeOption);

            if (pxt.blocks.layout.screenshotEnabled()) {
                const screenshotOption = {
                    text: lf("Download Screenshot"),
                    enabled: topBlocks.length > 0,
                    callback: () => {
                        pxt.tickEvent("blocks.context.screenshot");
                        pxt.blocks.layout.screenshotAsync(this)
                            .done((uri) => {
                                if (pxt.BrowserUtils.isSafari())
                                    uri = uri.replace(/^data:image\/[^;]/, 'data:application/octet-stream');
                                BrowserUtils.browserDownloadDataUri(
                                    uri,
                                    `${pxt.appTarget.nickname || pxt.appTarget.id}-${lf("screenshot")}.png`);
                            });
                    }
                };
                menuOptions.push(screenshotOption);
            }

            // custom options...
            if (onShowContextMenu)
                onShowContextMenu(this, menuOptions);

            Blockly.ContextMenu.show(e, menuOptions, this.RTL);
        };

        // We override Blockly's category mouse event handler so that only one
        // category can be expanded at a time. Also prevent categories from toggling
        // once openend.
        Blockly.Toolbox.TreeNode.prototype.onMouseDown = function (a: Event) {
            // Expand icon.
            const that = <Blockly.Toolbox.TreeNode>this;

            if (!that.isSelected()) {
                // Collapse the currently selected node and its parent nodes
                collapseSubcategories(that.getTree().getSelectedItem(), that);
            }

            if (that.hasChildren() && that.isUserCollapsible_) {
                if (that.isSelected()) {
                    collapseSubcategories(that.getTree().getSelectedItem(), that);
                    that.getTree().setSelectedItem(null);
                } else {
                    that.setExpanded(true);
                    that.select();
                }
            } else if (that.isSelected()) {
                that.getTree().setSelectedItem(null);
            } else {
                that.select();
            }

            that.updateRow()
        }

        // We also must override this handler to handle the case where no category is selected (e.g. clicking outside the toolbox)
        const oldSetSelectedItem = Blockly.Toolbox.TreeControl.prototype.setSelectedItem;
        let editor = this;
        Blockly.Toolbox.TreeControl.prototype.setSelectedItem = function (a: Blockly.Toolbox.TreeNode) {
            const that = <Blockly.Toolbox.TreeControl>this;
            let toolbox = (that as any).toolbox_;
            if (a == that.selectedItem_ || a == toolbox.tree_) {
                return;
            }

            if (a === null) {
                collapseSubcategories(that.selectedItem_);
                editor.lastInvertedCategory = that.selectedItem_;
            }

            oldSetSelectedItem.call(that, a);
        };

        // TODO: look into porting this code over to pxt-blockly
        // Fix highlighting bug in edge
        (<any>Blockly).Flyout.prototype.addBlockListeners_ = function (root: any, block: any, rect: any) {
            this.listeners_.push(Blockly.bindEventWithChecks_(root, 'mousedown', null,
                this.blockMouseDown_(block)));
            this.listeners_.push(Blockly.bindEventWithChecks_(rect, 'mousedown', null,
                this.blockMouseDown_(block)));
            this.listeners_.push(Blockly.bindEvent_(root, 'mouseover', block,
                block.addSelect));
            this.listeners_.push(Blockly.bindEvent_(root, 'mouseout', block,
                block.removeSelect));
            this.listeners_.push(Blockly.bindEvent_(rect, 'mouseover', block,
                block.addSelect));
            this.listeners_.push(Blockly.bindEvent_(rect, 'mouseout', block,
                block.removeSelect));

            const that = this;
            function select() {
                if (that._selectedItem && that._selectedItem.svgGroup_) {
                    that._selectedItem.removeSelect();
                }
                that._selectedItem = block;
                that._selectedItem.addSelect();
            }
        };
    }

    function collapseSubcategories(cat: Blockly.Toolbox.TreeNode, child?: Blockly.Toolbox.TreeNode) {
        while (cat) {
            if (cat.isUserCollapsible_ && cat.getTree() && cat != child && (!child || !isChild(child, cat))) {
                cat.setExpanded(false);
                cat.updateRow();
            }
            cat = cat.getParent();
        }
    }

    function isChild(child: Blockly.Toolbox.TreeNode, parent: Blockly.Toolbox.TreeNode): boolean {
        const myParent = child.getParent();
        if (myParent) {
            return myParent === parent || isChild(myParent, parent);
        }
        return false;
    }

    function initOnStart() {
        // on_start
        const onStartDef = pxt.blocks.getBlockDefinition(ts.pxtc.ON_START_TYPE);
        Blockly.Blocks[ts.pxtc.ON_START_TYPE] = {
            init: function () {
                this.jsonInit({
                    "message0": onStartDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_dummy"
                        },
                        {
                            "type": "input_statement",
                            "name": "HANDLER"
                        }
                    ],
                    "colour": (pxt.appTarget.runtime ? pxt.appTarget.runtime.onStartColor : '') || getNamespaceColor('loops')
                });

                setHelpResources(this,
                    ts.pxtc.ON_START_TYPE,
                    onStartDef.name,
                    onStartDef.tooltip,
                    onStartDef.url,
                    String((pxt.appTarget.runtime ? pxt.appTarget.runtime.onStartColor : '') || getNamespaceColor('loops')),
                    undefined, undefined,
                    pxt.appTarget.runtime ? pxt.appTarget.runtime.onStartUnDeletable : false
                );
            }
        };

        Blockly.Blocks[pxtc.TS_STATEMENT_TYPE] = {
            init: function () {
                let that: Blockly.Block = this;
                that.setColour("#717171")
                that.setPreviousStatement(true);
                that.setNextStatement(true);

                this.domToMutation = (element: Element) => {
                    const n = parseInt(element.getAttribute("numlines"));
                    this.declaredVariables = element.getAttribute("declaredvars");
                    for (let i = 0; i < n; i++) {
                        const line = element.getAttribute("line" + i);
                        that.appendDummyInput().appendField(line, "LINE" + i);
                    }
                };

                this.mutationToDom = () => {
                    let mutation = document.createElement("mutation");
                    let i = 0;

                    while (true) {
                        const val = that.getFieldValue("LINE" + i);
                        if (val === null) {
                            break;
                        }

                        mutation.setAttribute("line" + i, val);
                        i++;
                    }

                    mutation.setAttribute("numlines", i.toString());
                    if (this.declaredVariables) {
                        mutation.setAttribute("declaredvars", this.declaredVariables);
                    }

                    return mutation;
                };

                that.setEditable(false);

                setHelpResources(this,
                    pxtc.TS_STATEMENT_TYPE,
                    lf("JavaScript statement"),
                    lf("A JavaScript statement that could not be converted to blocks"),
                    '/blocks/javascript-blocks',
                    '#717171'
                );
            }
        };

        Blockly.Blocks[pxtc.TS_OUTPUT_TYPE] = {
            init: function () {
                this.jsonInit({
                    "colour": "#717171",
                    "message0": "%1",
                    "args0": [
                        {
                            "type": "field_input",
                            "name": "EXPRESSION",
                            "text": ""
                        }
                    ]
                });
                this.setPreviousStatement(false);
                this.setNextStatement(false);
                this.setOutput(true);
                this.setEditable(false);

                setHelpResources(this,
                    pxtc.TS_OUTPUT_TYPE,
                    lf("JavaScript expression"),
                    lf("A JavaScript expression that could not be converted to blocks"),
                    '/blocks/javascript-blocks',
                    "#717171"
                );
            }
        };

        // controls_for_of
        const controlsForOfId = "controls_for_of";
        const controlsForOfDef = pxt.blocks.getBlockDefinition(controlsForOfId);
        Blockly.Blocks[controlsForOfId] = {
            init: function () {
                this.jsonInit({
                    "message0": controlsForOfDef.block["message0"],
                    "args0": [
                        {
                            "type": "field_variable",
                            "name": "VAR",
                            "variable": controlsForOfDef.block["variable"]
                            // Please note that most multilingual characters
                            // cannot be used as variable name at this point.
                            // Translate or decide the default variable name
                            // with care.
                        },
                        {
                            "type": "input_value",
                            "name": "LIST",
                            "check": "Array"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": blockColors['loops'],
                    "inputsInline": true
                });

                this.appendStatementInput('DO')
                    .appendField(controlsForOfDef.block["appendField"]);

                let thisBlock = this;
                setHelpResources(this,
                    controlsForOfId,
                    controlsForOfDef.name,
                    function () {
                        return U.rlf(<string>controlsForOfDef.tooltip, thisBlock.getFieldValue('VAR'));
                    },
                    controlsForOfDef.url,
                    String(getNamespaceColor('loops'))
                );
            }
        };

        // lists_index_get
        const listsIndexGetId = "lists_index_get";
        const listsIndexGetDef = pxt.blocks.getBlockDefinition(listsIndexGetId);
        Blockly.Blocks["lists_index_get"] = {
            init: function () {
                this.jsonInit({
                    "message0": listsIndexGetDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "LIST",
                            "check": "Array"
                        },
                        {
                            "type": "input_value",
                            "name": "INDEX",
                            "check": "Number"
                        }
                    ],
                    "colour": blockColors['arrays'],
                    "inputsInline": true
                });

                this.setPreviousStatement(false);
                this.setNextStatement(false);
                this.setOutput(true);
                setBuiltinHelpInfo(this, listsIndexGetId);
            }
        };

        // lists_index_set
        const listsIndexSetId = "lists_index_set";
        const listsIndexSetDef = pxt.blocks.getBlockDefinition(listsIndexSetId);
        Blockly.Blocks[listsIndexSetId] = {
            init: function () {
                this.jsonInit({
                    "message0": listsIndexSetDef.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "LIST",
                            "check": "Array"
                        },
                        {
                            "type": "input_value",
                            "name": "INDEX",
                            "check": "Number"
                        },
                        {
                            "type": "input_value",
                            "name": "VALUE",
                            "check": null
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": blockColors['arrays'],
                    "inputsInline": true
                });
                setBuiltinHelpInfo(this, listsIndexSetId);
            }
        };
    }

    function initMath() {
        // math_op2
        const mathOp2Id = "math_op2";
        const mathOp2Def = pxt.blocks.getBlockDefinition(mathOp2Id);
        const mathOp2Tooltips = <Map<string>>mathOp2Def.tooltip;
        Blockly.Blocks[mathOp2Id] = {
            init: function () {
                this.jsonInit({
                    "message0": lf("%1 of %2 and %3"),
                    "args0": [
                        {
                            "type": "field_dropdown",
                            "name": "op",
                            "options": [
                                [lf("{id:op}min"), "min"],
                                [lf("{id:op}max"), "max"]
                            ]
                        },
                        {
                            "type": "input_value",
                            "name": "x",
                            "check": "Number"
                        },
                        {
                            "type": "input_value",
                            "name": "y",
                            "check": "Number"
                        }
                    ],
                    "inputsInline": true,
                    "output": "Number",
                    "outputShape": mathOp2Def.outputShape,
                    "colour": getNamespaceColor('math')
                });

                let thisBlock = this;
                setHelpResources(this,
                    mathOp2Id,
                    mathOp2Def.name,
                    function (block: any) {
                        return mathOp2Tooltips[block.getFieldValue('op')];
                    },
                    mathOp2Def.url,
                    getNamespaceColor(mathOp2Def.category)
                );
            }
        };

        // math_op3
        const mathOp3Id = "math_op3";
        const mathOp3Def = pxt.blocks.getBlockDefinition(mathOp3Id);
        Blockly.Blocks[mathOp3Id] = {
            init: function () {
                this.jsonInit({
                    "message0": mathOp3Def.block["message0"],
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "x",
                            "check": "Number"
                        }
                    ],
                    "inputsInline": true,
                    "output": "Number",
                    "outputShape": mathOp3Def.outputShape,
                    "colour": getNamespaceColor('math')
                });

                setBuiltinHelpInfo(this, mathOp3Id);
            }
        };

        // builtin math_number
        //XXX Integer validation needed.
        const mInfo = pxt.blocks.getBlockDefinition("math_number");
        installHelpResources(
            'math_number',
            mInfo.name,
            (pxt.appTarget.compile && pxt.appTarget.compile.floatingPoint) ? lf("a decimal number") : lf("an integer number"),
            mInfo.url,
            (Blockly as any).Colours.textField,
            (Blockly as any).Colours.textField,
            (Blockly as any).Colours.textField
        );

        // builtin math_number_minmax
        //XXX Integer validation needed.
        const mMInfo = pxt.blocks.getBlockDefinition("math_number_minmax");
        installHelpResources(
            'math_number_minmax',
            mMInfo.name,
            (pxt.appTarget.compile && pxt.appTarget.compile.floatingPoint) ? lf("a decimal number") : lf("an integer number"),
            mMInfo.url,
            (Blockly as any).Colours.textField,
            (Blockly as any).Colours.textField,
            (Blockly as any).Colours.textField
        );

        // builtin math_arithmetic
        const msg: any = Blockly.Msg;
        const mathArithmeticId = "math_arithmetic";
        const mathArithmeticDef = pxt.blocks.getBlockDefinition(mathArithmeticId);
        const mathArithmeticTooltips = <Map<string>>mathArithmeticDef.tooltip;
        msg.MATH_ADDITION_SYMBOL = mathArithmeticDef.block["MATH_ADDITION_SYMBOL"];
        msg.MATH_SUBTRACTION_SYMBOL = mathArithmeticDef.block["MATH_SUBTRACTION_SYMBOL"];
        msg.MATH_MULTIPLICATION_SYMBOL = mathArithmeticDef.block["MATH_MULTIPLICATION_SYMBOL"];
        msg.MATH_DIVISION_SYMBOL = mathArithmeticDef.block["MATH_DIVISION_SYMBOL"];
        msg.MATH_POWER_SYMBOL = mathArithmeticDef.block["MATH_POWER_SYMBOL"];

        installHelpResources(
            mathArithmeticId,
            mathArithmeticDef.name,
            function (block: any) {
                return mathArithmeticTooltips[block.getFieldValue('OP')];
            },
            mathArithmeticDef.url,
            getNamespaceColor(mathArithmeticDef.category)
        );

        // builtin math_modulo
        const mathModuloId = "math_modulo";
        const mathModuloDef = pxt.blocks.getBlockDefinition(mathModuloId);
        msg.MATH_MODULO_TITLE = mathModuloDef.block["MATH_MODULO_TITLE"];
        installBuiltinHelpInfo(mathModuloId);
    }

    export function getNamespaceColor(ns: string): string {
        if (pxt.appTarget.appTheme.blockColors && pxt.appTarget.appTheme.blockColors[ns])
            return pxt.appTarget.appTheme.blockColors[ns] as string;
        if (blockColors[ns])
            return blockColors[ns] as string;
        return "";
    }

    export function initFlyouts(workspace: Blockly.Workspace) {
        workspace.registerToolboxCategoryCallback(Blockly.VARIABLE_CATEGORY_NAME, Blockly.Variables.flyoutCategory);
        workspace.registerToolboxCategoryCallback(Blockly.PROCEDURE_CATEGORY_NAME, Blockly.Procedures.flyoutCategory);
    }

    function initVariables() {
        let varname = lf("{id:var}item");
        Blockly.Variables.flyoutCategory = function(workspace) {
            let xmlList: HTMLElement[] = [];

            if (!pxt.appTarget.appTheme.hideFlyoutHeadings) {
                // Add the Heading label
                let headingLabel = goog.dom.createDom('label') as HTMLElement;
                headingLabel.setAttribute('text', lf("Variables"));
                headingLabel.setAttribute('web-class', 'blocklyFlyoutHeading');
                headingLabel.setAttribute('web-icon', '\uf039');
                headingLabel.setAttribute('web-icon-color', getNamespaceColor('variables'));
                xmlList.push(headingLabel);
            }

            let button = goog.dom.createDom('button') as HTMLElement;
            button.setAttribute('text', lf("Make a Variable"));
            button.setAttribute('callbackKey', 'CREATE_VARIABLE');

            workspace.registerButtonCallback('CREATE_VARIABLE', function(button) {
                Blockly.Variables.createVariable(button.getTargetWorkspace());
            });

            xmlList.push(button);

            let blockList = Blockly.Variables.flyoutCategoryBlocks(workspace);
            xmlList = xmlList.concat(blockList);
            return xmlList;
        };
        Blockly.Variables.flyoutCategoryBlocks = function(workspace) {
            let variableModelList = workspace.getVariablesOfType('');
            variableModelList.sort(Blockly.VariableModel.compareByName);
            // In addition to the user's variables, we also want to display the default
            // variable name at the top.  We also don't want this duplicated if the
            // user has created a variable of the same name.
            for (let i = 0, tempVar: any; tempVar = variableModelList[i]; i++) {
                if (tempVar.name == varname) {
                    variableModelList.splice(i, 1);
                    break;
                }
            }
            const defaultVar = new Blockly.VariableModel(workspace, varname);
            variableModelList.unshift(defaultVar);

            let xmlList: HTMLElement[] = [];
            if (variableModelList.length > 0) {
                // variables getters first
                for (let i = 0, variable: any; variable = variableModelList[i]; i++) {
                    if (Blockly.Blocks['variables_get']) {
                        let blockText = '<xml>' +
                            '<block type="variables_get" gap="8">' +
                            Blockly.Variables.generateVariableFieldXml_(variable) +
                            '</block>' +
                            '</xml>';
                        let block = Blockly.Xml.textToDom(blockText).firstChild as HTMLElement;
                        xmlList.push(block);
                    }
                }
                xmlList[xmlList.length - 1].setAttribute('gap', '24');

                let firstVariable = variableModelList[0];
                if (Blockly.Blocks['variables_set']) {
                    let gap = Blockly.Blocks['variables_change'] ? 8 : 24;
                    let blockText = '<xml>' +
                            '<block type="variables_set" gap="' + gap + '">' +
                            Blockly.Variables.generateVariableFieldXml_(firstVariable) +
                            '</block>' +
                            '</xml>';
                    let block = Blockly.Xml.textToDom(blockText).firstChild as HTMLElement;
                    {
                        let value = goog.dom.createDom('value');
                        value.setAttribute('name', 'VALUE');
                        let shadow = goog.dom.createDom('shadow');
                        shadow.setAttribute("type", "math_number");
                        value.appendChild(shadow);
                        let field = goog.dom.createDom('field');
                        field.setAttribute('name', 'NUM');
                        field.appendChild(document.createTextNode("0"));
                        shadow.appendChild(field);
                        block.appendChild(value);
                    }
                    xmlList.push(block);
                }
                if (Blockly.Blocks['variables_change']) {
                    let gap = Blockly.Blocks['variables_get'] ? 20 : 8;
                    let blockText = '<xml>' +
                        '<block type="variables_change" gap="' + gap + '">' +
                        Blockly.Variables.generateVariableFieldXml_(firstVariable) +
                        '<value name="DELTA">' +
                        '<shadow type="math_number">' +
                        '<field name="NUM">1</field>' +
                        '</shadow>' +
                        '</value>' +
                        '</block>' +
                        '</xml>';
                    let block = Blockly.Xml.textToDom(blockText).firstChild as HTMLElement;
                    {
                        let value = goog.dom.createDom('value');
                        value.setAttribute('name', 'VALUE');
                        let shadow = goog.dom.createDom('shadow');
                        shadow.setAttribute("type", "math_number");
                        value.appendChild(shadow);
                        let field = goog.dom.createDom('field');
                        field.setAttribute('name', 'NUM');
                        field.appendChild(document.createTextNode("1"));
                        shadow.appendChild(field);
                        block.appendChild(value);
                    }
                    xmlList.push(block);
                }
            }
            return xmlList;
        };

        // builtin variables_get
        const msg: any = Blockly.Msg;
        const variablesGetId = "variables_get";
        const variablesGetDef = pxt.blocks.getBlockDefinition(variablesGetId);
        msg.VARIABLES_GET_CREATE_SET = variablesGetDef.block["VARIABLES_GET_CREATE_SET"];
        installBuiltinHelpInfo(variablesGetId);

        // Dropdown menu of variables_get
        msg.RENAME_VARIABLE = lf("Rename variable...");
        msg.DELETE_VARIABLE = lf("Delete the \"%1\" variable");

        // builtin variables_set
        const variablesSetId = "variables_set";
        const variablesSetDef = pxt.blocks.getBlockDefinition(variablesSetId);
        msg.VARIABLES_SET = variablesSetDef.block["VARIABLES_SET"];
        msg.VARIABLES_DEFAULT_NAME = varname;
        msg.VARIABLES_SET_CREATE_GET = lf("Create 'get %1'");
        installBuiltinHelpInfo(variablesSetId);

        // pxt variables_change
        const variablesChangeId = "variables_change";
        const variablesChangeDef = pxt.blocks.getBlockDefinition(variablesChangeId);
        Blockly.Blocks[variablesChangeId] = {
            init: function () {
                this.jsonInit({
                    "message0": variablesChangeDef.block["message0"],
                    "args0": [
                        {
                            "type": "field_variable",
                            "name": "VAR",
                            "variable": varname
                        },
                        {
                            "type": "input_value",
                            "name": "VALUE",
                            "check": "Number"
                        }
                    ],
                    "inputsInline": true,
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": getNamespaceColor('variables')
                });

                setBuiltinHelpInfo(this, variablesChangeId);
            }
        };

        // New variable dialog
        msg.NEW_VARIABLE_TITLE = lf("New variable name:");
    }

    function initFunctions() {
        const msg: any = Blockly.Msg;

        // builtin procedures_defnoreturn
        const proceduresDefId = "procedures_defnoreturn";
        const proceduresDef = pxt.blocks.getBlockDefinition(proceduresDefId);

        msg.PROCEDURES_DEFNORETURN_TITLE = proceduresDef.block["PROCEDURES_DEFNORETURN_TITLE"];
        msg.PROCEDURE_ALREADY_EXISTS = proceduresDef.block["PROCEDURE_ALREADY_EXISTS"];

        Blockly.Blocks['procedures_defnoreturn'].init = function () {
            let nameField = new Blockly.FieldTextInput('',
                (Blockly as any).Procedures.rename);
            //nameField.setSpellcheck(false); //TODO
            this.appendDummyInput()
                .appendField((Blockly as any).Msg.PROCEDURES_DEFNORETURN_TITLE)
                .appendField(nameField, 'NAME')
                .appendField('', 'PARAMS');
            this.setColour(getNamespaceColor('functions'));
            this.arguments_ = [];
            this.setStartHat(true);
            this.setStatements_(true);
            this.statementConnection_ = null;
        };
        installBuiltinHelpInfo(proceduresDefId);

        // builtin procedures_defnoreturn
        const proceduresCallId = "procedures_callnoreturn";
        const proceduresCallDef = pxt.blocks.getBlockDefinition(proceduresCallId);

        msg.PROCEDURES_CALLRETURN_TOOLTIP = proceduresDef.tooltip;

        Blockly.Blocks['procedures_callnoreturn'] = {
            init: function () {
                let nameField = new pxtblockly.FieldProcedure('');
                nameField.setSourceBlock(this);
                this.appendDummyInput('TOPROW')
                    .appendField(proceduresCallDef.block['PROCEDURES_CALLNORETURN_TITLE'])
                    .appendField(nameField, 'NAME');
                this.setPreviousStatement(true);
                this.setNextStatement(true);
                this.setColour(getNamespaceColor('functions'));
                this.arguments_ = [];
                this.quarkConnections_ = {};
                this.quarkIds_ = null;
            },
            /**
             * Returns the name of the procedure this block calls.
             * @return {string} Procedure name.
             * @this Blockly.Block
             */
            getProcedureCall: function() {
                // The NAME field is guaranteed to exist, null will never be returned.
                return /** @type {string} */ (this.getFieldValue('NAME'));
            },
            /**
             * Notification that a procedure is renaming.
             * If the name matches this block's procedure, rename it.
             * @param {string} oldName Previous name of procedure.
             * @param {string} newName Renamed procedure.
             * @this Blockly.Block
             */
            renameProcedure: function(oldName: string, newName: string) {
                if (Blockly.Names.equals(oldName, this.getProcedureCall())) {
                    this.setFieldValue(newName, 'NAME');
                }
            },
            /**
             * Procedure calls cannot exist without the corresponding procedure
             * definition.  Enforce this link whenever an event is fired.
             * @param {!Blockly.Events.Abstract} event Change event.
             * @this Blockly.Block
             */
            onchange: function(event: any) {
                if (!this.workspace || this.workspace.isFlyout || this.isInsertionMarker()) {
                    // Block is deleted or is in a flyout or insertion marker.
                    return;
                }
                if (event.type == Blockly.Events.CREATE &&
                    event.ids.indexOf(this.id) != -1) {
                    // Look for the case where a procedure call was created (usually through
                    // paste) and there is no matching definition.  In this case, create
                    // an empty definition block with the correct signature.
                    let name = this.getProcedureCall();
                    let def = Blockly.Procedures.getDefinition(name, this.workspace);
                    if (def && (def.type != this.defType_ ||
                        JSON.stringify((def as any).arguments_) != JSON.stringify(this.arguments_))) {
                        // The signatures don't match.
                        def = null;
                    }
                    if (!def) {
                        Blockly.Events.setGroup(event.group);
                        /**
                         * Create matching definition block.
                         * <xml>
                         *   <block type="procedures_defreturn" x="10" y="20">
                         *     <field name="NAME">test</field>
                         *   </block>
                         * </xml>
                         */
                        let xml = goog.dom.createDom('xml');
                        let block = goog.dom.createDom('block');
                        block.setAttribute('type', this.defType_);
                        let xy = this.getRelativeToSurfaceXY();
                        let x = xy.x + (Blockly as any).SNAP_RADIUS * (this.RTL ? -1 : 1);
                        let y = xy.y + (Blockly as any).SNAP_RADIUS * 2;
                        block.setAttribute('x', x);
                        block.setAttribute('y', y);
                        let field = goog.dom.createDom('field');
                        field.setAttribute('name', 'NAME');
                        field.appendChild(document.createTextNode(this.getProcedureCall()));
                        block.appendChild(field);
                        xml.appendChild(block);
                        Blockly.Xml.domToWorkspace(xml, this.workspace);
                        Blockly.Events.setGroup(false);
                    }
                } else if (event.type == Blockly.Events.DELETE) {
                    // Look for the case where a procedure definition has been deleted,
                    // leaving this block (a procedure call) orphaned.  In this case, delete
                    // the orphan.
                    let name = this.getProcedureCall();
                    let def = Blockly.Procedures.getDefinition(name, this.workspace);
                    if (!def) {
                        Blockly.Events.setGroup(event.group);
                        this.dispose(true, false);
                        Blockly.Events.setGroup(false);
                    }
                }
            },
            mutationToDom: function() {
                const mutationElement = document.createElement("mutation");
                mutationElement.setAttribute("name", this.getProcedureCall());
                return mutationElement;
            },
            domToMutation: function(element: Element) {
                const name = element.getAttribute("name");
                this.renameProcedure(this.getProcedureCall(), name);
            },
            /**
             * Add menu option to find the definition block for this call.
             * @param {!Array} options List of menu options to add to.
             * @this Blockly.Block
             */
            customContextMenu: function(options: any) {
                let option: any = {enabled: true};
                option.text = (Blockly as any).Msg.PROCEDURES_HIGHLIGHT_DEF;
                let name = this.getProcedureCall();
                let workspace = this.workspace;
                option.callback = function() {
                let def = Blockly.Procedures.getDefinition(name, workspace);
                    def && def.select();
                };
                options.push(option);
            },
            defType_: 'procedures_defnoreturn'
        }
        installBuiltinHelpInfo(proceduresCallId);

        Blockly.Procedures.flyoutCategory = function (workspace: Blockly.Workspace) {
            let xmlList: HTMLElement[] = [];

            if (!pxt.appTarget.appTheme.hideFlyoutHeadings) {
                // Add the Heading label
                let headingLabel = goog.dom.createDom('label');
                headingLabel.setAttribute('text', lf("Functions"));
                headingLabel.setAttribute('web-class', 'blocklyFlyoutHeading');
                headingLabel.setAttribute('web-icon', '\uf107');
                headingLabel.setAttribute('web-icon-class', 'blocklyFlyoutIconfunctions');
                headingLabel.setAttribute('web-icon-color', getNamespaceColor('functions'));
                xmlList.push(headingLabel as HTMLElement);
            }

            const newFunction = lf("Make a Function");
            const newFunctionTitle = lf("New function name:");

            // Add the "Make a function" button
            let button = goog.dom.createDom('button');
            button.setAttribute('text', newFunction);
            button.setAttribute('callbackKey', 'CREATE_FUNCTION');

            let createFunction = (name: string) => {
                /**
                 * Create matching definition block.
                 * <xml>
                 *   <block type="procedures_defreturn" x="10" y="20">
                 *     <field name="NAME">test</field>
                 *   </block>
                 * </xml>
                 */
                let topBlock = workspace.getTopBlocks(true)[0];
                let x = 0, y = 0;
                if (topBlock) {
                    let xy = topBlock.getRelativeToSurfaceXY();
                    x = xy.x + (Blockly as any).SNAP_RADIUS * (topBlock.RTL ? -1 : 1);
                    y = xy.y + (Blockly as any).SNAP_RADIUS * 2;
                }
                let xml = goog.dom.createDom('xml');
                let block = goog.dom.createDom('block');
                block.setAttribute('type', 'procedures_defnoreturn');
                block.setAttribute('x', String(x));
                block.setAttribute('y', String(y));
                let field = goog.dom.createDom('field');
                field.setAttribute('name', 'NAME');
                field.appendChild(document.createTextNode(name));
                block.appendChild(field);
                xml.appendChild(block);
                let newBlockIds = Blockly.Xml.domToWorkspace(xml, workspace);
                // Close flyout and highlight block
                (workspace as any).toolbox_.clearSelection();
                let newBlock = workspace.getBlockById(newBlockIds[0]);
                newBlock.select();
            }

            workspace.registerButtonCallback('CREATE_FUNCTION', function(button) {
                let promptAndCheckWithAlert = (defaultName: string) => {
                    Blockly.prompt(newFunctionTitle, defaultName, function(newFunc) {
                        // Merge runs of whitespace.  Strip leading and trailing whitespace.
                        // Beyond this, all names are legal.
                        if (newFunc) {
                            newFunc = newFunc.replace(/[\s\xa0]+/g, ' ').replace(/^ | $/g, '');
                            if (newFunc == newFunction) {
                                // Ok, not ALL names are legal...
                                newFunc = null;
                            }
                        }
                        if (newFunc) {
                            if (workspace.getVariable(newFunc)) {
                                Blockly.alert((Blockly as any).Msg.VARIABLE_ALREADY_EXISTS.replace('%1',
                                    newFunc.toLowerCase()),
                                    function() {
                                        promptAndCheckWithAlert(newFunc);  // Recurse
                                    });
                            }
                            else if (!Blockly.Procedures.isLegalName_(newFunc, workspace)) {
                                Blockly.alert((Blockly as any).Msg.PROCEDURE_ALREADY_EXISTS.replace('%1',
                                    newFunc.toLowerCase()),
                                    function() {
                                        promptAndCheckWithAlert(newFunc);  // Recurse
                                    });
                            }
                            else {
                                createFunction(newFunc);
                            }
                        }
                    });
                };
                promptAndCheckWithAlert('doSomething');
            });
            xmlList.push(button as HTMLElement);

            function populateProcedures(procedureList: any, templateName: any) {
                for (let i = 0; i < procedureList.length; i++) {
                    let name = procedureList[i][0];
                    let args = procedureList[i][1];
                    // <block type="procedures_callnoreturn" gap="16">
                    //   <field name="NAME">name</field>
                    // </block>
                    let block = goog.dom.createDom('block');
                    block.setAttribute('type', templateName);
                    block.setAttribute('gap', '16');
                    block.setAttribute('colour', getNamespaceColor('functions'));
                    let field = goog.dom.createDom('field', null, name);
                    field.setAttribute('name', 'NAME');
                    block.appendChild(field);
                    xmlList.push(block as HTMLElement);
                }
            }

            let tuple = Blockly.Procedures.allProcedures(workspace);
            populateProcedures(tuple[0], 'procedures_callnoreturn');

            return xmlList;
        }
    }

    function initLogic() {
        const msg: any = Blockly.Msg;

        // builtin controls_if
        const controlsIfId = "controls_if";
        const controlsIfDef = pxt.blocks.getBlockDefinition(controlsIfId);
        const controlsIfTooltips = <Map<string>>controlsIfDef.tooltip;
        msg.CONTROLS_IF_MSG_IF = controlsIfDef.block["CONTROLS_IF_MSG_IF"];
        msg.CONTROLS_IF_MSG_THEN = controlsIfDef.block["CONTROLS_IF_MSG_THEN"];
        msg.CONTROLS_IF_MSG_ELSE = controlsIfDef.block["CONTROLS_IF_MSG_ELSE"];
        msg.CONTROLS_IF_MSG_ELSEIF = controlsIfDef.block["CONTROLS_IF_MSG_ELSEIF"];
        msg.CONTROLS_IF_TOOLTIP_1 = controlsIfTooltips["CONTROLS_IF_TOOLTIP_1"];
        msg.CONTROLS_IF_TOOLTIP_2 = controlsIfTooltips["CONTROLS_IF_TOOLTIP_2"];
        msg.CONTROLS_IF_TOOLTIP_3 = controlsIfTooltips["CONTROLS_IF_TOOLTIP_3"];
        msg.CONTROLS_IF_TOOLTIP_4 = controlsIfTooltips["CONTROLS_IF_TOOLTIP_4"];
        installBuiltinHelpInfo(controlsIfId);

        // builtin logic_compare
        const logicCompareId = "logic_compare";
        const logicCompareDef = pxt.blocks.getBlockDefinition(logicCompareId);
        const logicCompareTooltips = <Map<string>>logicCompareDef.tooltip;
        msg.LOGIC_COMPARE_TOOLTIP_EQ = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_EQ"];
        msg.LOGIC_COMPARE_TOOLTIP_NEQ = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_NEQ"];
        msg.LOGIC_COMPARE_TOOLTIP_LT = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_LT"];
        msg.LOGIC_COMPARE_TOOLTIP_LTE = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_LTE"];
        msg.LOGIC_COMPARE_TOOLTIP_GT = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_GT"];
        msg.LOGIC_COMPARE_TOOLTIP_GTE = logicCompareTooltips["LOGIC_COMPARE_TOOLTIP_GTE"];
        installBuiltinHelpInfo(logicCompareId);

        // builtin logic_operation
        const logicOperationId = "logic_operation";
        const logicOperationDef = pxt.blocks.getBlockDefinition(logicOperationId);
        const logicOperationTooltips = <Map<string>>logicOperationDef.tooltip;
        msg.LOGIC_OPERATION_AND = logicOperationDef.block["LOGIC_OPERATION_AND"];
        msg.LOGIC_OPERATION_OR = logicOperationDef.block["LOGIC_OPERATION_OR"];
        msg.LOGIC_OPERATION_TOOLTIP_AND = logicOperationTooltips["LOGIC_OPERATION_TOOLTIP_AND"];
        msg.LOGIC_OPERATION_TOOLTIP_OR = logicOperationTooltips["LOGIC_OPERATION_TOOLTIP_OR"];
        installBuiltinHelpInfo(logicOperationId);

        // builtin logic_negate
        const logicNegateId = "logic_negate";
        const logicNegateDef = pxt.blocks.getBlockDefinition(logicNegateId);
        msg.LOGIC_NEGATE_TITLE = logicNegateDef.block["LOGIC_NEGATE_TITLE"];
        installBuiltinHelpInfo(logicNegateId);

        // builtin logic_boolean
        const logicBooleanId = "logic_boolean";
        const logicBooleanDef = pxt.blocks.getBlockDefinition(logicBooleanId);
        msg.LOGIC_BOOLEAN_TRUE = logicBooleanDef.block["LOGIC_BOOLEAN_TRUE"];
        msg.LOGIC_BOOLEAN_FALSE = logicBooleanDef.block["LOGIC_BOOLEAN_FALSE"];
        installBuiltinHelpInfo(logicBooleanId);
    }

    function initText() {
        // builtin text
        const textInfo = pxt.blocks.getBlockDefinition('text');
        installHelpResources('text', textInfo.name, textInfo.tooltip, textInfo.url,
            (Blockly as any).Colours.textField,
            (Blockly as any).Colours.textField,
            (Blockly as any).Colours.textField);

        // builtin text_length
        const msg: any = Blockly.Msg;
        const textLengthId = "text_length";
        const textLengthDef = pxt.blocks.getBlockDefinition(textLengthId);
        msg.TEXT_LENGTH_TITLE = textLengthDef.block["TEXT_LENGTH_TITLE"];

        // We have to override this block definition because the builtin block
        // allows both Strings and Arrays in its input check and that confuses
        // our Blockly compiler
        let block = Blockly.Blocks[textLengthId];
        block.init = function() {
            this.jsonInit({
            "message0": msg.TEXT_LENGTH_TITLE,
            "args0": [
                {
                "type": "input_value",
                "name": "VALUE",
                "check": ['String']
                }
            ],
            "output": 'Number',
            "outputShape": Blockly.OUTPUT_SHAPE_ROUND
            });
        }
        installBuiltinHelpInfo(textLengthId);

        // builtin text_join
        const textJoinId = "text_join";
        const textJoinDef = pxt.blocks.getBlockDefinition(textJoinId);
        msg.TEXT_JOIN_TITLE_CREATEWITH = textJoinDef.block["TEXT_JOIN_TITLE_CREATEWITH"];
        installBuiltinHelpInfo(textJoinId);
    }

    function initTooltip(blockInfo: pxtc.BlocksInfo) {

        const renderTip = (el: any) => {
            if (el.disabled)
                return lf("This block is disabled and will not run. Attach this block to an event to enable it.")
            let tip = el.tooltip;
            while (goog.isFunction(tip)) {
                tip = tip(el);
            }
            return tip;
        }
        // TODO: update this when pulling new blockly
        /**
         * Create the tooltip and show it.
         * @private
         */
        Blockly.Tooltip.show_ = function () {
            Blockly.Tooltip.poisonedElement_ = Blockly.Tooltip.element_;
            if (!Blockly.Tooltip.DIV) {
                return;
            }
            // Erase all existing text.
            goog.dom.removeChildren(/** @type {!Element} */(Blockly.Tooltip.DIV));
            // Get the new text.
            const card = Blockly.Tooltip.element_.codeCard as pxt.CodeCard;

            function render() {
                let rtl = Blockly.Tooltip.element_.RTL;
                let windowSize = goog.dom.getViewportSize();
                // Display the tooltip.
                Blockly.Tooltip.DIV.style.direction = rtl ? 'rtl' : 'ltr';
                Blockly.Tooltip.DIV.style.display = 'block';
                Blockly.Tooltip.visible = true;
                // Move the tooltip to just below the cursor.
                let anchorX = Blockly.Tooltip.lastX_;
                if (rtl) {
                    anchorX -= Blockly.Tooltip.OFFSET_X + Blockly.Tooltip.DIV.offsetWidth;
                } else {
                    anchorX += Blockly.Tooltip.OFFSET_X;
                }
                let anchorY = Blockly.Tooltip.lastY_ + Blockly.Tooltip.OFFSET_Y;

                if (anchorY + Blockly.Tooltip.DIV.offsetHeight >
                    windowSize.height + window.scrollY) {
                    // Falling off the bottom of the screen; shift the tooltip up.
                    anchorY -= Blockly.Tooltip.DIV.offsetHeight + 2 * Blockly.Tooltip.OFFSET_Y;
                }
                if (rtl) {
                    // Prevent falling off left edge in RTL mode.
                    anchorX = Math.max(Blockly.Tooltip.MARGINS - window.scrollX, anchorX);
                } else {
                    if (anchorX + Blockly.Tooltip.DIV.offsetWidth >
                        windowSize.width + window.scrollX - 2 * Blockly.Tooltip.MARGINS) {
                        // Falling off the right edge of the screen;
                        // clamp the tooltip on the edge.
                        anchorX = windowSize.width - Blockly.Tooltip.DIV.offsetWidth -
                            2 * Blockly.Tooltip.MARGINS;
                    }
                }
                Blockly.Tooltip.DIV.style.top = anchorY + 'px';
                Blockly.Tooltip.DIV.style.left = anchorX + 'px';
            }
            if (card) {
                pxt.blocks.compileBlockAsync(Blockly.Tooltip.element_, blockInfo).then((compileResult) => {
                    const cardEl = pxt.docs.codeCard.render({
                        header: renderTip(Blockly.Tooltip.element_),
                        typeScript: Blockly.Tooltip.element_.disabled || pxt.appTarget.appTheme.hideBlocklyJavascriptHint
                            ? undefined
                            : compileResult.source
                    })
                    Blockly.Tooltip.DIV.appendChild(cardEl);
                    render();
                })
            } else {
                let tip = renderTip(Blockly.Tooltip.element_);
                tip = Blockly.utils.wrap(tip, Blockly.Tooltip.LIMIT);
                // Create new text, line by line.
                let lines = tip.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    let div = document.createElement('div');
                    div.appendChild(document.createTextNode(lines[i]));
                    Blockly.Tooltip.DIV.appendChild(div);
                }
                render();
            }
        }
    }
}
