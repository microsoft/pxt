const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "../..");
const context = vm.createContext({ exports: {}, pxt: { sprite: {}, Util: { lf: text => text } } });

function loadFunctions(file, names) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const declarations = [];
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && names.includes(node.name.text)) declarations.push(node.getText(source));
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.strictEqual(declarations.length, names.length);
    vm.runInContext(ts.transpileModule(declarations.join("\n"), {
        fileName: "gridpicker-check.ts",
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 }
    }).outputText, context);
}

loadFunctions("pxtlib/spriteutils.ts", ["filterItems"]);
context.pxt.sprite.filterItems = context.exports.filterItems;
loadFunctions("pxtblocks/fields/field_gridpicker.ts", ["getGridPickerTags", "filterGridPickerOptions", "getGridPickerGroups", "getGridPickerRows", "getGridPickerSizeRows"]);
loadFunctions("pxtblocks/loader.ts", ["getSymbolPickerTags"]);

const cliSource = ts.createSourceFile("cli.ts", fs.readFileSync(path.join(root, "cli/cli.ts"), "utf8"), ts.ScriptTarget.Latest, true);
let catalogStringsLoop;
function findCatalogStringsLoop(node) {
    if (ts.isForOfStatement(node) && node.expression.getText(cliSource).includes("cfg.runtime?.gridPickerCatalogs")) catalogStringsLoop = node;
    ts.forEachChild(node, findCatalogStringsLoop);
}
findCatalogStringsLoop(cliSource);
assert(catalogStringsLoop, "Target string extraction must include grid picker catalogs");
context.cfg = { runtime: { gridPickerCatalogs: { inventory: {
    name: "Inventory", tabs: [{ name: "Construction" }, { name: "All" }],
    families: [{ name: "Hoes" }], materials: [{ name: "Copper" }], filters: [{ name: "Riders" }]
}, mounts: { name: "Player Mounts", tabs: [{ name: "Vehicles" }] } } } };
context.targetStrings = {};
vm.runInContext(ts.transpileModule(catalogStringsLoop.getText(cliSource), {
    compilerOptions: { target: ts.ScriptTarget.ES2017 }
}).outputText, context);
for (const name of ["Inventory", "Construction", "All", "Hoes", "Copper", "Riders", "Player Mounts", "Vehicles"]) {
    assert.strictEqual(context.targetStrings[name], name, `Missing configured localization key: ${name}`);
}

const info = { apis: { jres: { "MonsterMob.Zombie": { tags: ["RIDER"] } } } };
assert.deepStrictEqual(Array.from(context.getSymbolPickerTags(info, {
    qName: "MonsterMob.Zombie", attributes: { jres: "true", tags: "undead" }
})), ["undead", "rider"]);
assert.deepStrictEqual(Array.from(context.getSymbolPickerTags(info, {
    qName: "riding.Rider.Zombie", attributes: { jres: "MonsterMob.Zombie" }
})), ["rider"]);

const options = [
    [{ alt: "Copper Sword", tags: ["EQUIPMENT", "sword", "copper"] }, "Item.CopperSword"],
    [{ alt: "Iron Sword", tags: ["equipment", "sword", "iron"] }, "Item.IronSword"],
    [{ alt: "Copper Pickaxe", tags: ["equipment", "pickaxe", "copper"] }, "Item.CopperPickaxe"],
    [{ alt: "Zombie", tags: ["RIDER", "undead"] }, "MonsterMob.Zombie"],
    [{ alt: "Husk", tags: ["?rider"] }, "MonsterMob.Husk"],
    [{ alt: "Chicken", tags: ["mount"] }, "AnimalMob.Chicken"],
    ["Other", "Item.Other"]
];
const filter = context.exports.filterGridPickerOptions;
const values = query => Array.from(filter(options, query), option => option[1]);
assert.strictEqual(filter(options, ""), options);
assert.deepStrictEqual(values("rider"), ["MonsterMob.Zombie", "MonsterMob.Husk"]);
assert.deepStrictEqual(values("rider undead"), ["MonsterMob.Zombie"]);
assert.deepStrictEqual(values("rider !undead"), ["MonsterMob.Husk"]);
assert.deepStrictEqual(values("mount"), ["AnimalMob.Chicken"]);
assert.deepStrictEqual(values("unknown"), []);
assert.deepStrictEqual(Array.from(filter(options, "custom", { "Item.Other": ["custom"] }), option => option[1]), ["Item.Other"]);

