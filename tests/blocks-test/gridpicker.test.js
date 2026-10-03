const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

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
loadFunctions("pxtblocks/fields/field_gridpicker.ts", ["getGridPickerTags", "filterGridPickerOptions", "getGridPickerGroups", "getGridPickerSizeOptions"]);
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
const sizedCatalog = { ...catalog, tabs: catalog.tabs.concat(materialTab) };
assert.strictEqual(context.exports.getGridPickerSizeOptions(options, sizedCatalog).length, 10);
assert.deepStrictEqual(options.map(option => option[1]), [
    "Item.CopperSword", "Item.IronSword", "Item.CopperPickaxe", "MonsterMob.Zombie", "MonsterMob.Husk", "AnimalMob.Chicken", "Item.Other"
]);
assert.deepStrictEqual(summarize(groups(options, catalog, catalog.tabs[1], "missing")), [{ id: "all", values: [] }]);
assert.deepStrictEqual(options.map(option => option[1]), [
    "Item.CopperSword", "Item.IronSword", "Item.CopperPickaxe", "MonsterMob.Zombie", "MonsterMob.Husk", "AnimalMob.Chicken", "Item.Other"
]);
console.log("PASS: grid picker legacy values, hard tag filters, optional/excluded tags, families, material search, and flat Search scope.");