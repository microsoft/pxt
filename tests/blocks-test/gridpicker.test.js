const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
const context = vm.createContext({ exports: {}, pxt: { sprite: {} } });

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
loadFunctions("pxtblocks/fields/field_gridpicker.ts", ["getGridPickerTags", "filterGridPickerOptions", "getGridPickerGroups"]);
loadFunctions("pxtblocks/loader.ts", ["getSymbolPickerTags"]);

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
    tabs: [{ id: "equipment", name: "Equipment", tags: ["equipment"] }, { id: "search", name: "Search", flat: true }],
    families: [{ id: "swords", name: "Swords", tags: ["sword"] }, { id: "pickaxes", name: "Pickaxes", tags: ["pickaxe"] }]
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
assert.deepStrictEqual(summarize(groups(options, catalog, { id: "materials", name: "Materials", materials: true }, "", "copper")), [
    { id: "swords", values: ["Item.CopperSword"] },
    { id: "pickaxes", values: ["Item.CopperPickaxe"] }
]);
assert.deepStrictEqual(summarize(groups(options, catalog, catalog.tabs[1], "missing")), [{ id: "all", values: [] }]);
assert.deepStrictEqual(options.map(option => option[1]), [
    "Item.CopperSword", "Item.IronSword", "Item.CopperPickaxe", "MonsterMob.Zombie", "MonsterMob.Husk", "AnimalMob.Chicken", "Item.Other"
]);
console.log("PASS: grid picker legacy values, hard tag filters, optional/excluded tags, families, material search, and flat Search scope.");