const catalog = {
    name: "Inventory",
    tabs: [{ id: "equipment", name: "Equipment", tags: ["equipment"] }, { id: "search", name: "All", flat: true }],
    families: [{ id: "swords", name: "Swords", tags: ["sword"] }, { id: "pickaxes", name: "Pickaxes", tags: ["pickaxe"] }],
    materials: [{ id: "copper", name: "Copper", tags: ["copper"] }, { id: "iron", name: "Iron", tags: ["iron"] }]
};
const groups = context.exports.getGridPickerGroups;
const summarize = result => JSON.parse(JSON.stringify(result.map(group => ({ id: group.id, values: group.options.map(option => option[1]) }))));
assert.deepStrictEqual(summarize(groups(options, catalog, catalog.tabs[0], "")), [
    { id: "swords", values: ["Item.CopperSword", "Item.IronSword"] },
    { id: "pickaxes", values: ["Item.CopperPickaxe"] }
]);
assert.deepStrictEqual(summarize(groups(options, catalog, catalog.tabs[0], "copper sword")), [
    { id: "swords", values: ["Item.CopperSword"] }
]);
assert.deepStrictEqual(summarize(groups(filter(options, "rider"), catalog, catalog.tabs[1], "")), [
    { id: "all", values: ["MonsterMob.Zombie", "MonsterMob.Husk"] }
]);
const materialTab = { id: "materials", name: "Materials", materials: true };
assert.deepStrictEqual(summarize(groups(options.slice(0, 3), catalog, materialTab, "")), [
    { id: "copper", values: ["Item.CopperSword", "Item.CopperPickaxe"] },
    { id: "iron", values: ["Item.IronSword"] }
]);
assert.deepStrictEqual(summarize(groups(options, catalog, materialTab, "copper")), [
    { id: "copper", values: ["Item.CopperSword", "Item.CopperPickaxe"] }
]);
assert.deepStrictEqual(summarize(groups(options, catalog, materialTab, "", "iron")), [
    { id: "iron", values: ["Item.IronSword"] }
]);
assert.deepStrictEqual(summarize(groups(options, catalog, materialTab, "other")), [
    { id: "other", values: ["Item.Other"] }
]);
assert.deepStrictEqual(summarize(groups(options.slice(0, 3).reverse(), catalog, materialTab, "")), [
    { id: "copper", values: ["Item.CopperSword", "Item.CopperPickaxe"] },
    { id: "iron", values: ["Item.IronSword"] }
]);
assert.deepStrictEqual(summarize(groups(options.slice(0, 3).reverse(), catalog, catalog.tabs[0], "")), [
    { id: "swords", values: ["Item.CopperSword", "Item.IronSword"] },
    { id: "pickaxes", values: ["Item.CopperPickaxe"] }
]);
const orderedCatalog = {
    ...catalog,
    families: [{ ...catalog.families[0], order: ["Item.IronSword", "Item.CopperSword"] }]
};
assert.deepStrictEqual(summarize(groups(options, orderedCatalog, catalog.tabs[0], "")), [
    { id: "swords", values: ["Item.IronSword", "Item.CopperSword"] },
    { id: "other", values: ["Item.CopperPickaxe"] }
]);
assert.deepStrictEqual(summarize(groups(options.slice(0, 3).reverse(), orderedCatalog, catalog.tabs[0], "")),
    summarize(groups(options, orderedCatalog, catalog.tabs[0], "")));
const partialOrder = { ...catalog, families: [{ ...catalog.families[0], order: ["Item.IronSword"] }] };
assert.deepStrictEqual(summarize(groups(options, partialOrder, catalog.tabs[0], ""))[0],
    { id: "swords", values: ["Item.IronSword", "Item.CopperSword"] });
