import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import { FieldGridPicker, FieldGridPickerOptions, filterGridPickerOptions, getGridPickerGroups, getGridPickerRows, getGridPickerSizeRows } from "../../pxtblocks/fields/field_gridpicker";

describe("grid picker catalogs", () => {
    const options: Blockly.MenuOption[] = [
        ["Copper Sword", "Item.CopperSword"], ["Iron Sword", "Item.IronSword"],
        ["Copper Pickaxe", "Item.CopperPickaxe"], ["Zombie", "MonsterMob.Zombie"],
        ["Husk", "MonsterMob.Husk"], ["Chicken", "AnimalMob.Chicken"], ["Other", "Item.Other"]
    ];
    const tags = {
        "Item.CopperSword": ["EQUIPMENT", "sword", "copper"],
        "Item.IronSword": ["equipment", "sword", "iron"],
        "Item.CopperPickaxe": ["equipment", "pickaxe", "copper"],
        "MonsterMob.Zombie": ["RIDER", "undead"], "MonsterMob.Husk": ["?rider"],
        "AnimalMob.Chicken": ["mount"]
    };
    const catalog: pxt.GridPickerCatalog = {
        name: "Inventory",
        tabs: [{ id: "equipment", name: "Equipment", tags: ["equipment"] }, { id: "search", name: "All", flat: true }],
        groups: [{ id: "swords", name: "Swords", tags: ["sword"] }, { id: "pickaxes", name: "Pickaxes", tags: ["pickaxe"] }]
    };
    const emptyInfo: pxtc.BlocksInfo = {
        apis: { byQName: {}, jres: {} }, blocks: [], blocksById: {}, enumsByName: {}, kindsByName: {}
    };
    const image: Blockly.ImageProperties = {
        src: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
        width: 16, height: 16, alt: "Picture"
    };
    let workspace: Blockly.WorkspaceSvg;
    let container: HTMLDivElement;
    let previousInfo: pxtc.BlocksInfo;
    let previousLanguage: string;

    beforeEach(() => {
        previousInfo = pxtblockly.cachedBlockInfo;
        previousLanguage = pxt.Util.userLanguage();
        pxtblockly.initialize(emptyInfo);
        Blockly.Blocks.test_grid_picker = { init() { this.setColour("#444444"); } };
        container = document.createElement("div");
        container.style.width = "800px";
        container.style.height = "600px";
        document.body.appendChild(container);
        workspace = Blockly.inject(container, {});
    });

    afterEach(() => {
        Blockly.WidgetDiv.hide();
        workspace.dispose();
        container.remove();
        delete Blockly.Blocks.test_grid_picker;
        pxtblockly.injectBlocks(previousInfo || emptyInfo);
        pxt.Util.setUserLanguage(previousLanguage);
    });

    function open(extra: Partial<FieldGridPickerOptions> = {}, value = "") {
        const field = new FieldGridPicker(value, { data: options, optionTags: tags, columns: "2", blocksInfo: emptyInfo, ...extra });
        const block = workspace.newBlock("test_grid_picker");
        block.RTL = pxt.Util.isUserLanguageRtl();
        block.appendDummyInput().appendField(field, "choice");
        block.initSvg();
        block.render();
        field["showEditor_"]();
        return { field, popup: Blockly.WidgetDiv.getDiv() };
    }

    function withCatalog(value: pxt.GridPickerCatalog): Partial<FieldGridPickerOptions> {
        return {
            catalog: "test.catalog",
            blocksInfo: {
                ...emptyInfo,
                apis: { ...emptyInfo.apis, jres: {
                    "test.catalog": { id: "test.catalog", data: "", mimeType: "application/x-makecode-grid-picker", gridPickerCatalog: value }
                } }
            }
        };
    }

    function cells(popup: HTMLElement): HTMLElement[] {
        return Array.from(popup.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    }

    function values(entries: Blockly.MenuOption[]): string[] {
        return entries.map(option => option[1]);
    }

    it("applies shared tag rules without discarding saved options or explicit defaults", () => {
        chai.assert.deepEqual(values(filterGridPickerOptions(options, "rider !undead", tags)), ["MonsterMob.Husk"]);
        const { field, popup } = open({ filter: "rider" });
        chai.assert.equal(field.getValue(), "MonsterMob.Zombie");
        chai.assert.deepEqual(cells(popup).map(cell => cell.dataset.value), ["MonsterMob.Zombie", "MonsterMob.Husk"]);
        chai.assert.deepEqual(values(field.getOptions()), values(options));
        field.setValue("AnimalMob.Chicken");
        chai.assert.equal(field.getValue(), "AnimalMob.Chicken");
        Blockly.WidgetDiv.hide();
        const explicit = open({ filter: "rider" }, "AnimalMob.Chicken").field;
        chai.assert.equal(explicit.getValue(), "AnimalMob.Chicken");
    });

    it("normalizes search punctuation in names, values and tags", () => {
        for (const search of ["copper-sword", "copper_sword"]) {
            const result = getGridPickerGroups(options, catalog, catalog.tabs[1], search, undefined, tags);
            chai.assert.deepEqual(result.reduce((all, group) => all.concat(values(group.options)), [] as string[]), ["Item.CopperSword"]);
        }
        const result = getGridPickerGroups(options, catalog, catalog.tabs[1], "group_zombies", undefined,
            { ...tags, "MonsterMob.Zombie": ["group-zombies"] });
        chai.assert.deepEqual(result.reduce((all, group) => all.concat(values(group.options)), [] as string[]), ["MonsterMob.Zombie"]);
    });

    it("keeps loose choices and collision-free remainder groups when categories are optional", () => {
        const loose = getGridPickerGroups(options, { ...catalog, groups: undefined }, catalog.tabs[0], "", undefined, tags);
        chai.assert.deepEqual(loose.reduce((all, group) => all.concat(values(group.options)), [] as string[]), values(options.slice(0, 3)));
        const groups = getGridPickerGroups(options, { ...catalog, groups: [{ id: "other", name: "Copper", tags: ["copper"] }] },
            catalog.tabs[0], "", undefined, tags);
        chai.assert.deepEqual(groups.map(group => group.id), ["other", "_other"]);
        chai.assert.deepEqual(groups.map(group => values(group.options)), [["Item.CopperSword", "Item.CopperPickaxe"], ["Item.IronSword"]]);
    });

    it("orders weighted groups and choices while retaining stable ties", () => {
        const weighted = { ...catalog, groups: [{ ...catalog.groups[0], weight: 20 }, { ...catalog.groups[1], weight: 80 }] };
        const groups = getGridPickerGroups(options, weighted, catalog.tabs[0], "", undefined, tags,
            { "Item.CopperSword": 0, "Item.IronSword": 100 });
        chai.assert.deepEqual(groups.map(group => values(group.options)), [
            ["Item.CopperPickaxe"], ["Item.IronSword", "Item.CopperSword"]
        ]);
    });

    it("renders mixed image and text choices and clears the image in text previews", () => {
        const { field, popup } = open({ data: [[image, "picture"], ["Text", "text"]] });
        const [picture, text] = cells(popup);
        chai.assert.equal(picture.querySelector("img").alt, image.alt);
        chai.assert.isNull(text.querySelector("img"));
        chai.assert.include(text.textContent, "Text");
        field["createSelectedBar_"]();
        field["updateSelectedBar_"](image, "picture");
        chai.assert.notEqual(field["selectedImg_"].style.display, "none");
        field["updateSelectedBar_"]("Text", "text");
        chai.assert.equal(field["selectedImg_"].style.display, "none");
        chai.assert.equal(field["selectedBarText_"].textContent, "Text");
    });

    it("falls back to the filtered picker when no catalog tab is eligible", () => {
        const { popup } = open({ ...withCatalog({ name: "Empty", tabs: [catalog.tabs[0]] }), filter: "rider" });
        chai.assert.isNotNull(popup.querySelector('[role="grid"]'));
        chai.assert.deepEqual(cells(popup).map(cell => cell.dataset.value), ["MonsterMob.Zombie", "MonsterMob.Husk"]);
    });

    it("reports missing and invalid catalogs once rather than once per field", () => {
        const reportError = pxt.reportError;
        const errors: { message: string; catalog: string | number }[] = [];
        pxt.reportError = (_category, message, data) => { errors.push({ message, catalog: data?.catalog }); };
        try {
            for (const settings of [
                withCatalog(JSON.parse('{"name":"Broken","tabs":null}')),
                { catalog: "test.missing" }
            ]) {
                for (let i = 0; i < 3; i++) {
                    open(settings);
                    Blockly.WidgetDiv.hide();
                }
            }
            chai.assert.lengthOf(errors, 2);
            chai.assert.equal(errors.find(error => error.catalog === "test.catalog")?.message, "Invalid catalog metadata");
            chai.assert.equal(errors.find(error => error.catalog === "test.missing")?.message, "Catalog resource not found");
        } finally {
            pxt.reportError = reportError;
        }
    });

    it("focuses an available choice without replacing a value outside the active tab", () => {
        const { field, popup } = open(withCatalog({ ...catalog, tabs: [catalog.tabs[0]] }), "AnimalMob.Chicken");
        const table = popup.querySelector('[role="treegrid"]');
        chai.assert.equal(table.getAttribute("aria-activedescendant"), cells(popup)[0].id);
        chai.assert.include(cells(popup)[0].textContent, catalog.groups[0].name);
        chai.assert.equal(field.getValue(), "AnimalMob.Chicken");
    });

    it("assigns each choice to one group and emits unique search results", () => {
        const overlapping = {
            ...catalog,
            tabs: [{ id: "equipment", name: "Equipment" }],
            groups: [{ id: "metal", name: "Metal", tags: ["equipment"] }, { id: "copper", name: "Copper", tags: ["copper"] }]
        };
        const { field, popup } = open(withCatalog(overlapping));
        chai.assert.equal(Object.values(field["catalogGroups_"]).filter(group =>
            group.options.some(option => option[1] === "Item.CopperSword")).length, 1);
        const search = popup.querySelector<HTMLInputElement>('input[type="search"]');
        search.value = "copper";
        search.dispatchEvent(new Event("input"));
        chai.assert.deepEqual(cells(popup).map(cell => cell.dataset.value), ["Item.CopperSword", "Item.CopperPickaxe"]);
        chai.assert.equal(popup.querySelectorAll('[aria-selected="true"][role="gridcell"]').length, 1);
        chai.assert.equal(field.getValue(), "Item.CopperSword");
    });

    it("keeps parent tag constraints when switching tabs and searching", () => {
        const { popup } = open({ ...withCatalog({
            ...catalog, tabs: [{ id: "undead", name: "Undead", tags: ["undead"] }, catalog.tabs[1]]
        }), filter: "rider" });
        chai.assert.deepEqual(cells(popup).map(cell => cell.dataset.value), ["MonsterMob.Zombie"]);
        const tabs = popup.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabs[1].click();
        chai.assert.deepEqual(cells(popup).map(cell => cell.dataset.value), ["MonsterMob.Zombie", "MonsterMob.Husk"]);
        const search = popup.querySelector<HTMLInputElement>('input[type="search"]');
        search.value = "copper";
        search.dispatchEvent(new Event("input"));
        chai.assert.lengthOf(cells(popup), 0);
        chai.assert.isFalse(popup.querySelector('[role="treegrid"]').hasAttribute("aria-activedescendant"));
    });

    it("uses explicit symbol icons ahead of resource icons and resolves encoded aliases", async () => {
        const { field } = open();
        const palette = pxt.appTarget.runtime.palette;
        pxt.appTarget.runtime.palette = new Array<string>(16).fill("#000000");
        field["blocksInfo_"].apis = { byQName: {
            "images.picture": symbol("images.picture", "", "assets.picture", "api-icon")
        }, jres: {
            "assets.picture": { id: "assets.picture", mimeType: "image/png", data: "", icon: "resource-icon" },
            "assets.encoded": { id: "assets.encoded", mimeType: "image/x-mkcd-f4",
                data: pxt.sprite.base64EncodeBitmap(new pxt.sprite.Bitmap(1, 1).data()) }
        } };
        try {
            chai.assert.equal(field["catalogIcon_"]("images.picture"), "api-icon");
            chai.assert.equal(field["catalogIcon_"]("assets.picture"), "resource-icon");
            field["blocksInfo_"].apis.byQName["images.encoded"] = symbol("images.encoded", "", "assets.encoded");
            const icon = new Image();
            icon.src = field["catalogIcon_"]("images.encoded");
            await icon.decode();
            chai.assert.equal(icon.naturalWidth, 1);
            chai.assert.equal(icon.naturalHeight, 1);
        } finally {
            pxt.appTarget.runtime.palette = palette;
            field["blocksInfo_"].apis = { byQName: {}, jres: {} };
        }
    });

    for (const rtl of [false, true]) {
        it(`keeps keyboard navigation scoped to expanded groups (${rtl ? "RTL" : "LTR"})`, () => {
            pxt.Util.setUserLanguage(rtl ? "ar" : "en");
            const { field, popup } = open(withCatalog(catalog));
            const table = popup.querySelector<HTMLElement>('[role="treegrid"]');
            const parent = cells(popup)[0];
            parent.click();
            const expanded = cells(popup).find(cell => cell.getAttribute("aria-expanded") === "true");
            chai.assert.isDefined(expanded);
            for (const id of expanded.getAttribute("aria-controls").split(" ")) {
                chai.assert.isNotNull(document.getElementById(id));
            }
            const children = cells(popup).filter(cell => !cell.hasAttribute("aria-expanded"));
            const first = children.find(cell => cell.dataset.value === "Item.CopperSword");
            const last = children.find(cell => cell.dataset.value === "Item.IronSword");
            function arrow(key: string, from: HTMLElement, expected: HTMLElement) {
                field["activeDescendantIndex"] = cells(popup).indexOf(from);
                table.dispatchEvent(new KeyboardEvent("keydown", { code: key, key, bubbles: true }));
                chai.assert.equal(table.getAttribute("aria-activedescendant"), expected.id);
            }
            arrow("ArrowDown", last, last);
            arrow("ArrowUp", first, expanded);
            arrow("ArrowDown", expanded, first);
            arrow(rtl ? "ArrowRight" : "ArrowLeft", first, first);
            arrow(rtl ? "ArrowLeft" : "ArrowRight", first, last);
            arrow(rtl ? "ArrowLeft" : "ArrowRight", last, last);
            chai.assert.equal(field.getValue(), "Item.CopperSword");
        });
    }

    it("preserves flat-picker navigation and saved values without a catalog", () => {
        const { field, popup } = open();
        const table = popup.querySelector<HTMLElement>('[role="grid"]');
        const choices = cells(popup);
        field["activeDescendantIndex"] = 1;
        table.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight", key: "ArrowRight", bubbles: true }));
        chai.assert.equal(table.getAttribute("aria-activedescendant"), choices[2].id);
        table.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowDown", key: "ArrowDown", bubbles: true }));
        chai.assert.equal(table.getAttribute("aria-activedescendant"), choices[4].id);
        chai.assert.equal(field.getValue(), "Item.CopperSword");
        chai.assert.isNull(choices[0].parentElement.getAttribute("aria-level"));
    });

    it("renders children on separate rows without disturbing other parent choices", () => {
        const groups = getGridPickerGroups(options, catalog, catalog.tabs[0], "", undefined, tags);
        const entries = groups.map(group => ({ option: group.options[0], group }));
        const rows = getGridPickerRows(entries, 2, new Set([groups[0].id]));
        chai.assert.deepEqual(rows[0].entries.map(entry => entry.group.id), groups.map(group => group.id));
        chai.assert.deepEqual(rows.slice(1).reduce((all, row) => all.concat(row.entries.map(entry => entry.option[1])), [] as string[]),
            values(groups[0].options));
        chai.assert.isAtLeast(getGridPickerSizeRows(options, catalog, 2, tags).length, rows.length);
    });
});

function symbol(qName: string, tags: string, jres: string, iconURL?: string): pxtc.SymbolInfo {
    return {
        qName, name: qName.split(".").pop(), namespace: qName.slice(0, qName.lastIndexOf(".")),
        kind: pxtc.SymbolKind.Variable, fileName: "test.ts", retType: "Image", parameters: [],
        attributes: { callingConvention: 0, paramDefl: {}, tags, jres, iconURL }
    };
}

describe("image gallery tag filtering", () => {
    let ImageFieldEditor: typeof import("../../webapp/src/components/ImageFieldEditor").ImageFieldEditor;

    before(async () => {
        await import("../../webapp/src/app");
        ImageFieldEditor = (await import("../../webapp/src/components/ImageFieldEditor")).ImageFieldEditor;
    });

    it("merges existing, API and aliased-resource tags for actual gallery asset IDs", () => {
        const jres = pxt.inflateJRes({
            bird: { id: "assets.bird", mimeType: "image/x-mkcd-f4",
                data: pxt.sprite.base64EncodeBitmap(new pxt.sprite.Bitmap(1, 1).data()), tags: ["bird"] }
        });
        const project = new pxt.TilemapProject();
        project.loadAssetsJRes(jres, true);
        const editor = new ImageFieldEditor({ singleFrame: true, editorType: "image" });
        editor.state = { ...editor.state, options: {}, galleryFilter: "playable collectible" };
        editor["blocksInfo"] = {
            apis: { jres, byQName: {
                "images.bird": symbol("images.bird", "playable", "assets.bird"),
                "images.alias": symbol("images.alias", "collectible BIRD", "assets.bird")
            } },
            blocks: [], blocksById: {}, enumsByName: {}, kindsByName: {}
        };
        const assets = project.getGalleryAssets(pxt.AssetType.Image);
        chai.assert.deepEqual(assets.map(asset => asset.id), ["assets.bird"]);
        const result = editor["filterAssetsByType"](assets, pxt.AssetType.Image, false, true);
        chai.assert.deepEqual(result.map(asset => asset.id), ["assets.bird"]);
        chai.assert.deepEqual(result[0].meta.tags, ["bird", "playable", "collectible"]);
        const tags = pxt.sprite.getSymbolTagsById(editor["blocksInfo"].apis);
        chai.assert.deepEqual(tags["images.bird"], ["playable", "bird"]);
        chai.assert.sameMembers(tags["assets.bird"], ["playable", "bird", "collectible"]);
    });
});
