/// <reference path="../localtypings/blockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />
import Util = pxt.Util;

let lf = Util.lf;

namespace pxt.blocks {
    const blockColors: Map<number> = {
        loops: 120,
        images: 45,
        variables: 330,
        text: 160,
        lists: 260,
        math: 230,
        logic: 210
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
        }
    }

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

        if (typeInfo) {
            const field = document.createElement("field");
            shadow.appendChild(field);
            field.setAttribute("name", shadowType == "variables_get" ? "VAR" : typeInfo.field);

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
        if ((fn.kind == pxtc.SymbolKind.Method || fn.kind == pxtc.SymbolKind.Property)
            && attrNames["this"]) {
            let attr = attrNames["this"];
            block.appendChild(createShadowValue(attr.name, attr.type, attr.shadowValue || attr.name, attr.shadowType || "variables_get"));
        }
        if (fn.parameters)
            fn.parameters.filter(pr => !!attrNames[pr.name].name &&
                (/^(string|number|boolean)$/.test(attrNames[pr.name].type)
                    || !!attrNames[pr.name].shadowType
                    || !!attrNames[pr.name].shadowValue))
                .forEach(pr => {
                    let attr = attrNames[pr.name];
                    block.appendChild(createShadowValue(attr.name, attr.type, attr.shadowValue, attr.shadowType));
                })
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

    function injectToolbox(tb: Element, info: pxtc.BlocksInfo, fn: pxtc.SymbolInfo, block: HTMLElement, showCategories: boolean) {
        // identity function are just a trick to get an enum drop down in the block
        // while allowing the parameter to be a number
        if (fn.attributes.blockHidden)
            return;

        if (!fn.attributes.deprecated) {
            let ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
            let nsn = info.apis.byQName[ns];
            if (nsn) ns = nsn.attributes.block || ns;
            let catName = ts.pxtc.blocksCategory(fn);
            let category = categoryElement(tb, catName);

            if (showCategories) {
                if (!category) {
                    let categories = getChildCategories(tb)
                    let parentCategoryList = tb;

                    pxt.debug('toolbox: adding category ' + ns)

                    const nsWeight = (nsn ? nsn.attributes.weight : 50) || 50;
                    const locCatName = (nsn ? nsn.attributes.block : "") || catName;
                    category = createCategoryElement(locCatName, catName, nsWeight);

                    if (nsn && nsn.attributes.color) {
                        category.setAttribute("colour", nsn.attributes.color);
                    }
                    else if (blockColors[ns]) {
                        category.setAttribute("colour", blockColors[ns].toString());
                    }
                    if (nsn && nsn.attributes.icon) {
                        const nsnIconClassName = `blocklyTreeIcon${nsn.name.toLowerCase()}`.replace(/\s/g, '');
                        appendToolboxIconCss(nsnIconClassName, nsn.attributes.icon);
                        category.setAttribute("iconclass", nsnIconClassName);
                        category.setAttribute("expandedclass", nsnIconClassName);
                    } else {
                        category.setAttribute("iconclass", `blocklyTreeIconDefault`);
                        category.setAttribute("expandedclass", `blocklyTreeIconDefault`);
                    }

                    if (nsn && nsn.attributes.advanced) {
                        parentCategoryList = getOrAddSubcategory(tb, Util.lf("{id:category}Advanced"), "Advanced", 1, "#5577EE", 'blocklyTreeIconadvanced')
                        categories = getChildCategories(parentCategoryList)
                    }

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
                if (fn.attributes.advanced) {
                    category = getOrAddSubcategory(category, lf("More"), "More", 1, category.getAttribute("colour"), 'blocklyTreeIconmore')
                }
            }
            if (fn.attributes.mutateDefaults) {
                const mutationValues = fn.attributes.mutateDefaults.split(";");
                mutationValues.forEach(mutation => {
                    const mutatedBlock = block.cloneNode(true);
                    mutateToolboxBlock(mutatedBlock, fn.attributes.mutate, mutation);
                    if (showCategories) {
                        category.appendChild(mutatedBlock);
                    } else {
                        tb.appendChild(mutatedBlock);
                    }
                });
            }
            else {
                if (showCategories) {
                    category.appendChild(block);
                    injectToolboxIconCss();
                } else {
                    tb.appendChild(block);
                }
            }
        }
    }

    let toolboxStyle: HTMLStyleElement;
    let toolboxStyleBuffer: string = '';
    export function appendToolboxIconCss(className: string, i: string): void {
        if (toolboxStyleBuffer.indexOf(className) > -1) return;

        const icon = Util.unicodeToChar(i);
        toolboxStyleBuffer += `
            .blocklyTreeIcon.${className}::before {
                content: "${icon}";
            }
        `;
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
            toolboxStyle.textContent = toolboxStyleBuffer;
        } else {
            toolboxStyle.appendChild(document.createTextNode(toolboxStyleBuffer));
        }
    }

    let iconCanvasCache: Map<string> = {};
    function iconToFieldImage(c: string): Blockly.FieldImage {
        let url = iconCanvasCache[c];
        if (!url) {
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
        return new Blockly.FieldImage(url, 16, 16, '');
    }

    function getChildCategories(parent: Element) {
        const elements = parent.querySelectorAll("category");
        const result: Element[] = [];

        for (let i = 0; i < elements.length; i++) {
            if (elements[i].parentNode === parent) { // IE11: no parentElement
                result.push(elements[i])
            }
        }

        return result;
    }

    function getOrAddSubcategory(parent: Element, name: string, nameid: string, weight: number, colour?: string, iconClass?: string) {
        const existing = parent.querySelector(`category[nameid="${nameid.toLowerCase()}"]`);
        if (existing) {
            return existing;
        }

        const newCategory = createCategoryElement(name, nameid, weight, colour, iconClass);
        parent.appendChild(newCategory)

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
        if (ni == 0) {
            const icon = ns && ns.attributes.icon ? ns.attributes.icon : null;
            if (icon)
                i.appendField(iconToFieldImage(icon));
        }
        if (pre)
            i.appendField(pre);
        if (right)
            i.setAlign(Blockly.ALIGN_RIGHT)
        // ignore generic types
        if (type && type != "T")
            i.setCheck(type);
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

        if (fn.attributes.help)
            block.setHelpUrl("/reference/" + fn.attributes.help.replace(/^\//, ''));

        block.setTooltip(fn.attributes.jsDoc);
        block.setColour(
            fn.attributes.color
            || (nsinfo ? nsinfo.attributes.color : undefined)
            || blockColors[ns]
            || 255);

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
                                src: `/static/blocks/${v.namespace.toLowerCase()}/${v.name.toLowerCase()}.png`,
                                alt: k,
                                width: 32,
                                height: 32
                            } : k,
                            v.namespace + "." + v.name
                        ];
                    });
                    i = initField(block.appendDummyInput(), field.ni, fn, nsinfo, pre, true);
                    // if a value is provided, move it first
                    if (pr.shadowValue)
                        dd.sort((v1, v2) => v1[1] == pr.shadowValue ? -1 : v2[1] == pr.shadowValue ? 1 : 0);
                    i.appendField(new Blockly.FieldDropdown(dd), attrNames[n].name);

                } else if (/\[\]$/.test(pr.type)) { // Array type
                    i = initField(block.appendValueInput(p), field.ni, fn, nsinfo, pre, true, "Array");
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

        const body = fn.parameters ? fn.parameters.filter(pr => pr.type == "() => void")[0] : undefined;
        if (body) {
            block.appendStatementInput("HANDLER")
                .setCheck("null");
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

        block.setInputsInline(!fn.attributes.blockExternalInputs && fn.parameters.length < 4 && !fn.attributes.imageLiteral);

        switch (fn.retType) {
            case "number": block.setOutput(true, "Number"); break;
            case "string": block.setOutput(true, "String"); break;
            case "boolean": block.setOutput(true, "Boolean"); break;
            case "void": break; // do nothing
            //TODO
            default: block.setOutput(true, fn.retType);
        }

        // hook up/down if return value is void
        const hasHandlers = hasArrowFunction(fn);
        block.setPreviousStatement(!hasHandlers && fn.retType == "void");
        block.setNextStatement(!hasHandlers && fn.retType == "void");

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

    export function createToolbox(blockInfo: pxtc.BlocksInfo, toolbox?: Element, showCategories: boolean = true, blockSubset?: { [index: string]: number }): Element {
        init();

        // create new toolbox and update block definitions
        let tb = toolbox ? <Element>toolbox.cloneNode(true) : undefined;
        blockInfo.blocks.sort((f1, f2) => {
            let ns1 = blockInfo.apis.byQName[f1.namespace.split('.')[0]];
            let ns2 = blockInfo.apis.byQName[f2.namespace.split('.')[0]];
            if (ns1 && !ns2) return -1; if (ns2 && !ns1) return 1;
            let c = 0;
            if (ns1 && ns2) {
                c = (ns2.attributes.weight || 50) - (ns1.attributes.weight || 50);
                if (c != 0) return c;
            }
            c = (f2.attributes.weight || 50) - (f1.attributes.weight || 50);
            return c;
        })

        let currentBlocks: Map<number> = {};
        const dbg = pxt.options.debug;
        // create new toolbox and update block definitions
        blockInfo.blocks
            .filter(fn => !tb || !tb.querySelector(`block[type='${fn.attributes.blockId}']`))
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
                    }
                }
            })

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
                if (showCategories) {
                    let cat = categoryElement(tb, eb.namespace);
                    if (cat) {
                        cat.appendChild(el);
                    } else {
                        console.error(`trying to add block ${eb.type} to unknown category ${eb.namespace}`)
                    }
                } else {
                    tb.appendChild(el);
                }
            })
        }

        if (tb && showCategories) {
            // remove unused categories
            let config = pxt.appTarget.runtime || {};
            if (!config.mathBlocks) removeCategory(tb, "Math");
            if (!config.textBlocks) removeCategory(tb, "Text");
            if (!config.listsBlocks) removeCategory(tb, "Lists");
            if (!config.variablesBlocks) removeCategory(tb, "Variables");
            if (!config.logicBlocks) removeCategory(tb, "Logic");
            if (!config.loopsBlocks) removeCategory(tb, "Loops");

            // Load localized names for default categories
            let cats = tb.querySelectorAll('category');
            for (let i = 0; i < cats.length; i++) {
                cats[i].setAttribute('name',
                    Util.rlf(`{id:category}${cats[i].getAttribute('name')}`, []));
            }
        }

        // Do not remove this comment.
        // These are used for category names.
        // lf("{id:category}Loops")
        // lf("{id:category}Logic")
        // lf("{id:category}Variables")
        // lf("{id:category}Lists")
        // lf("{id:category}Text")
        // lf("{id:category}Math")
        // lf("{id:category}Advanced")
        // lf("{id:category}More\u2026")

        // update shadow types
        if (tb) {
            $(tb).find('shadow:empty').each((i, shadow) => {
                let type = shadow.getAttribute('type');
                let b = $(tb).find(`block[type="${type}"]`)[0];
                if (b) shadow.innerHTML = b.innerHTML;
            })
        }

        // Add the "Add package" category
        if (tb && showCategories) {
            getOrAddSubcategory(tb, Util.lf("{id:category}Add Package"), "Add Package", 1, "#717171", 'blocklyTreeIconaddpackage')
        }

        // Filter the blocks
        if (blockSubset) {
            let keepcategories: { [index: string]: number } = {};
            let categories = tb.querySelectorAll("category");
            let blocks = tb.querySelectorAll("block");
            for (let bi = 0; bi < blocks.length; ++bi) {
                let blk = blocks.item(bi);
                let type = blk.getAttribute("type");
                let catName = blk.parentElement.getAttribute("name");
                let sticky = blk.getAttribute("sticky");
                if (!blockSubset[type] && !sticky) {
                    blk.parentNode.removeChild(blk);
                } else {
                    keepcategories[catName] = 1;
                    if (type.indexOf("variables") == 0) {
                        keepcategories["Variables"] = 1;
                    }
                }
            }
            if (showCategories) {
                for (let ci = 0; ci < categories.length; ++ci) {
                    let cat = categories.item(ci);
                    let catName = cat.getAttribute("name");
                    if (!keepcategories[catName] && catName != Util.lf("{id:category}Advanced")) {
                        cat.parentNode.removeChild(cat);
                    }
                }
            }
        }

        if (tb) {
            usedBlocks = {};
            const blocks = tb.querySelectorAll("block");

            for (let i = 0; i < blocks.length; i++) {
                usedBlocks[blocks.item(i).getAttribute("type")] = true;
            }

            updateUsedBlocks = true;
        }

        return tb;
    }

    export function initBlocks(blockInfo: pxtc.BlocksInfo, toolbox?: Element, showCategories: boolean = true, blockSubset?: { [index: string]: number }): Element {
        init();
        initTooltip(blockInfo);

        let tb = createToolbox(blockInfo, toolbox, showCategories, blockSubset);

        // add trash icon to toolbox
        if (!$('#blocklyTrashIcon').length) {
            let trashDiv = document.createElement('div');
            trashDiv.id = "blocklyTrashIcon";
            trashDiv.style.opacity = '0';
            trashDiv.style.display = 'none';
            let trashIcon = document.createElement('i');
            trashIcon.className = 'trash icon';
            trashDiv.appendChild(trashIcon);
            $('.blocklyToolboxDiv').append(trashDiv);
        }

        return tb;
    }

    export let cachedSearchTb: Element;
    export function initSearch(workspace: Blockly.Workspace, tb: Element,
        searchAsync: (searchFor: pxtc.service.SearchOptions) => Promise<pxtc.service.SearchInfo[]>,
        updateToolbox: (tb: Element) => void) {
        if ($(`#blocklySearchArea`).length) return;

        let blocklySearchArea = document.createElement('div');
        blocklySearchArea.id = 'blocklySearchArea';

        let blocklySearchInput = document.createElement('div');
        let origClassName = 'ui fluid icon input';
        blocklySearchInput.className = origClassName;

        let blocklySearchInputField = document.createElement('input');
        blocklySearchInputField.type = 'text';
        blocklySearchInputField.placeholder = lf("Search...");
        blocklySearchInputField.className = 'blocklySearchInputField';

        pxt.blocks.cachedSearchTb = tb;
        const searchHandler = Util.debounce(() => {
            let searchField = $('.blocklySearchInputField');
            let searchFor = searchField.val().toLowerCase();
            blocklySearchInput.className += ' loading';

            if (searchFor != '') {
                pxt.tickEvent("blocks.search");
                let searchTb = tb ? <Element>tb.cloneNode(true) : undefined;

                let catName = 'Search';
                let category = categoryElement(searchTb, catName);

                if (!category) {
                    let categories = getChildCategories(searchTb)
                    let parentCategoryList = searchTb;

                    const nsWeight = 101; // Show search category on top
                    const locCatName = lf("Search");
                    category = createCategoryElement(locCatName, catName, nsWeight);
                    category.setAttribute("expanded", 'true');
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
                    updateUsedBlocks = false;
                    if (!blocks) return;
                    if (blocks.length == 0) {
                        let label = goog.dom.createDom('label');
                        label.setAttribute('text', lf("No search results..."));
                        category.appendChild(label);
                        return;
                    }
                    blocks.forEach(info => {
                        if (tb) {
                            const type = info.id;

                            if (info.field) {
                                const blocks = tb.querySelectorAll(`block[type="${type}"]`);
                                for (let i = 0; i < blocks.length; i++) {
                                    const block = blocks.item(i);
                                    const f = block.querySelector(`field[name="${info.field[0]}"]`);
                                    if (f && f.innerHTML === info.field[1]) {
                                        category.appendChild(block.cloneNode(true));
                                        return;
                                    }
                                }
                            }
                            else {
                                // Just grab the first block of this type from the toolbox
                                const block = tb.querySelector(`block[type="${type}"]`);
                                if (block) {
                                    category.appendChild(block.cloneNode(true));
                                }
                            }
                        }
                    })
                }).finally(() => {
                    if (tb) {
                        updateToolbox(searchTb);
                        blocklySearchInput.className = origClassName;
                    }
                })
            } else {
                // Clearing search
                updateToolbox(pxt.blocks.cachedSearchTb);
                blocklySearchInput.className = origClassName;
            }
            // Search
        }, 200, false);

        blocklySearchInputField.oninput = searchHandler;
        blocklySearchInputField.onchange = searchHandler;
        pxt.BrowserUtils.isTouchEnabled() ?
            blocklySearchInputField.ontouchstart = searchHandler
            : blocklySearchInputField.onclick = searchHandler;

        let blocklySearchInputIcon = document.createElement('i');
        blocklySearchInputIcon.className = 'search icon';

        blocklySearchInput.appendChild(blocklySearchInputField);
        blocklySearchInput.appendChild(blocklySearchInputIcon);
        blocklySearchArea.appendChild(blocklySearchInput);
        $('.blocklyToolboxDiv').prepend(blocklySearchArea);
    }

    function categoryElement(tb: Element, nameid: string): Element {
        return tb ? tb.querySelector(`category[nameid="${nameid.toLowerCase()}"]`) : undefined;
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

        if (window.navigator.pointerEnabled) {
            (Blockly.bindEvent_ as any).TOUCH_MAP = {
                mousedown: 'pointerdown',
                mousemove: 'pointermove',
                mouseup: 'pointerup'
            };
            document.body.style.touchAction = 'none';
        }

        Blockly.FieldCheckbox.CHECK_CHAR = '■';
        Blockly.BlockSvg.START_HAT = !!pxt.appTarget.appTheme.blockHats;

        initContextMenu();
        initOnStart();
        initMath();
        initVariables();
        initLoops();
        initLogic();
        initText();
        initDrag();
        initToolboxColor();
        initExpandToolbox();
        initToolboxIconPatch();
    }

    function setBuiltinHelpInfo(block: any, id: string) {
        const info = helpResources[id];
        setHelpResources(block, id, info.name, info.tooltip, info.url);
    }

    function installBuiltinHelpInfo(id: string) {
        const info = helpResources[id];
        installHelpResources(id, info.name, info.tooltip, info.url)
    }

    function setHelpResources(block: any, id: string, name: string, tooltip: any, url: string) {
        if (tooltip) block.setTooltip(tooltip);
        if (url) block.setHelpUrl(url);

        let tb = document.getElementById('blocklyToolboxDefinition');
        let xml: HTMLElement = tb ? tb.querySelector(`category block[type~='${id}']`) as HTMLElement : undefined;
        block.codeCard = <pxt.CodeCard>{
            header: name,
            name: name,
            software: 1,
            description: goog.isFunction(tooltip) ? tooltip() : tooltip,
            blocksXml: xml ? (`<xml xmlns="http://www.w3.org/1999/xhtml">` + (cleanOuterHTML(xml) || `<block type="${id}"></block>`) + "</xml>") : undefined,
            url: url
        };
    }

    function installHelpResources(id: string, name: string, tooltip: any, url: string) {
        let block = Blockly.Blocks[id];
        let old = block.init;
        if (!old) return;

        block.init = function () {
            old.call(this);
            let block = this;
            setHelpResources(this, id, name, goog.isFunction(tooltip) ? function () { return tooltip(block); } : tooltip, url);
        }
    }

    function initLoops() {
        let msg: any = Blockly.Msg;

        // builtin controls_repeat_ext
        msg.CONTROLS_REPEAT_TITLE = lf("repeat %1 times");
        msg.CONTROLS_REPEAT_INPUT_DO = lf("{id:repeat}do");
        installBuiltinHelpInfo('controls_repeat_ext');

        // pxt device_while
        Blockly.Blocks['device_while'] = {
            init: function () {
                this.jsonInit({
                    "message0": lf("while %1"),
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "COND",
                            "check": "Boolean"
                        }
                    ],
                    "previousStatement": null,
                    "nextStatement": null,
                    "colour": blockColors['loops']
                });
                this.appendStatementInput("DO")
                    .appendField(lf("{id:while}do"));

                setBuiltinHelpInfo(this, 'device_while');
            }
        };

        // pxt controls_simple_for
        Blockly.Blocks['controls_simple_for'] = {
            /**
             * Block for 'for' loop.
             * @this Blockly.Block
             */
            init: function () {
                this.jsonInit({
                    "message0": lf("for %1 from 0 to %2"),
                    "args0": [
                        {
                            "type": "field_variable",
                            "name": "VAR",
                            "variable": lf("{id:var}item")
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
                    "colour": blockColors['loops'],
                    "inputsInline": true
                });
                this.appendStatementInput('DO')
                    .appendField(lf("{id:for}do"));

                const info = helpResources['controls_simple_for'];
                let thisBlock = this;
                setHelpResources(this,
                    'controls_simple_for',
                    info.name,
                    function () {
                        return lf("Have the variable '{0}' take on the values from 0 to the end number, counting by 1, and do the specified blocks.", thisBlock.getFieldValue('VAR'));
                    },
                    info.url
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
                    let xmlBlock = goog.dom.createDom('block', null, xmlField);
                    xmlBlock.setAttribute('type', 'variables_get');
                    option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
                    options.push(option);
                }
            }
        };
    }

    export var onShowContextMenu: (workspace: Blockly.Workspace,
        items: Blockly.ContextMenu.MenuItem[]) => void = undefined;

    // TODO: port changes to blockly
    export function initMouse(ws: Blockly.Workspace) {
        // Blockly wheel scroll and zoom:
        Blockly.bindEvent_(ws.svgGroup_, 'wheel', ws, ev => {
            let e = ev as WheelEvent;
            Blockly.terminateDrag_();
            const delta = e.deltaY > 0 ? -1 : 1;
            const position = Blockly.utils.mouseToSvg(e, ws.getParentSvg());
            if (e.ctrlKey || e.metaKey)
                ws.zoom(position.x, position.y, delta);
            else if (ws.scrollbar) {
                let y = parseFloat(ws.scrollbar.vScroll.svgHandle_.getAttribute("y") || "0");
                y /= ws.scrollbar.vScroll.ratio_;
                ws.scrollbar.vScroll.set(y + e.deltaY);
                ws.scrollbar.resize();
            }
            e.preventDefault();
        });
    }

    /**
     * The following patch to blockly is to add the Trash icon on top of the toolbox,
     * the trash icon should only show when a user drags a block that is already in the workspace.
     */
    function initDrag() {
        const calculateDistance = (elemBounds: any, mouseX: any) => {
            return Math.floor(mouseX - (elemBounds.left + (elemBounds.width / 2)));
        }
        /**
         * Track a drag of an object on this workspace.
         * @param {!Event} e Mouse move event.
         * @return {!goog.math.Coordinate} New location of object.
         */
        let moveDrag = (<any>Blockly).WorkspaceSvg.prototype.moveDrag;
        (<any>Blockly).WorkspaceSvg.prototype.moveDrag = function (e: any) {
            const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement;
            const trashIcon = document.getElementById("blocklyTrashIcon");
            if (blocklyTreeRoot && trashIcon) {
                const distance = calculateDistance(blocklyTreeRoot.getBoundingClientRect(), e.pageX);
                if (distance < 200) {
                    const opacity = distance / 200;
                    trashIcon.style.opacity = `${1 - opacity}`;
                    trashIcon.style.display = 'block';
                    blocklyTreeRoot.style.opacity = `${opacity}`;
                } else {
                    trashIcon.style.display = 'none';
                    blocklyTreeRoot.style.opacity = '1';
                }
            }
            return moveDrag.call(this, e);
        };

        /**
         * Stop binding to the global mouseup and mousemove events.
         * @private
         */
        let terminateDrag_ = (<any>Blockly).terminateDrag_;
        (<any>Blockly).terminateDrag_ = function () {
            const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement;
            const trashIcon = document.getElementById("blocklyTrashIcon");
            if (trashIcon) {
                trashIcon.style.display = 'none';
                blocklyTreeRoot.style.opacity = '1';
            }
            terminateDrag_.call(this);
        }
    }

    let lastInvertedCategory: any;
    export const highlightColorInvertedLuminocityMultiplier = 0.3;
    function initToolboxColor() {
        let appTheme = pxt.appTarget.appTheme;

        if (appTheme.coloredToolbox) {
            /**
             * Recursively add colours to this toolbox.
             * @param {Blockly.Toolbox.TreeNode} opt_tree Starting point of tree.
             *     Defaults to the root node.
             * @private
             */
            (<any>Blockly).Toolbox.prototype.addColour_ = function (opt_tree: any) {
                let tree = opt_tree || this.tree_;
                let children = tree.getChildren();
                for (let i = 0, child: any; child = children[i]; i++) {
                    let element = child.getRowElement();
                    if (element) {
                        let border = '';
                        if (this.hasColours_) {
                            border = '8px solid ' + (child.hexColour || '#ddd');
                        } else {
                            border = 'none';
                        }
                        if (this.workspace_.RTL) {
                            element.style.borderRight = border;
                        } else {
                            element.style.borderLeft = border;
                        }
                        if (this.hasColours_) {
                            element.style.color = (child.hexColour || '#000');
                        }
                    }
                    this.addColour_(child);
                }
            };
        } else if (appTheme.invertedToolbox) {
            /**
             * Recursively add colours to this toolbox.
             * @param {Blockly.Toolbox.TreeNode} opt_tree Starting point of tree.
             *     Defaults to the root node.
             * @private
             */
            (<any>Blockly).Toolbox.prototype.addColour_ = function (opt_tree: any) {
                let tree = opt_tree || this.tree_;
                let children = tree.getChildren();
                for (let i = 0, child: any; child = children[i]; i++) {
                    let element = child.getRowElement();
                    let onlyChild = children.length == 1;
                    if (element) {
                        if (this.hasColours_) {
                            element.style.color = '#fff';
                            element.style.background = (child.hexColour || '#ddd');
                            element.onmouseenter = () => {
                                if (!child.isSelected()) {
                                    element.style.background = pxt.blocks.fadeColour(child.hexColour || '#ddd', highlightColorInvertedLuminocityMultiplier, false);
                                }
                            };
                            element.onmouseleave = () => {
                                if (!child.isSelected()) {
                                    element.style.background = (child.hexColour || '#ddd');
                                }
                            }
                        }
                    }
                    this.addColour_(child);
                }
            };

            /**
             * Display/hide the flyout when an item is selected.
             * @param {goog.ui.tree.BaseNode} node The item to select.
             * @override
             */
            let setSelectedItem = Blockly.Toolbox.TreeControl.prototype.setSelectedItem;
            let editor = this;
            Blockly.Toolbox.TreeControl.prototype.setSelectedItem = function (node: any) {
                let toolbox = this.toolbox_;
                if (node == this.selectedItem_ || node == toolbox.tree_) {
                    return;
                }

                // Capture the last category and reset it after Blockly's setSelectedItem has been called.
                editor.lastInvertedCategory = toolbox.lastCategory_;
                setSelectedItem.call(this, node);
                if (editor.lastInvertedCategory) {
                    // reset last category colour
                    let lastElement = editor.lastInvertedCategory.getRowElement();
                    if (lastElement) lastElement.style.backgroundColor = (editor.lastInvertedCategory.hexColour || '#ddd');
                }
                if (this.selectedItem_) {
                    let selectedElement = this.selectedItem_.getRowElement();
                    if (selectedElement) selectedElement.style.backgroundColor = pxt.blocks.fadeColour(this.selectedItem_.hexColour, highlightColorInvertedLuminocityMultiplier, false);
                }
            };
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
        msg.DELETE_X_BLOCKS = lf("Delete %1 Blocks");
        msg.HELP = lf("Help");

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
                    lf("Delete {0} Blocks", deleteList.length),
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
                    pxt.blocks.layout.flow(this);
                }
            }
            menuOptions.push(formatCodeOption);

            const shuffleOption = {
                text: lf("Shuffle Blocks"),
                enabled: topBlocks.length > 0,
                callback: () => {
                    pxt.tickEvent("blocks.context.shuffle");
                    pxt.blocks.layout.shuffle(this, 1);
                }
            };
            menuOptions.push(shuffleOption);

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
                                `${pxt.appTarget.nickname || pxt.appTarget.forkof || pxt.appTarget.id}-${lf("screenshot")}.png`);
                        });
                }
            };
            menuOptions.push(screenshotOption);

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
                collapseMoreCategory(that.getTree().getSelectedItem(), that);
            }

            if (that.hasChildren() && that.isUserCollapsible_) {
                // If this is a category of categories, we want to toggle when clicked
                if (that.getChildCount() > 1) {
                    that.toggle();
                    if (that.isSelected()) {
                        that.getTree().setSelectedItem(null);
                    }
                    else {
                        that.select();
                    }
                }
                else {
                    // If this category has 1 or less children, don't bother toggling; we always want "More..." to show
                    if (that.isSelected()) {
                        collapseMoreCategory(that.getTree().getSelectedItem(), that);
                        that.getTree().setSelectedItem(null);
                    } else {
                        that.setExpanded(true);
                        that.select();
                    }
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
                collapseMoreCategory(that.selectedItem_);
                editor.lastInvertedCategory = that.selectedItem_;
            }

            oldSetSelectedItem.call(that, a);
        };

        // Fix highlighting bug in edge
        (<any>Blockly).Flyout.prototype.addBlockListeners_ = function (root: any, block: any, rect: any) {
            this.listeners_.push((<any>Blockly).bindEventWithChecks_(root, 'mousedown', null,
                this.blockMouseDown_(block)));
            this.listeners_.push((<any>Blockly).bindEventWithChecks_(rect, 'mousedown', null,
                this.blockMouseDown_(block)));
            this.listeners_.push(Blockly.bindEvent_(root, 'mouseover', block,
                select));
            this.listeners_.push(Blockly.bindEvent_(rect, 'mouseover', block,
                select));

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

    function collapseMoreCategory(cat: Blockly.Toolbox.TreeNode, child?: Blockly.Toolbox.TreeNode) {
        while (cat) {
            // Only collapse categories that have a single child (e.g. "More...")
            if (cat.getChildCount() === 1 && cat.isUserCollapsible_ && cat != child && (!child || !isChild(child, cat))) {
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
        // pxt math_op2
        Blockly.Blocks[ts.pxtc.ON_START_TYPE] = {
            init: function () {
                this.jsonInit({
                    "message0": lf("on start %1 %2"),
                    "args0": [
                        {
                            "type": "input_dummy"
                        },
                        {
                            "type": "input_statement",
                            "name": "HANDLER"
                        }
                    ],
                    "colour": (pxt.appTarget.runtime ? pxt.appTarget.runtime.onStartColor : '') || blockColors['loops']
                });

                setHelpResources(this,
                    ts.pxtc.ON_START_TYPE,
                    lf("on start event"),
                    lf("Run code when the program starts"),
                    '/blocks/on-start'
                );
            }
        };
    }

    function initMath() {
        // pxt math_op2
        Blockly.Blocks['math_op2'] = {
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
                    "colour": blockColors['math']
                });

                let thisBlock = this;
                const info = helpResources['math_op2'];
                setHelpResources(this,
                    'math_op2',
                    info.name,
                    function () {
                        return thisBlock.getFieldValue('op') == 'min' ? lf("smaller value of 2 numbers") : lf("larger value of 2 numbers");
                    },
                    info.url
                );
            }
        };

        // pxt math_op3
        Blockly.Blocks['math_op3'] = {
            init: function () {
                this.jsonInit({
                    "message0": lf("absolute of %1"),
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "x",
                            "check": "Number"
                        }
                    ],
                    "inputsInline": true,
                    "output": "Number",
                    "colour": blockColors['math']
                });

                setBuiltinHelpInfo(this, 'math_op3');
            }
        };

        // pxt device_random
        Blockly.Blocks['device_random'] = {
            init: function () {
                this.jsonInit({
                    "message0": lf("pick random 0 to %1"),
                    "args0": [
                        {
                            "type": "input_value",
                            "name": "limit",
                            "check": "Number"
                        }
                    ],
                    "inputsInline": true,
                    "output": "Number",
                    "colour": blockColors['math']
                });

                setBuiltinHelpInfo(this, 'device_random');
            }
        };

        // builtin math_number
        //XXX Integer validation needed.
        const mInfo = helpResources['math_number'];
        installHelpResources(
            'math_number',
            mInfo.name,
            (pxt.appTarget.compile && pxt.appTarget.compile.floatingPoint) ? lf("a decimal number") : lf("an integer number"),
            mInfo.url
        );

        // builtin math_arithmetic
        let msg: any = Blockly.Msg;
        msg.MATH_ADDITION_SYMBOL = lf("{id:op}+");
        msg.MATH_SUBTRACTION_SYMBOL = lf("{id:op}-");
        msg.MATH_MULTIPLICATION_SYMBOL = lf("{id:op}×");
        msg.MATH_DIVISION_SYMBOL = lf("{id:op}÷");
        msg.MATH_POWER_SYMBOL = lf("{id:op}^");

        let TOOLTIPS: any = {
            'ADD': lf("Return the sum of the two numbers."),
            'MINUS': lf("Return the difference of the two numbers."),
            'MULTIPLY': lf("Return the product of the two numbers."),
            'DIVIDE': lf("Return the quotient of the two numbers."),
            'POWER': lf("Return the first number raised to the power of the second number."),
        };
        const aInfo = helpResources['math_arithmetic'];
        installHelpResources(
            'math_arithmetic',
            aInfo.name,
            function (block: any) {
                return TOOLTIPS[block.getFieldValue('OP')];
            },
            aInfo.url
        );

        // builtin math_modulo
        msg.MATH_MODULO_TITLE = lf("remainder of %1 ÷ %2");
        installBuiltinHelpInfo('math_modulo');
    }

    function initVariables() {
        let varname = lf("{id:var}item");
        Blockly.Variables.flyoutCategory = function (workspace: Blockly.Workspace) {
            let xmlList: HTMLElement[] = [];
            let button = goog.dom.createDom('button');
            button.setAttribute('text', lf("Make a Variable"));
            button.setAttribute('callbackKey', 'CREATE_VARIABLE');

            workspace.registerButtonCallback('CREATE_VARIABLE', function (button: Blockly.FlyoutButton) {
                Blockly.Variables.createVariable(button.getTargetWorkspace());
            });
            xmlList.push(button);

            let variableList = Blockly.Variables.allVariables(workspace);
            variableList.sort(goog.string.caseInsensitiveCompare);
            // In addition to the user's variables, we also want to display the default
            // variable name at the top.  We also don't want this duplicated if the
            // user has created a variable of the same name.
            goog.array.remove(variableList, varname);
            variableList.unshift(varname);

            // variables getters first
            for (let i = 0; i < variableList.length; i++) {
                // <block type="variables_get" gap="24">
                //   <field name="VAR">item</field>
                // </block>
                let block = goog.dom.createDom('block');
                block.setAttribute('type', 'variables_get');
                block.setAttribute('gap', '8');
                let field = goog.dom.createDom('field', null, variableList[i]);
                field.setAttribute('name', 'VAR');
                block.appendChild(field);
                xmlList.push(block);
            }
            xmlList[xmlList.length - 1].setAttribute('gap', '24');

            for (let i = 0; i < Math.min(1, variableList.length); i++) {
                {
                    // <block type="variables_set" gap="8">
                    //   <field name="VAR">item</field>
                    // </block>
                    let block = goog.dom.createDom('block');
                    block.setAttribute('type', 'variables_set');
                    block.setAttribute('gap', '8');
                    {
                        let field = goog.dom.createDom('field', null, variableList[i]);
                        field.setAttribute('name', 'VAR');
                        block.appendChild(field);
                    }
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
                {
                    // <block type="variables_get" gap="24">
                    //   <field name="VAR">item</field>
                    // </block>
                    let block = goog.dom.createDom('block');
                    block.setAttribute('type', 'variables_change');
                    block.setAttribute('gap', '24');
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

                    xmlList.push(block);
                }
            }
            return xmlList;
        };

        // builtin variables_get
        let msg: any = Blockly.Msg;
        msg.VARIABLES_GET_CREATE_SET = lf("Create 'set %1'");
        installBuiltinHelpInfo('variables_get');

        // builtin variables_set
        msg.VARIABLES_SET = lf("set %1 to %2");
        msg.VARIABLES_DEFAULT_NAME = varname;
        //XXX Do not translate the default variable name.
        //XXX Variable names with Unicode character are harmful at this point.
        msg.VARIABLES_SET_CREATE_GET = lf("Create 'get %1'");
        installBuiltinHelpInfo('variables_set');

        // pxt variables_change
        Blockly.Blocks['variables_change'] = {
            init: function () {
                this.jsonInit({
                    "message0": lf("change %1 by %2"),
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
                    "colour": blockColors['variables']
                });

                setBuiltinHelpInfo(this, 'variables_change');
            }
        };
    }

    function initLogic() {
        let msg: any = Blockly.Msg;

        // builtin controls_if
        msg.CONTROLS_IF_MSG_IF = lf("{id:logic}if");
        msg.CONTROLS_IF_MSG_THEN = lf("{id:logic}then");
        msg.CONTROLS_IF_MSG_ELSE = lf("{id:logic}else");
        msg.CONTROLS_IF_MSG_ELSEIF = lf("{id:logic}else if");
        msg.CONTROLS_IF_TOOLTIP_1 = lf("If a value is true, then do some statements.");
        msg.CONTROLS_IF_TOOLTIP_2 = lf("If a value is true, then do the first block of statements. Otherwise, do the second block of statements.");
        msg.CONTROLS_IF_TOOLTIP_3 = lf("If the first value is true, then do the first block of statements. Otherwise, if the second value is true, do the second block of statements.");
        msg.CONTROLS_IF_TOOLTIP_4 = lf("If the first value is true, then do the first block of statements. Otherwise, if the second value is true, do the second block of statements. If none of the values are true, do the last block of statements.");
        installBuiltinHelpInfo('controls_if');

        // builtin logic_compare
        msg.LOGIC_COMPARE_TOOLTIP_EQ = lf("Return true if both inputs equal each other.");
        msg.LOGIC_COMPARE_TOOLTIP_NEQ = lf("Return true if both inputs are not equal to each other.");
        msg.LOGIC_COMPARE_TOOLTIP_LT = lf("Return true if the first input is smaller than the second input.");
        msg.LOGIC_COMPARE_TOOLTIP_LTE = lf("Return true if the first input is smaller than or equal to the second input.");
        msg.LOGIC_COMPARE_TOOLTIP_GT = lf("Return true if the first input is greater than the second input.");
        msg.LOGIC_COMPARE_TOOLTIP_GTE = lf("Return true if the first input is greater than or equal to the second input.");
        installBuiltinHelpInfo('logic_compare');

        // builtin logic_operation
        msg.LOGIC_OPERATION_AND = lf("{id:op}and");
        msg.LOGIC_OPERATION_OR = lf("{id:op}or");
        msg.LOGIC_OPERATION_TOOLTIP_AND = lf("Return true if both inputs are true."),
            msg.LOGIC_OPERATION_TOOLTIP_OR = lf("Return true if at least one of the inputs is true."),
            installBuiltinHelpInfo('logic_operation');

        // builtin logic_negate
        msg.LOGIC_NEGATE_TITLE = lf("not %1");
        installBuiltinHelpInfo('logic_negate');

        // builtin logic_boolean
        msg.LOGIC_BOOLEAN_TRUE = lf("{id:boolean}true");
        msg.LOGIC_BOOLEAN_FALSE = lf("{id:boolean}false");
        installBuiltinHelpInfo('logic_boolean');
    }

    function initText() {
        // builtin text
        installBuiltinHelpInfo('text');

        // builtin text_length
        let msg: any = Blockly.Msg;
        msg.TEXT_LENGTH_TITLE = lf("length of %1");
        installBuiltinHelpInfo('text_length');
    }

    function initTooltip(blockInfo: pxtc.BlocksInfo) {

        const renderTip = (el: any) => {
            let tip = el.tooltip;
            while (goog.isFunction(tip)) {
                tip = tip();
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
            if (card) {
                const cardEl = pxt.docs.codeCard.render({
                    header: card.description || renderTip(Blockly.Tooltip.element_),
                    typeScript: pxt.blocks.compileBlock(Blockly.Tooltip.element_, blockInfo).source
                })
                Blockly.Tooltip.DIV.appendChild(cardEl);
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
            }
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
    }

    function initExpandToolbox() {
        // The following ensures the flyout is updated is cleared or expanded when the toolbox is updated.

        /**
         * Modify the block tree on the existing toolbox.
         * @param {Node|string} tree DOM tree of blocks, or text representation of same.
         */
        (Blockly as any).WorkspaceSvg.prototype.updateToolbox = function (tree: any) {
            tree = (Blockly as any).Options.parseToolboxTree(tree);
            if (!tree) {
                if (this.options.languageTree) {
                    throw 'Can\'t nullify an existing toolbox.';
                }
                return;  // No change (null to null).
            }
            if (!this.options.languageTree) {
                throw 'Existing toolbox is null.  Can\'t create new toolbox.';
            }
            if (tree.getElementsByTagName('category').length) {
                if (!this.toolbox_) {
                    throw 'Existing toolbox has no categories.  Can\'t change mode.';
                }
                this.options.languageTree = tree;
                let openNode = this.toolbox_.populate_(tree);
                if (openNode)
                    this.toolbox_.tree_.setSelectedItem(openNode);
                else
                    this.toolbox_.flyout_.hide();
                this.toolbox_.addColour_();
            } else {
                if (!this.flyout_) {
                    throw 'Existing toolbox has categories.  Can\'t change mode.';
                }
                this.options.languageTree = tree;
                this.flyout_.show(tree.childNodes);
            }
        };
    }

    function initToolboxIconPatch() {
        // The following patches the blockly toolbox render logic to include toolbox icons

        /**
         * Sync trees of the toolbox.
         * @param {!Node} treeIn DOM tree of blocks.
         * @param {!Blockly.Toolbox.TreeControl} treeOut
         * @param {string} pathToMedia
         * @return {Node} Tree node to open at startup (or null).
         * @private
         */
        (Blockly as any).Toolbox.prototype.syncTrees_ = function (treeIn: any, treeOut: any, pathToMedia: any) {
            let openNode: any = null;
            let lastElement: any = null;
            for (let i = 0, childIn: any; childIn = treeIn.childNodes[i]; i++) {
                if (!childIn.tagName) {
                    // Skip over text.
                    continue;
                }
                switch (childIn.tagName.toUpperCase()) {
                    case 'CATEGORY':
                        let childOut = this.tree_.createNode(childIn.getAttribute('name'));
                        childOut.blocks = [];
                        treeOut.add(childOut);
                        let custom = childIn.getAttribute('custom');
                        if (custom) {
                            // Variables and procedures are special dynamic categories.
                            childOut.blocks = custom;
                        } else {
                            let newOpenNode = this.syncTrees_(childIn, childOut, pathToMedia);
                            if (newOpenNode) {
                                openNode = newOpenNode;
                            }
                        }
                        let colour = childIn.getAttribute('colour');
                        if ((goog as any).isString(colour)) {
                            if (colour.match(/^#[0-9a-fA-F]{6}$/)) {
                                childOut.hexColour = colour;
                            } else {
                                childOut.hexColour = Blockly.hueToRgb(colour);
                            }
                            this.hasColours_ = true;
                        } else {
                            childOut.hexColour = '';
                        }
                        let iconClass = childIn.getAttribute('iconclass');
                        if ((goog as any).isString(iconClass)) {
                            childOut.setIconClass(this.config_['cssTreeIcon'] + ' ' + iconClass);
                        }
                        let expandedClass = childIn.getAttribute('expandedclass');
                        if ((goog as any).isString(expandedClass)) {
                            childOut.setExpandedIconClass(this.config_['cssTreeIcon'] + ' ' + expandedClass);
                        }
                        if (childIn.getAttribute('expanded') == 'true') {
                            if (childOut.blocks.length) {
                                // This is a category that directly contians blocks.
                                // After the tree is rendered, open this category and show flyout.
                                openNode = childOut;
                            }
                            childOut.setExpanded(true);
                        } else {
                            childOut.setExpanded(false);
                        }
                        lastElement = childIn;
                        break;
                    case 'SEP':
                        if (lastElement) {
                            if (lastElement.tagName.toUpperCase() == 'CATEGORY') {
                                // Separator between two categories.
                                // <sep></sep>
                                treeOut.add(new (Blockly as any).Toolbox.TreeSeparator(
                                    this.treeSeparatorConfig_));
                            } else {
                                // Change the gap between two blocks.
                                // <sep gap="36"></sep>
                                // The default gap is 24, can be set larger or smaller.
                                // Note that a deprecated method is to add a gap to a block.
                                // <block type="math_arithmetic" gap="8"></block>
                                let newGap = parseFloat(childIn.getAttribute('gap'));
                                if (!isNaN(newGap) && lastElement) {
                                    lastElement.setAttribute('gap', newGap);
                                }
                            }
                        }
                        break;
                    case 'BLOCK':
                    case 'SHADOW':
                    case 'LABEL':
                    case 'BUTTON':
                        treeOut.blocks.push(childIn);
                        lastElement = childIn;
                        break;
                }
            }
            return openNode;
        };
    }

    export function fadeColour(hex: string, luminosity: number, lighten: boolean): string {
        // #ABC => ABC
        hex = hex.replace(/[^0-9a-f]/gi, '');

        // ABC => AABBCC
        if (hex.length < 6)
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];

        // tweak
        let rgb = "#";
        for (let i = 0; i < 3; i++) {
            let c = parseInt(hex.substr(i * 2, 2), 16);
            c = Math.round(Math.min(Math.max(0, lighten ? c + (c * luminosity) : c - (c * luminosity)), 255));
            let cStr = c.toString(16);
            rgb += ("00" + cStr).substr(cStr.length);
        }

        return rgb;
    }
}