const sizedCatalog = { ...catalog, tabs: catalog.tabs.concat(materialTab) };
assert.strictEqual(context.exports.getGridPickerSizeRows(options, sizedCatalog, 4).length, 2);
const swords = groups(options, catalog, catalog.tabs[0], "")[0];
const pickaxes = groups(options, catalog, catalog.tabs[0], "")[1];
const familyEntries = [
    { option: ["Swords", "@family:swords"], family: swords },
    { option: ["Pickaxes", "@family:pickaxes"], family: pickaxes },
    { option: ["Other", "Item.Other"] }
];
const rowValues = rows => JSON.parse(JSON.stringify(rows.map(row => ({
    family: row.family?.id,
    values: row.entries.map(entry => entry.option[1])
}))));
assert.deepStrictEqual(rowValues(context.exports.getGridPickerRows(familyEntries, 2, new Set(["swords"]))), [
    { values: ["@family:swords", "@family:pickaxes"] },
    { family: "swords", values: ["Item.CopperSword", "Item.IronSword"] },
    { values: ["Item.Other"] }
]);
assert.deepStrictEqual(rowValues(context.exports.getGridPickerRows(familyEntries, 2, new Set(["pickaxes"]))), [
    { values: ["@family:swords", "@family:pickaxes"] },
    { family: "pickaxes", values: ["Item.CopperPickaxe"] },
    { values: ["Item.Other"] }
]);
assert.deepStrictEqual(rowValues(context.exports.getGridPickerRows([
    { option: ["Swords", "@family:swords"], family: { ...swords, options: options.slice(0, 5) } }
], 2, new Set(["swords"]))), [
    { values: ["@family:swords"] },
    { family: "swords", values: ["Item.CopperSword", "Item.IronSword"] },
    { family: "swords", values: ["Item.CopperPickaxe", "MonsterMob.Zombie"] },
    { family: "swords", values: ["MonsterMob.Husk"] }
]);
const dom = new JSDOM("<!doctype html><html><body></body></html>");
context.document = dom.window.document;
context.window = dom.window;
context.Image = dom.window.Image;
context.pxsim = { U: { removeChildren: element => element.replaceChildren() } };
context.pxt.Util.rlf = text => text;
let rtl = false;
context.pxt.Util.isUserLanguageRtl = () => rtl;
context.pxt.BrowserUtils = {
    addClass: (element, names) => names.split(" ").forEach(name => element.classList.add(name)),
    isMac: () => false
};
context.filterGridPickerOptions = context.exports.filterGridPickerOptions;
context.Blockly = {
    browserEvents: {
        bind: (element, type, owner, handler) => {
            const listener = handler.bind(owner);
            element.addEventListener(type, listener);
            return { element, type, listener };
        },
        unbind: binding => binding.element.removeEventListener(binding.type, binding.listener),
        conditionalBind: () => {}
    },
    WidgetDiv: { getDiv: () => dom.window.document.body }
};
const pickerFile = "pxtblocks/fields/field_gridpicker.ts";
const pickerSource = ts.createSourceFile(pickerFile, fs.readFileSync(path.join(root, pickerFile), "utf8"), ts.ScriptTarget.Latest, true);
const pickerClass = pickerSource.statements.find(node => ts.isClassDeclaration(node) && node.name.text === "FieldGridPicker");
const baseFile = "pxtblocks/fields/field_dropdowngrid.ts";
const baseSource = ts.createSourceFile(baseFile, fs.readFileSync(path.join(root, baseFile), "utf8"), ts.ScriptTarget.Latest, true);
const baseClass = baseSource.statements.find(node => ts.isClassDeclaration(node) && node.name.text === "FieldDropdownGrid");
const baseMethods = ["getGridRowBounds", "getVerticalGridItemIndex", "getHorizontalGridItemIndex", "setFocusedItem", "addKeyDownHandler"];
const baseMethodText = baseClass.members.filter(node => ts.isMethodDeclaration(node) && baseMethods.includes(node.name.text))
    .map(node => node.getText(baseSource));
assert.strictEqual(baseMethodText.length, baseMethods.length);
const methods = ["createWidget_", "populateTableContainer", "populateRow", "getGridRowBounds", "getVerticalGridItemIndex", "getHorizontalGridItemIndex", "createCatalog_", "renderCatalog_", "selectCatalogTab_"];
const methodText = pickerClass.members.filter(node => ts.isMethodDeclaration(node) && methods.includes(node.name.text))
    .map(node => node.getText(pickerSource));
assert.strictEqual(methodText.length, methods.length);
const clickHandler = pickerClass.members.find(node => ts.isPropertyDeclaration(node) && node.name.text === "buttonClickAndClose_");
assert(clickHandler);
vm.runInContext(ts.transpileModule(`class PickerBaseMethods { ${baseMethodText.join("\n")} }
class PickerMethods extends PickerBaseMethods { ${methodText.join("\n")} ${clickHandler.getText(pickerSource)} }
exports.PickerBaseMethods = PickerBaseMethods;
exports.PickerMethods = PickerMethods;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2017 }
}).outputText, context);
const picker = new context.exports.PickerMethods();
picker.catalog_ = catalog;
picker.columns_ = 2;
picker.sourceBlock_ = { id: "block", RTL: false, getColourTertiary: () => "#fff" };
picker.catalogFamilies_ = { "@family:swords": swords, "@family:pickaxes": pickaxes };
picker.catalogChildRowIds_ = {};
picker.catalogExpanded_ = new Set(["swords"]);
picker.getValue = () => "Item.CopperSword";
picker.shouldShowTooltips = () => true;
picker.tooltipConfig_ = { xOffset: 0, yOffset: 0 };
picker.setupIntersectionObserver_ = () => {};
picker.addPointerListener = () => {};
picker.addKeyDownHandler = () => {};
picker.createCatalog_ = container => container.setAttribute("role", "dialog");
picker.getOptions = () => options;
picker.filter_ = "";
picker.hasSearchBar_ = false;
picker.backgroundColour_ = "#fff";
picker.borderColour_ = "#000";
const treegrid = dom.window.document.createElement("div");
picker.createWidget_(treegrid);
assert.strictEqual(treegrid.getAttribute("role"), "treegrid");
picker.populateTableContainer([], treegrid, treegrid, context.exports.getGridPickerRows(familyEntries, 2, picker.catalogExpanded_));
assert.deepStrictEqual(Array.from(treegrid.children, row => ({
    level: row.getAttribute("aria-level"),
    values: Array.from(row.children, cell => cell.dataset.value)
})), [
    { level: "1", values: ["@family:swords", "@family:pickaxes"] },
    { level: "2", values: ["Item.CopperSword", "Item.IronSword"] },
    { level: "1", values: ["Item.Other"] }
]);
assert.strictEqual(treegrid.querySelector('[data-value="@family:swords"]').getAttribute("aria-expanded"), "true");
assert.strictEqual(treegrid.querySelector('[data-value="@family:swords"]').getAttribute("aria-controls"), "block:row-1");
assert(treegrid.children[1].classList.contains("gridpicker-family-children-last"));
assert.strictEqual(treegrid.querySelector('[data-value="@family:swords"]').getAttribute("aria-selected"), "false");
assert.strictEqual(treegrid.querySelector('[data-value="Item.CopperSword"]').getAttribute("aria-selected"), "true");
assert.strictEqual(picker.getVerticalGridItemIndex(1, 1), 3);
assert.strictEqual(picker.getVerticalGridItemIndex(3, 1), 3);
assert.strictEqual(picker.getVerticalGridItemIndex(2, -1), 0);
assert.strictEqual(picker.getVerticalGridItemIndex(3, -1), 0);
assert.strictEqual(picker.getHorizontalGridItemIndex(2, -1), 2);
assert.strictEqual(picker.getHorizontalGridItemIndex(3, 1), 3);
assert.deepStrictEqual(JSON.parse(JSON.stringify(picker.getGridRowBounds(4))), { start: 4, end: 4 });
assert.strictEqual(picker.getVerticalGridItemIndex(4, 1), 4);
assert.strictEqual(picker.getVerticalGridItemIndex(4, -1), 2);
assert.strictEqual(picker.getVerticalGridItemIndex(0, -1), 0);
assert.strictEqual(treegrid.querySelectorAll('[role="gridcell"]').length, 5);
picker.getValue = () => "Item.IronSword";
picker.catalogExpanded_ = new Set();
picker.populateTableContainer([], treegrid, treegrid, context.exports.getGridPickerRows(familyEntries, 2, picker.catalogExpanded_));
assert.strictEqual(treegrid.children.length, 2);
assert.strictEqual(treegrid.querySelector('[data-value="@family:swords"]').getAttribute("aria-expanded"), "false");
assert.strictEqual(treegrid.querySelector('[data-value="@family:swords"]').getAttribute("aria-controls"), null);
assert.strictEqual(treegrid.querySelector('[data-value="@family:swords"]').getAttribute("aria-selected"), "true");
picker.catalogTable_ = treegrid;
picker.renderCatalog_ = () => picker.populateTableContainer([], treegrid, treegrid,
    context.exports.getGridPickerRows(familyEntries, 2, picker.catalogExpanded_));
picker.setFocusedItem_ = () => {};
treegrid.tabIndex = 0;
picker.buttonClickAndClose_("@family:swords");
assert.deepStrictEqual(Array.from(picker.catalogExpanded_), ["swords"]);
assert.strictEqual(picker.gridItems[picker.activeDescendantIndex].dataset.value, "Item.CopperSword");
assert.strictEqual(treegrid.getAttribute("aria-activedescendant"), picker.gridItems[picker.activeDescendantIndex].id);
assert.strictEqual(picker.getValue(), "Item.IronSword");
const largeFamily = { ...swords, options: options.slice(0, 5) };
const scopedEntries = [
    { option: ["Pickaxes", "@family:pickaxes"], family: pickaxes },
    { option: ["Swords", "@family:swords"], family: largeFamily },
    { option: ["Other", "Item.Other"] }
];
picker.catalogFamilies_ = { "@family:swords": largeFamily, "@family:pickaxes": pickaxes };
picker.populateTableContainer([], treegrid, treegrid,
    context.exports.getGridPickerRows(scopedEntries, 2, picker.catalogExpanded_));
context.exports.PickerBaseMethods.prototype.addKeyDownHandler.call(picker, treegrid);
function assertArrow(code, from, expected) {
    picker.activeDescendantIndex = from;
    const event = new dom.window.KeyboardEvent("keydown", { code, key: code, bubbles: true, cancelable: true });
    treegrid.dispatchEvent(event);
    assert.strictEqual(picker.activeDescendantIndex, expected, `${rtl ? "RTL" : "LTR"} ${code} from ${from}`);
    assert.strictEqual(treegrid.getAttribute("aria-activedescendant"), `block:${expected}`);
    assert.strictEqual(event.defaultPrevented, true);
    assert.strictEqual(picker.getValue(), "Item.IronSword");
    assert.deepStrictEqual(Array.from(picker.catalogExpanded_), ["swords"]);
}
assertArrow("ArrowUp", 2, 1);
assertArrow("ArrowUp", 3, 1);
assertArrow("ArrowDown", 1, 2);
assertArrow("ArrowDown", 4, 6);
assertArrow("ArrowDown", 5, 6);
assertArrow("ArrowDown", 6, 6);
assertArrow("ArrowUp", 6, 4);
assertArrow("ArrowLeft", 2, 2);
assertArrow("ArrowRight", 6, 6);
assertArrow("ArrowRight", 3, 4);
assertArrow("ArrowLeft", 4, 3);
assertArrow("ArrowLeft", 1, 0);
context.Blockly.browserEvents.unbind(picker.keyDownBinding);
rtl = true;
context.exports.PickerBaseMethods.prototype.addKeyDownHandler.call(picker, treegrid);
assertArrow("ArrowRight", 2, 2);
assertArrow("ArrowLeft", 6, 6);
assertArrow("ArrowLeft", 3, 4);
assertArrow("ArrowRight", 4, 3);
assertArrow("ArrowUp", 3, 1);
context.Blockly.browserEvents.unbind(picker.keyDownBinding);
rtl = false;
const materialFamily = { ...largeFamily, id: "copper", name: "Copper" };
picker.catalogFamilies_ = { "@family:copper": materialFamily };
picker.catalogExpanded_ = new Set(["copper"]);
picker.populateTableContainer([], treegrid, treegrid, context.exports.getGridPickerRows([
    { option: ["Other", "Item.Other"] },
    { option: ["Copper", "@family:copper"], family: materialFamily }
], 2, picker.catalogExpanded_));
assert.strictEqual(picker.getVerticalGridItemIndex(2, -1), 1);
assert.strictEqual(picker.getHorizontalGridItemIndex(2, -1), 2);
assert.strictEqual(picker.getVerticalGridItemIndex(6, 1), 6);
assert.strictEqual(picker.getHorizontalGridItemIndex(6, 1), 6);
picker.catalogExpanded_ = new Set(["swords"]);
picker.catalogFamilies_ = { "@family:swords": swords, "@family:pickaxes": pickaxes };
picker.renderCatalog_();
picker.buttonClickAndClose_("@family:pickaxes");
assert.deepStrictEqual(Array.from(picker.catalogExpanded_), ["pickaxes"]);
assert.strictEqual(treegrid.children.length, 3);
assert.strictEqual(picker.gridItems[picker.activeDescendantIndex].dataset.value, "Item.CopperPickaxe");
assert.strictEqual(treegrid.querySelector('[data-value="@family:swords"]').getAttribute("aria-expanded"), "false");
picker.buttonClickAndClose_("@family:pickaxes");
assert.strictEqual(picker.catalogExpanded_.size, 0);
assert.strictEqual(picker.gridItems[picker.activeDescendantIndex].dataset.value, "@family:pickaxes");
picker.catalog_ = undefined;
picker.catalogFamilies_ = {};
const legacyGrid = dom.window.document.createElement("div");
picker.createWidget_(legacyGrid);
assert.strictEqual(legacyGrid.getAttribute("role"), "grid");
assert.strictEqual(legacyGrid.querySelector('[role="row"]').hasAttribute("aria-level"), false);
assert.strictEqual(picker.getHorizontalGridItemIndex(0, -1), 0);
assert.strictEqual(picker.getHorizontalGridItemIndex(0, 1), 1);
assert.strictEqual(picker.getHorizontalGridItemIndex(picker.gridItems.length - 1, 1), picker.gridItems.length - 1);
assert.strictEqual(picker.getVerticalGridItemIndex(0, 1), 2);
const constrained = new context.exports.PickerMethods();
Object.assign(constrained, {
    catalog_: {
        name: "Riders",
        tabs: [{ id: "undead", name: "Undead", tags: ["undead"] }, { id: "search", name: "All", flat: true }],
        filters: [{ id: "mount", name: "Mounts", tags: ["mount"] }]
    },
    sourceBlock_: { ...picker.sourceBlock_, id: "constrained" },
    scrollContainer: dom.window.document.createElement("div"),
    catalogColumns_: 2,
    catalogSearch_: "",
    catalogExpanded_: new Set(),
    filter_: "rider",
    getOptions: () => options,
    getValue: () => "MonsterMob.Zombie",
    catalogIcon_: () => undefined,
    positionCatalog_: () => {},
    setupIntersectionObserver_: () => {},
    shouldShowTooltips: () => false,
    tooltipConfig_: { xOffset: 0, yOffset: 0 },
    handleTabKey: () => {}
});
const constrainedContainer = dom.window.document.createElement("div");
const constrainedTable = dom.window.document.createElement("div");
constrained.scrollContainer.appendChild(constrainedTable);
constrainedContainer.appendChild(constrained.scrollContainer);
constrained.createCatalog_(constrainedContainer, constrainedTable);
assert.strictEqual(constrainedContainer.querySelectorAll("select, .gridpicker-catalog-filters").length, 0);
assert.strictEqual(constrainedContainer.textContent.includes("Tags"), false);
assert.deepStrictEqual(Array.from(constrained.gridItems, item => item.dataset.value), ["MonsterMob.Zombie"]);
constrained.selectCatalogTab_("search");
assert.deepStrictEqual(Array.from(constrained.gridItems, item => item.dataset.value), ["MonsterMob.Zombie", "MonsterMob.Husk"]);
constrained.catalogSearch_ = "copper";
constrained.renderCatalog_();
assert.strictEqual(constrained.gridItems.length, 0);
assert(constrainedContainer.textContent.includes("No matching assets"));
context.Blockly.browserEvents.unbind(constrained.tabKeyBind);
assert.deepStrictEqual(options.map(option => option[1]), [
    "Item.CopperSword", "Item.IronSword", "Item.CopperPickaxe", "MonsterMob.Zombie", "MonsterMob.Husk", "AnimalMob.Chicken", "Item.Other"
]);
assert.deepStrictEqual(summarize(groups(options, catalog, catalog.tabs[1], "missing")), [{ id: "all", values: [] }]);
assert.deepStrictEqual(options.map(option => option[1]), [
    "Item.CopperSword", "Item.IronSword", "Item.CopperPickaxe", "MonsterMob.Zombie", "MonsterMob.Husk", "AnimalMob.Chicken", "Item.Other"
]);
console.log("PASS: grid picker filters, groups, scoped LTR/RTL arrow navigation, accessible expansion, and legacy values.");