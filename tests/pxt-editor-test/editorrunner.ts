/// <reference path="../../localtypings/pxteditor.d.ts"/>

/* eslint-disable mocha-no-side-effect-code */
import * as chai from "chai";
import * as dmp from "diff-match-patch";
import * as pxteditor from "../../pxteditor";
import { getTextAtTime, HistoryFile, parseHistoryFile, updateHistory } from "../../pxteditor/history";
import {
    SimxEditorHost,
    SimxEditorRegistration,
} from "../../webapp/src/simxEditorHost";
import {
    getEditorToggleLayout,
    EditorToggleLayoutInput,
} from "../../webapp/src/editorToggleLayout";
import { SimxEditorSimulatorState } from "../../pxtservices/simxeditor";
import {
    addSimulatorThemeToFiles,
    getProjectSimulatorThemePreference,
    getSimulatorThemePresetId,
    removeSimulatorThemeFromFiles,
    resolveSimulatorTheme,
    serializeProjectSimulatorThemePreference,
} from "../../webapp/src/simulatorTheme";
import {
    copySimulatorTheme,
    getSimulatorThemeForLayout,
    getSimulatorThemePreferenceForColorThemeChange,
    isImplicitSimulatorThemePreference,
} from "../../react-common/components/theming/simulatorThemeDefaults";
import { resetEditorThemesAsync } from "../../react-common/components/theming/themeReset";
import { projectToolsPinnedOnLoad, shouldShowProjectTools } from "../../webapp/src/projectToolsState";
import { decodeWhiteboard, MAX_PROJECT_NOTE_LENGTH, ProjectNotesSaveQueue, validateProjectNotes } from "../../webapp/src/projectNotes";
import {
    applyUserEdit,
    isValidRelativeName,
    PROJFS_FOLDER_QUOTA_BYTES,
    PROJFS_NOTIFY_DEBOUNCE_MS,
    PROJFS_RATE_LIMIT,
    PROJFS_RATE_WINDOW_MS,
    ProjfsEditor,
    ProjfsFrame,
    ProjfsHost,
    ProjfsPackage,
    ProjfsPackageFile,
    ProjfsProject,
    writeProjectFileAsync,
} from "../../webapp/src/projfsHost";
import {
    ProjfsClient,
    ProjfsContentReply,
    ProjfsErrorCode,
    ProjfsErrorReply,
    ProjfsNotification,
    ProjfsReply,
    ProjfsRequest,
} from "../../pxtservices/projfs";
import {
    createProjassetsConfig,
    getImageAssets,
    getTileAssets,
    ProjassetsAccountTheme,
    ProjassetsConfig,
    ProjassetsFrame,
    ProjassetsHost,
    ProjassetsOpenProject,
    PROJASSETS_NOTIFY_DEBOUNCE_MS,
} from "../../webapp/src/projassetsHost";
import {
    ProjassetsAssetsReply,
    ProjassetsClient,
    ProjassetsImage,
    ProjassetsNotification,
    ProjassetsReply,
    ProjassetsRequest,
} from "../../pxtservices/projassets";
import {
    getProgramDiagnostics,
    ProjprogramBuild,
    ProjprogramCompileOutcome,
    ProjprogramHost,
    ProjprogramOpenProject,
} from "../../webapp/src/projprogramHost";
import {
    ProjprogramClient,
    ProjprogramErrorCode,
    ProjprogramErrorReply,
    ProjprogramReply,
    ProjprogramRequest,
} from "../../pxtservices/projprogram";
import {
    filterHomeSearchCards,
    getAvailableHomeSearchFilters,
    getHomeSearchFilterOptionCounts,
} from "../../webapp/src/homeSearchFilters";
import { projectMayDeclareBlocks } from "../../webapp/src/cachedApiInfo";
import { getInstanceDropdownOptions, FieldInstanceDropdown } from "../../pxtblocks/fields/field_instancedropdown";
import type { FieldCustomDropdownOptions } from "../../pxtblocks/fields/field_utils";

pxt.appTarget = {
    versions: {
        target: "1"
    },
    appTheme: {
        defaultLocale: "en"
    }
} as any

const differ = new dmp.diff_match_patch();

describe("shared gallery and picker tags", () => {
    it("parses whitespace consistently without losing category label casing", () => {
        chai.expect(pxt.sprite.parseTags("  Sprite\t?HERO\n!tile  ")).deep.equals(["Sprite", "?HERO", "!tile"]);
        chai.expect(pxt.sprite.parseTags(["", " category-Forest ", "hero", "hero"])).deep.equals(["category-Forest", "hero"]);
        chai.expect(pxt.sprite.parseTags(["HERO", "hero", "category-Forest", "category-forest"]))
            .deep.equals(["HERO", "category-Forest"]);
    });

    it("shares case-insensitive positive, optional, and negative constraints", () => {
        const matches = pxt.sprite.compileTagFilter(" HERO\t!tile ");
        chai.expect(matches(["?Hero"])).equals(true);
        chai.expect(matches(["HERO", "TILE"])).equals(false);
        chai.expect(matches([])).equals(false);
        chai.expect(matches(undefined)).equals(false);
        chai.expect(pxt.sprite.compileTagFilter("!tile")([])).equals(true);
        chai.expect(pxt.sprite.compileTagFilter("!tile")(["?tile"])).equals(true);
        chai.expect(pxt.sprite.compileTagFilter("")()).equals(true);
    });

    it("retains the image gallery's any-selected-tag behavior", () => {
        const any = pxt.sprite.compileTagFilter(["hero", "villain"], true);
        const all = pxt.sprite.compileTagFilter(["hero", "villain"]);
        chai.expect(any(["?HERO"])).equals(true);
        chai.expect(any(["villain"])).equals(true);
        chai.expect(all(["hero"])).equals(false);
        chai.expect(all(["hero", "villain"])).equals(true);
    });

    it("merges symbol and referenced-resource tags through the common parser", () => {
        const symbol: pxtc.SymbolInfo = {
            qName: "extension.hero", kind: pxtc.SymbolKind.Variable, name: "hero", namespace: "extension",
            fileName: "test.ts", parameters: [], retType: "Image",
            attributes: { callingConvention: 0, paramDefl: {}, jres: "assets.hero", tags: "hero\tplayable" }
        };
        const apis: pxtc.ApisInfo = {
            byQName: { [symbol.qName]: symbol },
            jres: { "assets.hero": { id: "assets.hero", data: "", mimeType: "image/png", tags: ["?hero", "category-Forest"] } }
        };
        chai.expect(pxt.sprite.getSymbolTags(apis, symbol)).deep.equals(["hero", "playable", "?hero", "category-Forest"]);
        chai.expect(pxt.sprite.filterItems([
            { qName: "hero", src: "", alt: "Hero", tags: ["?HERO"] },
            { qName: "tile", src: "", alt: "Tile", tags: ["hero", "tile"] }
        ], ["hero", "!tile"]).map(item => item.qName)).deep.equals(["hero"]);
    });
});

describe("library-owned picker catalogs", () => {
    function catalogPackage(): pxt.MainPackage {
        const files: pxt.Map<pxt.Map<string>> = {};
        const host: pxt.Host = {
            readFile: (pkg, name) => files[pkg.id]?.[name],
            writeFile: () => { throw new Error("Unexpected catalog test write"); },
            downloadPackageAsync: async () => { throw new Error("Unexpected catalog test download"); },
            getHexInfoAsync: async () => { throw new Error("Unexpected native compilation"); },
            cacheStoreAsync: async () => {},
            cacheGetAsync: async () => undefined
        };
        const main = new pxt.MainPackage(host);
        main.config = { name: "main", files: [], dependencies: { alpha: "*", beta: "*" } };
        main.isLoaded = true;
        for (const id of ["alpha", "beta"]) {
            const dep = new pxt.Package(id, "*", main, main, id);
            dep.config = { name: id, files: ["pickers.jres"], dependencies: {} };
            dep.isLoaded = true;
            files[id] = { "pickers.jres": JSON.stringify({
                "*": { namespace: `${id}.pickers`, mimeType: "application/x-makecode-grid-picker" },
                icons: { gridPickerCatalog: {
                    name: "Images",
                    tabs: [{ id: "all", name: "All", flat: true, weight: 0 }, { id: "animals", name: "Animals", tags: ["animal"], weight: 80 }],
                    groups: [{ id: "birds", name: "Birds", tags: ["bird"] }],
                    filters: [{ id: "playable", name: "Playable", tags: ["playable"] }]
                } }
            }) };
            main.deps[id] = dep;
        }
        return main;
    }

    it("loads independent catalogs from multiple extension packages without target configuration", () => {
        const resources = catalogPackage().getJRes();
        chai.expect(pxt.getGridPickerCatalog(resources, "alpha.pickers.icons").name).equals("Images");
        chai.expect(pxt.getGridPickerCatalog(resources, "beta.pickers.icons").groups[0].name).equals("Birds");
        chai.expect(pxt.getGridPickerCatalog(resources, "missing")).equals(undefined);
        chai.expect(Object.keys(resources)).contains("alpha.pickers.icons").and.contains("beta.pickers.icons");
    });

    describe("picker weight ordering", () => {
        it("uses descending toolbox-style weights with stable default priorities", () => {
            const items = [
                { id: "default" }, { id: "zero", weight: 0 }, { id: "high", weight: 100 },
                { id: "negative", weight: -10 }, { id: "explicitDefault", weight: 50 }, { id: "highTie", weight: 100 }
            ];
            const original = items.slice();
            chai.expect(pxt.sprite.sortByWeight(items, item => item.weight).map(item => item.id))
                .deep.equals(["high", "highTie", "default", "explicitDefault", "zero", "negative"]);
            chai.expect(items).deep.equals(original);
        });

        it("resolves JRES weights through aliases before falling back to symbol annotations", () => {
            const symbol: pxtc.SymbolInfo = {
                qName: "extension.hero", kind: pxtc.SymbolKind.Variable, name: "hero", namespace: "extension",
                fileName: "test.ts", parameters: [], retType: "Image",
                attributes: { callingConvention: 0, paramDefl: {}, jres: "assets.hero", weight: 90 }
            };
            const apis: pxtc.ApisInfo = {
                byQName: { [symbol.qName]: symbol },
                jres: { "assets.hero": { id: "assets.hero", data: "", mimeType: "image/png", weight: 0 } }
            };
            chai.expect(pxt.sprite.getSymbolWeight(apis, symbol.qName)).equals(0);
            delete apis.jres["assets.hero"].weight;
            chai.expect(pxt.sprite.getSymbolWeight(apis, symbol.qName)).equals(90);
            apis.jres["assets.hero"].weight = -5;
            chai.expect(pxt.sprite.getSymbolWeight(apis, symbol.qName)).equals(-5);
            chai.expect(pxt.sprite.getSymbolWeight(apis, "missing")).equals(undefined);
            const inflated = pxt.inflateJRes(JSON.parse('{"*":{"namespace":"weighted"},"entry":{"weight":0}}'));
            chai.expect(inflated["weighted.entry"].weight).equals(0);
        });
    });

    it("does not turn picker metadata into image or JSON gallery assets", () => {
        const resources = catalogPackage().getJRes();
        const assets = new pxt.TilemapProject();
        assets.loadAssetsJRes(resources, true);
        chai.expect(assets.getGalleryAssets(pxt.AssetType.Image)).to.have.length(0);
        chai.expect(assets.getGalleryAssets(pxt.AssetType.Json)).to.have.length(0);
    });

    it("localizes extension-owned titles independently and restores untranslated names", async () => {
        const main = catalogPackage();
        const resources = main.getJRes();
        const before = JSON.stringify(resources);
        const apis: pxtc.ApisInfo = { byQName: {}, jres: resources };
        const oldLanguage = pxt.Util.userLanguage();
        main.localizationStringsAsync = async lang => lang === "de" ? {
            "alpha.pickers.icons|gridPicker|Images": "Bilder"
        } : ({
            "alpha.pickers.icons|gridPicker|Animals": "Alpha animals",
            "beta.pickers.icons|gridPicker|Animals": "Beta animals",
            "alpha.pickers.icons|gridPicker|Birds": "Alpha birds",
            "alpha.pickers.icons|gridPicker|Playable": "Alpha playable"
        });
        try {
            pxt.Util.setUserLanguage("fr");
            await pxtc.localizeApisAsync(apis, main);
            const alpha = pxt.getGridPickerCatalog(resources, "alpha.pickers.icons");
            const beta = pxt.getGridPickerCatalog(resources, "beta.pickers.icons");
            chai.expect(alpha.tabs[0].name).equals("Alpha animals");
            chai.expect(beta.tabs[0].name).equals("Beta animals");
            chai.expect(alpha.groups[0].name).equals("Alpha birds");
            chai.expect(alpha.filters[0].name).equals("Alpha playable");
            chai.expect(alpha.tabs[1].name).equals("All");
            pxt.Util.setUserLanguage("de");
            await pxtc.localizeApisAsync(apis, main);
            chai.expect(pxt.getGridPickerCatalog(resources, "alpha.pickers.icons").name).equals("Bilder");
            chai.expect(pxt.getGridPickerCatalog(resources, "alpha.pickers.icons").tabs[0].name).equals("Animals");
            chai.expect(pxt.getGridPickerCatalog(resources, "beta.pickers.icons").tabs[0].name).equals("Animals");
            pxt.Util.setUserLanguage("en");
            await pxtc.localizeApisAsync(apis, main);
            chai.expect(pxt.getGridPickerCatalog(resources, "alpha.pickers.icons").tabs[0].name).equals("Animals");
            chai.expect(JSON.stringify(resources)).equals(before);
        } finally {
            pxt.Util.setUserLanguage(oldLanguage);
        }
    });

    it("only reads resource-qualified catalog keys from the package dictionary", async () => {
        const main = catalogPackage();
        const resources = main.getJRes();
        const apis: pxtc.ApisInfo = { byQName: {}, jres: resources };
        const oldLanguage = pxt.Util.userLanguage();
        const getTranslation = pxtc.getBlockTranslationsCacheKey;
        const lookedUp: string[] = [];
        // Package dictionaries also hold JSDoc under bare API names, which must not become labels.
        main.localizationStringsAsync = async () => ({
            "Images": "Documentation for an API named Images",
            "Animals": "Documentation for an API named Animals",
            "All": "Documentation for an API named All",
            "Birds": "Documentation for an API named Birds",
            "Playable": "Documentation for an API named Playable",
            "alpha.pickers.icons|gridPicker|Birds": "Alpha birds"
        });
        try {
            pxt.Util.setUserLanguage("fr");
            await pxtc.localizeApisAsync(apis, main);
            chai.expect(getTranslation("Animals")).equals("Documentation for an API named Animals");
            pxtc.getBlockTranslationsCacheKey = key => {
                lookedUp.push(key);
                return getTranslation(key);
            };
            const alpha = pxt.getGridPickerCatalog(resources, "alpha.pickers.icons");
            chai.expect(alpha.name).equals("Images");
            chai.expect(alpha.tabs[0].name).equals("Animals");
            chai.expect(alpha.tabs[1].name).equals("All");
            chai.expect(alpha.groups[0].name).equals("Alpha birds");
            chai.expect(alpha.filters[0].name).equals("Playable");
            chai.expect(lookedUp).deep.equals([
                "alpha.pickers.icons|gridPicker|Images",
                "alpha.pickers.icons|gridPicker|All",
                "alpha.pickers.icons|gridPicker|Animals",
                "alpha.pickers.icons|gridPicker|Birds",
                "alpha.pickers.icons|gridPicker|Playable"
            ]);
        } finally {
            pxtc.getBlockTranslationsCacheKey = getTranslation;
            pxt.Util.setUserLanguage("en");
            await pxtc.localizeApisAsync(apis, main);
            pxt.Util.setUserLanguage(oldLanguage);
        }
    });

    it("retains former target-string translations as a fallback", () => {
        const resources = catalogPackage().getJRes();
        const oldRlf = pxt.Util.rlf;
        try {
            pxt.Util.rlf = text => text === "Animals" ? "Existing target translation" : text;
            chai.expect(pxt.getGridPickerCatalog(resources, "alpha.pickers.icons").tabs[0].name)
                .equals("Existing target translation");
        } finally {
            pxt.Util.rlf = oldRlf;
        }
    });

    it("ignores malformed catalogs without blocking API localization", async () => {
        const main = catalogPackage();
        const resources = main.getJRes();
        const invalid = [
            { name: "Broken" },
            { name: "Broken", tabs: null },
            { name: "Broken", tabs: {} },
            { name: "Broken", tabs: "invalid" },
            { name: "Broken", tabs: Array.of<unknown>(null) },
            { name: "Broken", tabs: new Array<unknown>(), groups: {} },
            ...["tabs", "groups", "filters"].reduce((catalogs, collection) =>
                catalogs.concat([{}, [1], ["valid", 1]].map(tags => ({
                    name: "Broken",
                    tabs: [{ id: "valid", name: "Valid" }],
                    [collection]: [{ id: "invalid", name: "Invalid", tags }]
                }))), new Array<unknown>())
        ];
        invalid.forEach((catalog, index) => {
            resources["invalid." + index] = JSON.parse(JSON.stringify({
                id: "invalid." + index, mimeType: "application/x-makecode-grid-picker", data: "", gridPickerCatalog: catalog
            }));
        });
        const apis: pxtc.ApisInfo = { byQName: {}, jres: resources };
        const original = JSON.stringify(resources);
        const oldLanguage = pxt.Util.userLanguage();
        const oldReportError = pxt.reportError;
        const reported: string[] = [];
        pxt.reportError = (category, message) => { reported.push(category + ": " + message); };
        main.localizationStringsAsync = async () => ({
            "alpha.pickers.icons|gridPicker|Animals": "Localized animals"
        });
        try {
            for (const language of ["en", "fr", "en"]) {
                pxt.Util.setUserLanguage(language);
                chai.expect(await pxtc.localizeApisAsync(apis, main)).equals(apis);
                for (const index of invalid.keys()) {
                    const id = "invalid." + index;
                    chai.expect(pxt.getGridPickerCatalogStrings(id, resources[id].gridPickerCatalog)).deep.equals({});
                    chai.expect(pxt.getGridPickerCatalog(resources, id)).equals(undefined);
                }
                chai.expect(pxt.getGridPickerCatalog(resources, "alpha.pickers.icons").tabs[0].name)
                    .equals(language === "fr" ? "Localized animals" : "Animals");
            }
            chai.expect(reported.length).equals(invalid.length);
            chai.expect(JSON.stringify(resources)).equals(original);
        } finally {
            pxt.reportError = oldReportError;
            pxt.Util.setUserLanguage(oldLanguage);
        }
    });
});

describe("gallery code cards", () => {
    it("parses comma-separated tags and search terms as arrays", () => {
        const markdownCards = pxt.gallery.parseCodeCards(`
* name: Tagged project
* tags: Community Games, User Input, Sprites
* searchTerms: platformer, jumping, side scroller
`);
        const jsonCards = pxt.gallery.parseCodeCards(JSON.stringify({
            name: "Legacy tagged project",
            tags: "Community Games, User Input, Sprites",
            searchTerms: "platformer, jumping, side scroller"
        }));
        chai.expect(markdownCards[0].tags).deep.equals(["Community Games", "User Input", "Sprites"]);
        chai.expect(markdownCards[0].searchTerms).deep.equals(["platformer", "jumping", "side scroller"]);
        chai.expect(jsonCards[0].tags).deep.equals(["Community Games", "User Input", "Sprites"]);
        chai.expect(jsonCards[0].searchTerms).deep.equals(["platformer", "jumping", "side scroller"]);
    });
});

describe("cached api info", () => {
    it("uses the cache when the project only has generated TypeScript files", () => {
        chai.expect(projectMayDeclareBlocks([
            pxt.CONFIG_NAME,
            pxt.MAIN_BLOCKS,
            pxt.MAIN_TS,
            pxt.TUTORIAL_CODE_START,
            pxt.TUTORIAL_CODE_STOP,
            pxt.TILEMAP_CODE,
            pxt.IMAGES_CODE,
            "README.md"
        ])).equals(false);
    });

    it("uses the cache when the only other TypeScript files are under pxt_modules", () => {
        chai.expect(projectMayDeclareBlocks([pxt.MAIN_TS, "pxt_modules/lib/lib.ts"])).equals(false);
    });

    it("uses the cache when files in folders are not TypeScript", () => {
        chai.expect(projectMayDeclareBlocks([pxt.MAIN_TS, "assets/data.json", "docs/notes.md"])).equals(false);
    });

    it("skips the cache when the project has a top-level TypeScript file", () => {
        chai.expect(projectMayDeclareBlocks([pxt.MAIN_TS, "custom.ts"])).equals(true);
    });

    it("skips the cache when the project has a TypeScript file in a folder", () => {
        chai.expect(projectMayDeclareBlocks([pxt.MAIN_TS, "lib/blocks.ts"])).equals(true);
    });

    it("skips the cache when a folder file shares a generated file's name", () => {
        chai.expect(projectMayDeclareBlocks([pxt.MAIN_TS, "lib/" + pxt.MAIN_TS])).equals(true);
    });
});

function diffText(a: string, b: string) {
    return pxt.diff.computePatch(a, b);
}

function patchText(patch: unknown, a: string) {
    return pxt.diff.applyPatch(a, patch as any)
}

const filename = "main.ts";

describe("project-tools pin defaults", () => {
    it("uses classic side docs instead of project tools in read-only editors", () => {
        chai.expect(shouldShowProjectTools(true, true, false, false, false, true)).equals(true);
        chai.expect(shouldShowProjectTools(true, true, false, false, true, true)).equals(false);
    });

    it("auto-pins initial documentation but preserves explicit pin and unpin choices on reload", () => {
        const header = { id: "same" } as pxt.workspace.Header;
        chai.expect(projectToolsPinnedOnLoad({ home: true }, "new", true, false)).equals(true);
        chai.expect(projectToolsPinnedOnLoad({ home: false }, "new", true, true)).equals(true);
        chai.expect(projectToolsPinnedOnLoad({ home: true }, "new", false, false)).equals(false);
        chai.expect(projectToolsPinnedOnLoad({ header, sideDocsPinned: false }, "same", true, false)).equals(false);
        chai.expect(projectToolsPinnedOnLoad({ header, sideDocsPinned: true }, "same", true, false)).equals(true);
    });
});

describe("private project notes", () => {
    const notesWithBoard = (content: Partial<pxt.workspace.WhiteboardContent> = {}): pxt.workspace.ProjectNotes => ({
        whiteboards: [{ id: "whiteboard-1", name: "Whiteboard 1", text: "", ...content }],
        activeWhiteboardId: "whiteboard-1"
    });

    it("round-trips an odd-height image and rejects corrupt or oversized images", () => {
        const bitmap = new pxt.sprite.Bitmap(3, 5);
        bitmap.set(2, 4, 12);
        const encoded = pxt.sprite.base64EncodeBitmap(bitmap.data());
        chai.expect(decodeWhiteboard(encoded).equals(bitmap)).equals(true);
        chai.expect(() => decodeWhiteboard(encoded.slice(0, -8))).throws();
        chai.expect(() => decodeWhiteboard("A".repeat(45004))).throws("Invalid whiteboard image");
        chai.expect(() => decodeWhiteboard(pxt.sprite.base64EncodeBitmap(new pxt.sprite.Bitmap(257, 1).data()))).throws();
    });

    it("validates immutable note content and rejects unsafe palettes, oversized text and invalid schemas", () => {
        const image = pxt.sprite.base64EncodeBitmap(new pxt.sprite.Bitmap(3, 5).data());
        const original = notesWithBoard({ text: "x".repeat(MAX_PROJECT_NOTE_LENGTH), image, palette: new Array<string>(16).fill("#AbCdEf") });
        Object.freeze(original.whiteboards[0].palette);
        Object.freeze(original.whiteboards[0]);
        Object.freeze(original.whiteboards);
        chai.expect(validateProjectNotes(Object.freeze(original))).deep.equals(original);
        const second = { id: "second", name: "Other", text: "" };
        for (const invalid of [
            { text: "x".repeat(MAX_PROJECT_NOTE_LENGTH + 1) },
            { image: "invalid" },
            { palette: ["#fff"] },
            { palette: new Array<string>(16).fill("url(https://example.com)") },
        ]) {
            chai.expect(() => validateProjectNotes({ ...original, whiteboards: [original.whiteboards[0], { ...second, ...invalid }] })).throws();
        }
        chai.expect(() => validateProjectNotes({ text: "" } as unknown as pxt.workspace.ProjectNotes)).throws();
    });

    it("persists a selected saved snapshot after an older local save settles", async () => {
        const queue = new ProjectNotesSaveQueue();
        const writes: string[] = [];
        let release = () => {};
        const pending = new Promise<void>(resolve => release = resolve);
        const localSave = queue.enqueue(async () => {
            await pending;
            writes.push("local");
        });
        const selectedSave = queue.enqueue(async () => {
            writes.push("saved");
        });

        await Promise.resolve();
        chai.expect(writes).deep.equals([]);
        release();
        await Promise.all([localSave, selectedSave]);
        chai.expect(writes).deep.equals(["local", "saved"]);
    });
});

const simulatorTheme: pxt.SimulatorTheme = {
    "background-color": "#111111",
    "button-stroke": "#222222",
    "text-color": "#333333",
    "button-fill": "#444444",
    "dpad-fill": "#555555",
    "joystick-handle-stroke": "#666666",
    layout: "default",
};

describe("home search filters", () => {
    it("normalizes canonical filter metadata and drops unknown IDs", () => {
        const lineCard = pxt.gallery.parseCodeCards(`
* name: Filtered activity
* activityType: video, resource, movie
* language: blocks, js, typescript
* difficulty: beginner, expert, beginer
* duration: 30-minutes
* targetAge: 9-12, 13-18, teenager
`)[0];
        const jsonCard = pxt.gallery.parseCodeCards(JSON.stringify({
            name: "JSON activity",
            activityType: "project",
            language: ["py", "py", "python"],
            difficulty: "intermediate",
            duration: ["15-minutes", "short"],
            targetAge: ["adult", "adult"],
        }))[0];

        chai.expect(lineCard.activityType).deep.equals(["video", "resource"]);
        chai.expect(lineCard.language).deep.equals(["blocks", "js"]);
        chai.expect(lineCard.difficulty).deep.equals(["beginner", "expert"]);
        chai.expect(lineCard.duration).deep.equals(["30-minutes"]);
        chai.expect(lineCard.targetAge).deep.equals(["9-12", "13-18"]);
        chai.expect(jsonCard.activityType).deep.equals(["project"]);
        chai.expect(jsonCard.language).deep.equals(["py"]);
        chai.expect(jsonCard.difficulty).deep.equals(["intermediate"]);
        chai.expect(jsonCard.duration).deep.equals(["15-minutes"]);
        chai.expect(jsonCard.targetAge).deep.equals(["adult"]);
    });

    it("uses explicit activity type and language values instead of inferred values", () => {
        const card: pxt.CodeCard = {
            name: "JavaScript video",
            cardType: "tutorial",
            editor: "blocks",
            activityType: "video",
            language: "js",
        };
        const filters = getAvailableHomeSearchFilters([card]);
        const byId = pxt.Util.toDictionary(filters, filter => filter.id);

        chai.expect(byId.activityType.options.map(option => option.id)).deep.equals(["video"]);
        chai.expect(byId.language.options.map(option => option.id)).deep.equals(["js"]);
        chai.expect(filterHomeSearchCards([card], {
            activityType: ["tutorial"],
            language: ["blocks"],
        })).deep.equals([]);
        chai.expect(filterHomeSearchCards([card], {
            activityType: ["video"],
            language: ["js"],
        })).deep.equals([card]);
    });

    it("only exposes filter options represented by searchable cards", () => {
        const filters = getAvailableHomeSearchFilters([
            {
                name: "Blocks tutorial",
                cardType: "tutorial",
                editor: "blocks",
                difficulty: ["beginner"],
                otherActions: [{ url: "/tutorial", cardType: "tutorial", editor: "py" }],
            },
            {
                name: "Skillmap",
                cardType: "link",
                url: "https://example.com/--skillmap#intro",
            },
        ]);
        const byId = pxt.Util.toDictionary(filters, filter => filter.id);

        chai.expect(byId.activityType.options.map(option => option.id)).deep.equals(["tutorial", "skillmap"]);
        chai.expect(byId.language.options.map(option => option.id)).deep.equals(["blocks", "py"]);
        chai.expect(byId.difficulty.options.map(option => option.id)).deep.equals(["beginner"]);
        chai.expect(byId.duration).equals(undefined);
        chai.expect(byId.targetAge).equals(undefined);
        chai.expect(byId.activityType.options.some(option => option.id === "extension")).equals(false);
    });

    it("does not infer a language from the card type", () => {
        const unspecifiedTutorial: pxt.CodeCard = {
            name: "Unspecified tutorial",
            cardType: "tutorial",
        };
        const pythonTutorial: pxt.CodeCard = {
            name: "Python tutorial",
            cardType: "tutorial",
            editor: "py",
        };
        const javascriptExample: pxt.CodeCard = {
            name: "JavaScript example",
            cardType: "example",
            editor: "js",
        };
        const filters = getAvailableHomeSearchFilters([
            unspecifiedTutorial,
            pythonTutorial,
            javascriptExample,
        ]);
        const byId = pxt.Util.toDictionary(filters, filter => filter.id);

        chai.expect(byId.language.options.map(option => option.id)).deep.equals(["js", "py"]);
        chai.expect(filterHomeSearchCards([unspecifiedTutorial], { language: ["blocks"] })).deep.equals([]);
        chai.expect(filterHomeSearchCards([pythonTutorial], { language: ["py"] })).deep.equals([pythonTutorial]);
    });

    it("matches any selected value within a filter and every selected filter", () => {
        const cards: pxt.CodeCard[] = [
            { name: "Beginner blocks", cardType: "tutorial", editor: "blocks", difficulty: "beginner", targetAge: ["9-12"] },
            { name: "Beginner Python", cardType: "tutorial", editor: "py", difficulty: "beginner", targetAge: ["13-18"] },
            { name: "Expert Python", cardType: "tutorial", editor: "py", difficulty: "expert", targetAge: ["9-12"] },
        ];
        const matches = filterHomeSearchCards(cards, {
            language: ["blocks", "py"],
            difficulty: ["beginner"],
            targetAge: ["9-12"],
        });

        chai.expect(matches.map(card => card.name)).deep.equals(["Beginner blocks"]);
    });

    it("counts each option against the query candidates and other active filters", () => {
        const queryMatches: pxt.CodeCard[] = [
            { name: "Beginner blocks", cardType: "tutorial", editor: "blocks", difficulty: "beginner", targetAge: ["9-12"] },
            { name: "Beginner Python", cardType: "tutorial", editor: "py", difficulty: "beginner", targetAge: ["13-18"] },
            { name: "Expert Python", cardType: "tutorial", editor: "py", difficulty: "expert", targetAge: ["9-12"] },
        ];
        const counts = getHomeSearchFilterOptionCounts(queryMatches, {
            language: ["blocks", "py"],
            difficulty: ["beginner"],
            targetAge: ["9-12"],
        });

        chai.expect(counts.language.blocks).equals(1);
        chai.expect(counts.language.py).equals(0);
        chai.expect(counts.difficulty.beginner).equals(1);
        chai.expect(counts.difficulty.expert).equals(1);
        chai.expect(counts.targetAge["9-12"]).equals(1);
        chai.expect(counts.targetAge["13-18"]).equals(1);
    });
});

describe("simulator themes", () => {
    const defaultSimulatorTheme = simulatorTheme;
    const purpleSimulatorTheme = { ...simulatorTheme, "background-color": "#660066" };
    const redSimulatorTheme = { ...simulatorTheme, "background-color": "#660000" };
    const tealSimulatorTheme = { ...simulatorTheme };
    const retroSimulatorTheme = { ...simulatorTheme, "background-color": "#FCF7E4", layout: "retro" };
    const presets: pxt.SimulatorThemePreset[] = [
        {
            id: "default",
            name: "Default",
            theme: defaultSimulatorTheme,
        },
        {
            id: "purple",
            name: "Purple",
            theme: purpleSimulatorTheme,
        },
        {
            id: "red",
            name: "Red",
            theme: redSimulatorTheme,
        },
        {
            id: "teal",
            name: "Teal",
            theme: tealSimulatorTheme,
        },
        {
            id: "retro",
            name: "Retro",
            theme: retroSimulatorTheme,
        },
    ];
    const lightTheme = { id: "light", name: "Light", colors: {} };
    const darkTheme = { id: "dark", name: "Dark", colors: {} };
    const tokyoNightTheme = {
        id: "tokyo-night",
        name: "Tokyo Night",
        defaultSimulatorTheme: "purple",
        colors: {},
    };
    const inlineSimulatorTheme = {
        id: "inline",
        name: "Inline",
        defaultSimulatorTheme: {
            "background-color": "#123456",
            layout: "inline",
        },
        colors: {},
    };

    it("loads shared and target translations for skillmaps", async () => {
        const requestedUrls: string[] = [];
        const originalHttpGetJsonAsync = pxt.Util.httpGetJsonAsync;
        pxt.Util.httpGetJsonAsync = <T>(url: string) => {
            requestedUrls.push(url);
            return Promise.resolve({} as T);
        };

        try {
            await pxt.Util.downloadTranslationsAsync(
                "arcade",
                "https://example.com/",
                "fr",
                false,
                ts.pxtc.Util.TranslationsKind.SkillMap
            );
        } finally {
            pxt.Util.httpGetJsonAsync = originalHttpGetJsonAsync;
        }

        chai.expect(requestedUrls).to.include.members([
            "https://example.com/locales/fr/strings.json",
            "https://example.com/locales/fr/target-strings.json",
            "https://example.com/locales/fr/skillmap-strings.json",
        ]);
    });

    it("initializes an empty cloud-synced simulator theme map", () => {
        chai.expect(pxt.auth.DEFAULT_USER_PREFERENCES().simulatorThemes).deep.equals({});
    });

    describe("reset editor-wide themes", () => {
        const target = {
            appTheme: { defaultColorTheme: lightTheme.id },
            colorThemeMap: { light: lightTheme, dark: darkTheme },
            simulator: { themePresets: presets },
        } as Pick<pxt.TargetBundle, "appTheme" | "colorThemeMap" | "simulator">;

        it("saves the configured editor default then clears the simulator preference", async () => {
            const calls: string[] = [];
            const result = await resetEditorThemesAsync(target, async theme => {
                chai.expect(theme).equals(lightTheme);
                calls.push("editor");
            }, async () => { calls.push("simulator"); });

            chai.expect(calls).deep.equals(["editor", "simulator"]);
            chai.expect(result).deep.equals({ presetId: "default", theme: defaultSimulatorTheme });
        });

        it("uses the default editor theme's simulator colors and layout", async () => {
            const configuredTarget = {
                ...target,
                appTheme: { ...target.appTheme, defaultColorTheme: inlineSimulatorTheme.id },
                colorThemeMap: { ...target.colorThemeMap, inline: inlineSimulatorTheme },
            };
            const result = await resetEditorThemesAsync(configuredTarget, async () => {}, async () => {});
            chai.expect(result?.theme).deep.equals({
                ...defaultSimulatorTheme,
                "background-color": "#123456",
                layout: "inline",
            });
        });

        it("preserves project themes instead of replacing them with the editor default", async () => {
            const projectTheme = Object.freeze({ ...retroSimulatorTheme });
            const projectConfig = Object.freeze({ name: "themed project", theme: projectTheme });
            const before = JSON.stringify(projectConfig);
            const result = await resetEditorThemesAsync(target, async () => {}, async () => {});

            chai.expect(JSON.stringify(projectConfig)).equals(before);
            chai.expect(resolveSimulatorTheme(projectConfig.theme, undefined, result?.theme, false))
                .equals(projectTheme);
        });

        it("resets editor preferences even on targets without simulator themes", async () => {
            let simulatorCleared = false;
            const result = await resetEditorThemesAsync({ ...target, simulator: undefined }, async theme => {
                chai.expect(theme).equals(lightTheme);
            }, async () => { simulatorCleared = true; });
            chai.expect(result).equals(undefined);
            chai.expect(simulatorCleared).equals(true);
        });

        it("does not change preferences if the default editor theme is unavailable", async () => {
            let changed = false;
            let failed = false;
            try {
                await resetEditorThemesAsync({ ...target, colorThemeMap: {} },
                    async () => { changed = true; }, async () => { changed = true; });
            } catch {
                failed = true;
            }
            chai.expect(failed).equals(true);
            chai.expect(changed).equals(false);
        });

        it("propagates persistence errors so the confirmation can offer retry", async () => {
            const error = new Error("Unable to save preferences");
            let caught: unknown;
            try {
                await resetEditorThemesAsync(target, async () => {}, async () => { throw error; });
            } catch (err) {
                caught = err;
            }
            chai.expect(caught).equals(error);
        });
    });

    it("uses the user theme only when project and device themes are absent", () => {
        chai.expect(resolveSimulatorTheme(undefined, undefined, simulatorTheme, false)).equals(simulatorTheme);
        chai.expect(resolveSimulatorTheme("project", undefined, simulatorTheme, false)).equals("project");
        chai.expect(resolveSimulatorTheme(undefined, "device", simulatorTheme, false)).equals("device");
    });

    it("lets multiplayer override all other simulator themes", () => {
        chai.expect(resolveSimulatorTheme("project", "device", simulatorTheme, true)).equals(undefined);
    });

    it("adds a simulator theme to a copied share config", () => {
        const files: pxt.workspace.ScriptText = {
            [pxt.CONFIG_NAME]: JSON.stringify({ name: "test", theme: "project" }),
            [pxt.MAIN_TS]: "",
        };
        const sharedFiles = addSimulatorThemeToFiles(files, simulatorTheme);

        chai.expect(JSON.parse(sharedFiles[pxt.CONFIG_NAME]).theme).deep.equals(simulatorTheme);
        chai.expect(JSON.parse(files[pxt.CONFIG_NAME]).theme).equals("project");
    });

    it("matches project themes to built-in presets", () => {
        chai.expect(getSimulatorThemePresetId("DEFAULT", presets)).equals("default");
        chai.expect(getSimulatorThemePresetId({ ...simulatorTheme }, presets)).equals("default");
        chai.expect(getSimulatorThemePresetId({ ...simulatorTheme, layout: "retro" }, presets)).equals("default");
        chai.expect(getSimulatorThemePresetId({ ...simulatorTheme, "button-fill": "#666666" }, presets)).equals(undefined);
        chai.expect(pxt.auth.simulatorThemeColorsEqual(simulatorTheme, { ...simulatorTheme, layout: "retro" })).equals(true);
    });

    it("resolves string project themes to their canonical presets", () => {
        chai.expect(getProjectSimulatorThemePreference("RETRO", presets, defaultSimulatorTheme))
            .deep.equals({ presetId: "retro", theme: retroSimulatorTheme });
    });

    it("preserves unknown string project themes as custom layouts", () => {
        chai.expect(getProjectSimulatorThemePreference("target-layout", presets, defaultSimulatorTheme))
            .deep.equals({
                presetId: "custom",
                theme: { ...defaultSimulatorTheme, layout: "target-layout" },
            });
    });

    it("rejects malformed project theme overrides", () => {
        chai.expect(getProjectSimulatorThemePreference({
            "background-color": "invalid",
        }, presets, defaultSimulatorTheme)).equals(undefined);
    });

    it("serializes canonical project themes by preset ID", () => {
        chai.expect(serializeProjectSimulatorThemePreference({
            presetId: "teal",
            theme: tealSimulatorTheme,
        }, presets)).equals("teal");
    });

    it("serializes independently customized layouts as full themes", () => {
        const preference = {
            presetId: "red",
            theme: { ...redSimulatorTheme, layout: "retro" },
        };
        chai.expect(serializeProjectSimulatorThemePreference(preference, presets))
            .deep.equals(preference.theme);
    });

    it("requires a layout in persisted themes", () => {
        const themeWithoutLayout = { ...simulatorTheme } as Partial<pxt.SimulatorTheme>;
        delete themeWithoutLayout.layout;

        chai.expect(pxt.auth.isValidSimulatorTheme(simulatorTheme)).equals(true);
        chai.expect(pxt.auth.isValidSimulatorTheme(themeWithoutLayout)).equals(false);
    });

    it("accepts sparse themes with target-defined colors", () => {
        chai.expect(pxt.auth.isValidSimulatorTheme({
            "background-color": "#123456",
            "screen-border": "#ABCDEF",
            layout: "target-layout",
        })).equals(true);
    });

    it("rejects malformed simulator theme preferences", () => {
        const invalidColors = ["", "#12345", "#1234567", "123456", "not-a-color"];
        for (const color of invalidColors) {
            chai.expect(pxt.auth.isValidSimulatorTheme({
                ...simulatorTheme,
                "background-color": color,
            }), color).equals(false);
        }

        chai.expect(pxt.auth.isValidSimulatorThemePreference({
            presetId: "default",
            theme: simulatorTheme,
        })).equals(true);
        chai.expect(pxt.auth.isValidSimulatorThemePreference({
            presetId: "",
            theme: simulatorTheme,
        })).equals(false);
    });

    it("uses a color theme's simulator default when no preference is set", () => {
        const result = getSimulatorThemePreferenceForColorThemeChange(
            undefined,
            lightTheme,
            tokyoNightTheme,
            presets
        );

        chai.expect(result).deep.equals({ presetId: "default", theme: purpleSimulatorTheme });
    });

    it("merges an inline color theme simulator default over Default", () => {
        const result = getSimulatorThemePreferenceForColorThemeChange(
            undefined,
            lightTheme,
            inlineSimulatorTheme,
            presets
        );

        chai.expect(result).deep.equals({
            presetId: "default",
            theme: {
                ...defaultSimulatorTheme,
                "background-color": "#123456",
                layout: "inline",
            },
        });
    });

    it("moves between color theme simulator defaults", () => {
        const defaultPreference = { presetId: "default", theme: defaultSimulatorTheme };
        const purplePreference = getSimulatorThemePreferenceForColorThemeChange(
            defaultPreference,
            lightTheme,
            tokyoNightTheme,
            presets
        );
        const restoredPreference = getSimulatorThemePreferenceForColorThemeChange(
            purplePreference,
            tokyoNightTheme,
            lightTheme,
            presets
        );

        chai.expect(purplePreference).deep.equals({ presetId: "default", theme: purpleSimulatorTheme });
        chai.expect(restoredPreference).deep.equals(defaultPreference);
    });

    it("uses the theme's layout while moving between color theme simulator defaults", () => {
        const preference = { presetId: "default", theme: { ...defaultSimulatorTheme, layout: "retro" } };

        chai.expect(getSimulatorThemePreferenceForColorThemeChange(
            preference,
            lightTheme,
            tokyoNightTheme,
            presets
        )).deep.equals({ presetId: "default", theme: purpleSimulatorTheme });
    });

    it("preserves user-selected simulator themes when the color theme changes", () => {
        const preferences = [
            { presetId: "red", theme: redSimulatorTheme },
            { presetId: "purple", theme: purpleSimulatorTheme },
            { presetId: "teal", theme: tealSimulatorTheme },
            { presetId: "custom", theme: { ...simulatorTheme } },
        ];

        for (const preference of preferences) {
            chai.expect(getSimulatorThemePreferenceForColorThemeChange(
                preference,
                lightTheme,
                tokyoNightTheme,
                presets
            )).equals(preference);
        }
    });

    it("does not create a simulator preference between unpinned color themes", () => {
        chai.expect(getSimulatorThemePreferenceForColorThemeChange(
            undefined,
            lightTheme,
            darkTheme,
            presets
        )).equals(undefined);
    });

    it("keeps the existing default between unpinned color themes", () => {
        const defaultPreference = { presetId: "default", theme: defaultSimulatorTheme };

        chai.expect(getSimulatorThemePreferenceForColorThemeChange(
            defaultPreference,
            lightTheme,
            darkTheme,
            presets
        )).equals(defaultPreference);
    });

    it("only treats the Default preset on the Default layout as implicit", () => {
        chai.expect(isImplicitSimulatorThemePreference({
            presetId: "default",
            theme: purpleSimulatorTheme,
        }, presets)).equals(true);
        chai.expect(isImplicitSimulatorThemePreference({
            presetId: "custom",
            theme: defaultSimulatorTheme,
        }, presets)).equals(false);
        chai.expect(isImplicitSimulatorThemePreference({
            presetId: "default",
            theme: { ...defaultSimulatorTheme, layout: "retro" },
        }, presets)).equals(false);
    });

    it("changes layout without changing custom colors", () => {
        const customTheme = { ...simulatorTheme, "background-color": "#ABCDEF" };

        chai.expect(getSimulatorThemeForLayout(customTheme, "retro"))
            .deep.equals({ ...customTheme, layout: "retro" });
    });

    it("fills missing colors declared by a layout", () => {
        const borderField: pxt.SimulatorThemeColorField = {
            property: "screen-border",
            label: "Screen border",
            defaultValue: "#ABCDEF",
        };
        chai.expect(getSimulatorThemeForLayout(simulatorTheme, "retro", [borderField]))
            .deep.equals({ ...simulatorTheme, layout: "retro", "screen-border": "#ABCDEF" });
        chai.expect(getSimulatorThemeForLayout({
            ...simulatorTheme,
            "screen-border": "#123456",
        }, "retro", [borderField])).deep.equals({
            ...simulatorTheme,
            layout: "retro",
            "screen-border": "#123456",
        });
    });

    it("selects the default layout without changing its colors", () => {
        chai.expect(getSimulatorThemeForLayout(retroSimulatorTheme, "default"))
            .deep.equals({ ...retroSimulatorTheme, layout: "default" });
    });

    it("preserves colors for a target-specific layout without a preset", () => {
        chai.expect(getSimulatorThemeForLayout(simulatorTheme, "target-layout"))
            .deep.equals({ ...simulatorTheme, layout: "target-layout" });
    });

    it("copies target-defined colors and ignores reserved or malformed properties", () => {
        const themeWithMalformedProperty = {
            ...simulatorTheme,
            "screen-border": "#ABCDEF",
            skin: "#123456",
            extra: "ignored",
        } as pxt.SimulatorTheme;
        chai.expect(copySimulatorTheme(themeWithMalformedProperty)).deep.equals({
            ...simulatorTheme,
            "screen-border": "#ABCDEF",
        });
    });

    it("removes a simulator theme from an editable shared-project copy", () => {
        const files: pxt.workspace.ScriptText = {
            [pxt.CONFIG_NAME]: JSON.stringify({ name: "test", theme: simulatorTheme }),
            [pxt.MAIN_TS]: "",
        };
        const importedFiles = removeSimulatorThemeFromFiles(files);

        chai.expect(JSON.parse(importedFiles[pxt.CONFIG_NAME]).theme).equals(undefined);
        chai.expect(JSON.parse(files[pxt.CONFIG_NAME]).theme).deep.equals(simulatorTheme);
        chai.expect(importedFiles).not.equals(files);
    });

    it("leaves shared-project files without a simulator theme unchanged", () => {
        const files: pxt.workspace.ScriptText = {
            [pxt.CONFIG_NAME]: JSON.stringify({ name: "test" }),
            [pxt.MAIN_TS]: "",
        };

        chai.expect(removeSimulatorThemeFromFiles(files)).equals(files);
    });
});

describe("sliding window admission", () => {
    it("admits an event over the limit after the window with the default delay", async () => {
        const admission = new pxt.Util.SlidingWindowAdmission(1, 5);
        await admission.admitAsync("folder");
        await admission.admitAsync("folder");
    });
});

describe("projfs guard", () => {
    it("rejects names that are not relative paths or have empty, . or .. segments", () => {
        const names: unknown[] = [
            "", "..", "../x", "a/../b", "a/..", "a\\..\\b", "/abs", "\\abs",
            "a//b", "a/", "./a", "a/./b", ".", 42, undefined, null, ["a"],
        ];
        for (const name of names)
            chai.expect(isValidRelativeName(name), JSON.stringify(name)).equals(false);
    });
});

// lets every queued promise reaction run
function settle() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/** A clock for a host under test, whose delays resolve only as a test advances it. */
class FakeClock {
    time = 1000000;
    private timers: { at: number, resolve: () => void }[] = [];

    now = () => this.time;

    delay = (ms: number) => new Promise<void>(resolve => this.timers.push({ at: this.time + ms, resolve }));

    /** Moves the time forward by `ms`, resolves the delays that have passed, and lets their reactions run. */
    async advance(ms: number) {
        this.time += ms;
        const due = this.timers.filter(t => t.at <= this.time);
        this.timers = this.timers.filter(t => t.at > this.time);
        due.forEach(t => t.resolve());
        await settle();
    }
}

describe("projfs host", () => {
    const FOLDER = "owner/repo";

    class FakeProject implements ProjfsProject {
        calls: string[] = [];
        // when set, each write waits for it before storing
        writeGate: Promise<void> | undefined;

        /** Holds every write until the returned function is called. */
        holdWrites(): () => void {
            let release!: () => void;
            this.writeGate = new Promise<void>(resolve => release = resolve);
            return release;
        }

        constructor(public files: pxt.Map<string>) {
        }

        loadedAsync() {
            return Promise.resolve();
        }

        getFiles() {
            return { ...this.files };
        }

        // like the editor package: a new file is stored and reported, and an existing
        // one is reported only when its content changes
        async writeFileAsync(name: string, content: string) {
            await this.writeGate;
            this.calls.push(`write ${name}`);
            this.storeContent(name, content);
        }

        // like the editor package: the removal is reported, then the pxt.json change
        async deleteFileAsync(name: string) {
            this.calls.push(`delete ${name}`);
            delete this.files[name];
            this.notify(name);
            this.updateListing(name, false);
        }

        async setListedAsync(name: string, listed: boolean) {
            this.calls.push(`${listed ? "list" : "unlist"} ${name}`);
            this.updateListing(name, listed);
        }

        // like the editor package, changes nothing while pxt.json is malformed or lists no files
        private updateListing(name: string, listed: boolean) {
            const config = pxt.Util.jsonTryParse(this.files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
            if (!Array.isArray(config?.files)) return;
            config.files = listed ? [...config.files, name] : config.files.filter(f => f !== name);
            if (!listed && config.testFiles) config.testFiles = config.testFiles.filter(f => f !== name);
            this.storeContent(pxt.CONFIG_NAME, JSON.stringify(config));
        }

        private storeContent(name: string, content: string) {
            const changes = !Object.prototype.hasOwnProperty.call(this.files, name) || this.files[name] !== content;
            this.files[name] = content;
            if (changes) this.notify(name);
        }

        changeListeners = new Set<(name: string | undefined) => void>();

        addChangeListener(listener: (name: string | undefined) => void) {
            this.changeListeners.add(listener);
        }

        removeChangeListener(listener: (name: string | undefined) => void) {
            this.changeListeners.delete(listener);
        }

        private notify(name: string | undefined) {
            this.changeListeners.forEach(listener => listener(name));
        }

        /** Saves `content` to the file `name` as the editor package's setContentAsync does for a user's edit: a new file is listed first. */
        save(name: string, content: string) {
            if (!Object.prototype.hasOwnProperty.call(this.files, name)) {
                this.files[name] = "";
                if (name !== pxt.CONFIG_NAME) this.updateListing(name, true);
            }
            this.storeContent(name, content);
        }

        /** Stores a file as the editor package's setFile does, leaving pxt.json unchanged. */
        setFile(name: string, content: string) {
            this.files[name] = content;
            this.notify(name);
        }

        dirtied: { name: string, content: string | undefined, stored: string | undefined }[] = [];

        markDirty(name: string, content: string | undefined) {
            this.calls.push(`dirty ${name}`);
            this.dirtied.push({ name, content, stored: this.files[name] });
        }

        listed() {
            return (JSON.parse(this.files[pxt.CONFIG_NAME]) as pxt.PackageConfig).files;
        }
    }

    let project: FakeProject;
    let clock: FakeClock;
    let host: ProjfsHost;
    let nextId: number;

    function advance(ms: number) {
        return clock.advance(ms);
    }

    // sends a request without waiting for its reply, which lands in `replies`
    function post(msg: any, replies: ProjfsReply[], key = FOLDER): Promise<void> {
        return host.handleMessageAsync(key, { type: "projfs", id: "" + nextId++, ...msg }, r => replies.push(r as ProjfsReply), testFrame());
    }

    function newProject(files: pxt.Map<string> = {}) {
        return new FakeProject({
            [pxt.CONFIG_NAME]: JSON.stringify({ name: "test", files: [pxt.MAIN_TS, "owner/repo/listed.txt"] }),
            [pxt.MAIN_TS]: "let x = 1",
            [pxt.SIMSTATE_JSON]: "{}",
            "owner/repo/listed.txt": "hello",
            ...files
        });
    }

    async function send(msg: any, key = FOLDER): Promise<ProjfsReply> {
        const replies: ProjfsReply[] = [];
        await host.handleMessageAsync(key, { type: "projfs", id: "" + nextId++, ...msg }, r => replies.push(r as ProjfsReply), testFrame());
        chai.expect(replies.length).equals(1);
        return replies[0];
    }

    async function writeMany(count: number, key = FOLDER) {
        for (let i = 0; i < count; i++)
            await send({ subtype: "write", name: `f${i}.txt`, content: "x" }, key);
    }

    async function expectError(msg: any, code: ProjfsErrorCode, key = FOLDER) {
        const reply = await send(msg, key);
        chai.expect(reply.subtype).equals("error");
        chai.expect((reply as ProjfsErrorReply).code).equals(code);
        return reply as ProjfsErrorReply;
    }

    beforeEach(() => {
        project = newProject();
        clock = new FakeClock();
        nextId = 0;
        host = new ProjfsHost(() => project, clock.now, clock.delay);
    });

    it("reaches no file outside the folder", async () => {
        for (const name of [pxt.MAIN_TS, pxt.CONFIG_NAME, pxt.SIMSTATE_JSON, "owner/repo/listed.txt"])
            await expectError({ subtype: "read", name }, "NOT_FOUND");
    });

    it("writes a new file under the folder and lists it", async () => {
        const reply = await send({ subtype: "write", name: "notes/today.txt", content: "hi" });
        chai.expect(reply).deep.include({ subtype: "ack", name: "notes/today.txt" });
        chai.expect(project.files["owner/repo/notes/today.txt"]).equals("hi");
        chai.expect(project.listed()).deep.equals([pxt.MAIN_TS, "owner/repo/listed.txt", "owner/repo/notes/today.txt"]);
        chai.expect(project.calls).deep.equals(["write owner/repo/notes/today.txt", "list owner/repo/notes/today.txt"]);
    });

    it("refuses writing an asset file, at any depth and letter case, without touching the project", async () => {
        for (const name of ["a.jres", "sub/A.JRES", "a/b/c.jres"]) {
            await expectError({ subtype: "write", name, content: "{}" }, "INVALID_NAME");
        }
        chai.expect(project.calls).deep.equals([]);
    });

    it("stores every write under the frame's folder, whatever the message names", async () => {
        const reply = await send({ subtype: "write", name: "other/repo/x.ts", content: "x", channel: "other/repo", scope: "other/repo" });
        chai.expect(reply).deep.include({ subtype: "ack", name: "other/repo/x.ts" });
        chai.expect(project.files["owner/repo/other/repo/x.ts"]).equals("x");
        chai.expect(Object.keys(project.files).filter(n => n.startsWith("other/"))).deep.equals([]);
    });

    describe("subscriptions", () => {
        /** Subscribes `frame` of `key` and returns what it receives from then on, the subscription's ack checked and cleared. */
        async function subscribe(key = FOLDER, frame: ProjfsFrame = testFrame()): Promise<(ProjfsReply | ProjfsNotification)[]> {
            const received: (ProjfsReply | ProjfsNotification)[] = [];
            await host.handleMessageAsync(key, { type: "projfs", id: "" + nextId++, subtype: "subscribe" }, r => received.push(r), frame);
            chai.expect(received.map(r => r.subtype)).deep.equals(["ack"]);
            received.length = 0;
            return received;
        }

        function changed(...names: string[]): ProjfsNotification {
            return { type: "projfs", subtype: "changed", names };
        }

        /** Advances the clock to the end of the notification window of a change made now, sending the notification it holds. */
        function passNotifyWindow(): Promise<void> {
            return advance(PROJFS_NOTIFY_DEBOUNCE_MS);
        }

        /** Returns a pxt.json listing `names` as well as main.ts. */
        function pxtJson(...names: string[]): string {
            return JSON.stringify({ name: "test", files: [pxt.MAIN_TS, ...names] });
        }

        it("notifies a user's save through the editor package", async () => {
            const received = await subscribe();
            project.save("owner/repo/listed.txt", "edited in the text editor");
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("listed.txt")]);
        });

        it("notifies nothing for changes outside the folder", async () => {
            const received = await subscribe();
            project.save(pxt.MAIN_TS, "let y = 2");
            project.setFile("owner/repo2/sibling.txt", "sibling");
            project.setFile("other/repo/theirs.txt", "theirs");
            project.save(pxt.CONFIG_NAME, pxtJson("owner/repo/listed.txt", "other/repo/theirs.txt"));
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
        });
    });

    describe("quota", () => {
        // what the folder holds before a test writes: listed.txt, its name and its content
        const HELD = pxt.Util.toUTF8Array("listed.txt").length + pxt.Util.toUTF8Array("hello").length;

        it("refuses a write one byte over the quota, whole", async () => {
            const content = "x".repeat(PROJFS_FOLDER_QUOTA_BYTES - HELD - pxt.Util.toUTF8Array("big.txt").length + 1);
            const before = { ...project.files };
            await expectError({ subtype: "write", name: "big.txt", content }, "QUOTA_EXCEEDED");
            chai.expect(project.calls).deep.equals([]);
            chai.expect(project.files).deep.equals(before);
        });
    });

    describe("name rules", () => {
        it("refuses a written name whose last segment is pxt.json, at any depth and in any letter case, without touching the project", async () => {
            for (const name of [pxt.CONFIG_NAME, `sub/${pxt.CONFIG_NAME}`, "a/b/PXT.JSON"])
                await expectError({ subtype: "write", name, content: "{}" }, "INVALID_NAME");
            chai.expect(project.calls).deep.equals([]);
            chai.expect((await send({ subtype: "write", name: `${pxt.CONFIG_NAME}.txt`, content: "{}" })).subtype).equals("ack");
        });
    });

    describe("rate limit", () => {
        it("holds writes and deletes over the limit, unanswered and unapplied, until the window allows them", async () => {
            await writeMany(PROJFS_RATE_LIMIT);
            const replies: ProjfsReply[] = [];
            const held = [
                post({ subtype: "write", name: "extra.txt", content: "x" }, replies),
                post({ subtype: "delete", name: "f0.txt" }, replies),
            ];
            await settle();
            chai.expect(replies).deep.equals([]);
            chai.expect(project.files).not.to.have.property("owner/repo/extra.txt");
            chai.expect(project.files).to.have.property("owner/repo/f0.txt");

            await advance(PROJFS_RATE_WINDOW_MS - 1);
            chai.expect(replies).deep.equals([]);
            await advance(1);
            await Promise.all(held);
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack", "ack"]);
            chai.expect(project.files["owner/repo/extra.txt"]).equals("x");
            chai.expect(project.files).not.to.have.property("owner/repo/f0.txt");
        });
    });

    describe("project switches", () => {
        it("refuses a request whose project closed before its turn, touching neither project", async () => {
            const first = project;
            await writeMany(PROJFS_RATE_LIMIT);
            const replies: ProjfsReply[] = [];
            const held = post({ subtype: "write", name: "extra.txt", content: "x" }, replies);
            project = newProject();
            await advance(PROJFS_RATE_WINDOW_MS);
            await held;
            chai.expect((replies[0] as ProjfsErrorReply).code).equals("PROJECT_CLOSED");
            chai.expect(first.files).not.to.have.property("owner/repo/extra.txt");
            chai.expect(project.calls).deep.equals([]);
        });
    });

    describe("dirty", () => {
        it("passes a flagged write through the edit pipeline after saving and listing it", async () => {
            const reply = await send({ subtype: "write", name: "code.ts", content: "let b = 1", dirty: true });
            chai.expect(reply).deep.include({ subtype: "ack", name: "code.ts" });
            chai.expect(project.calls).deep.equals(["write owner/repo/code.ts", "list owner/repo/code.ts", "dirty owner/repo/code.ts"]);
            chai.expect(project.dirtied).deep.equals([{ name: "owner/repo/code.ts", content: "let b = 1", stored: "let b = 1" }]);
        });

        it("refuses a flagged write whose project closed while it was saved, with the write saved in that project", async () => {
            const first = project;
            const release = first.holdWrites();
            const replies: ProjfsReply[] = [];
            const applying = post({ subtype: "write", name: "a.ts", content: "x", dirty: true }, replies);
            await settle();
            project = newProject();
            release();
            await applying;
            chai.expect((replies[0] as ProjfsErrorReply).code).equals("PROJECT_CLOSED");
            chai.expect(first.files["owner/repo/a.ts"]).equals("x");
            chai.expect(first.dirtied).deep.equals([]);
            chai.expect(project.calls).deep.equals([]);
        });
    });

    // The editor reloads a project by replacing its editor package, whose
    // files arrive from the workspace, as the workspace stored them when the
    // load began, only once the load reads them; until then the package holds
    // no files and no pxt.json. This group drives the host through that load.
    describe("reload window", () => {
        // per project header: the files the workspace stores
        let stored: pxt.Map<pxt.Map<string>>;
        let current: ProjfsProject;

        /**
         * Opens the project stored under `header` as the editor's load does,
         * its project reaching the editor package's files as the webapp's
         * does: a new file is saved on its own, a delete unlists the file and
         * saves every file the package holds, and a pxt.json change saves
         * every file too, and does nothing without a pxt.json.
         */
        function beginLoad(header: string): { finish: () => void } {
            const read = { ...stored[header] };
            const files: pxt.Map<string> = {};
            const loaded = pxt.Util.defer<void>();
            const setListedAsync = async (name: string, listed: boolean) => {
                if (!files[pxt.CONFIG_NAME]) return;
                const config = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                config.files = listed ? [...config.files, name] : config.files.filter(f => f !== name);
                files[pxt.CONFIG_NAME] = JSON.stringify(config);
                stored[header] = { ...files };
            };
            current = {
                getFiles: () => ({ ...files }),
                writeFileAsync: async (name, content) => {
                    files[name] = content;
                    stored[header][name] = content;
                },
                deleteFileAsync: async name => {
                    delete files[name];
                    await setListedAsync(name, false);
                    stored[header] = { ...files };
                },
                setListedAsync,
                loadedAsync: () => loaded.promise,
                addChangeListener: () => { },
                removeChangeListener: () => { },
            };
            return {
                finish: () => {
                    Object.keys(files).forEach(name => delete files[name]);
                    Object.assign(files, read);
                    loaded.resolve(undefined);
                },
            };
        }

        /** The files of a project holding the listed folder files `inFolder`, by relative name. */
        function projectFiles(inFolder: pxt.Map<string>): pxt.Map<string> {
            const names = Object.keys(inFolder).map(name => `${FOLDER}/${name}`);
            const files: pxt.Map<string> = { [pxt.CONFIG_NAME]: JSON.stringify({ name: "test", files: [pxt.MAIN_TS, ...names] }), [pxt.MAIN_TS]: "" };
            Object.keys(inFolder).forEach(name => files[`${FOLDER}/${name}`] = inFolder[name]);
            return files;
        }

        beforeEach(() => {
            stored = { first: projectFiles({ "items.ts": "holds a, b" }) };
            beginLoad("first").finish();
            host = new ProjfsHost(() => current, clock.now, clock.delay);
        });

        it("applies a write that arrives while the project loads once it has loaded, and keeps it", async () => {
            const load = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const answered = post({ subtype: "write", name: "pushed.ts", content: "pushed" }, replies);
            await settle();
            load.finish();
            await answered;
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack"]);
            chai.expect(current.getFiles()[`${FOLDER}/pushed.ts`]).equals("pushed");
            chai.expect(stored.first[`${FOLDER}/pushed.ts`]).equals("pushed");
            chai.expect(((await send({ subtype: "read", name: "pushed.ts" })) as ProjfsContentReply).content).equals("pushed");
            chai.expect(((await send({ subtype: "read", name: "items.ts" })) as ProjfsContentReply).content).equals("holds a, b");
        });
    });
});

describe("projfs user edits", () => {
    class FakeEditor implements ProjfsEditor {
        calls: string[] = [];
        openFile: string | undefined = "owner/repo/code.ts";
        active: "text" | "blocks" | "other" = "text";

        isOpenFile(name: string) {
            return name === this.openFile;
        }

        isTextEditor() {
            return this.active === "text";
        }

        isBlocksEditor() {
            return this.active === "blocks";
        }

        overrideTypescriptFile(text: string) {
            this.calls.push(`override text ${text}`);
        }

        overrideBlocksFile(text: string) {
            this.calls.push(`override blocks ${text}`);
        }

        setSimulatorDirty() {
            this.calls.push("sim dirty");
        }

        typecheckNow() {
            this.calls.push("typecheck");
        }
    }

    let editor: FakeEditor;

    beforeEach(() => {
        editor = new FakeEditor();
    });

    it("replaces the text editor's content when it shows the file, then dirties and typechecks", () => {
        applyUserEdit(editor, "owner/repo/code.ts", "let b = 2");
        chai.expect(editor.calls).deep.equals(["override text let b = 2", "sim dirty", "typecheck"]);
    });
});

describe("projfs project writes", () => {
    class FakeFile implements ProjfsPackageFile {
        writes: { content: string, force: boolean }[] = [];

        constructor(public content: string) {
        }

        async setContentAsync(content: string, force?: boolean) {
            this.content = content;
            this.writes.push({ content, force: !!force });
        }
    }

    class FakePackage implements ProjfsPackage {
        files: pxt.Map<FakeFile> = {
            "owner/repo/code.ts": new FakeFile("let b = 1"),
        };

        setFile(name: string, content: string) {
            this.files[name] = new FakeFile(content);
        }

        async saveFileAsync(name: string) {
        }
    }

    function editorShowing(openFile: string, active: "text" | "blocks" = "text"): ProjfsEditor {
        return {
            isOpenFile: name => name === openFile,
            isTextEditor: () => active === "text",
            isBlocksEditor: () => active === "blocks",
            overrideTypescriptFile: () => { },
            overrideBlocksFile: () => { },
            setSimulatorDirty: () => { },
            typecheckNow: () => { },
        };
    }

    let epkg: FakePackage;

    beforeEach(() => {
        epkg = new FakePackage();
    });

    it("forces the write of the file the text editor shows, so the editor reloads it", async () => {
        await writeProjectFileAsync(epkg, editorShowing("owner/repo/code.ts"), "owner/repo/code.ts", "let b = 2");
        chai.expect(epkg.files["owner/repo/code.ts"].writes).deep.equals([{ content: "let b = 2", force: true }]);
    });
});

// the origin the fake editor's messages come from in the client suites
const EDITOR_ORIGIN = "https://editor.example";

describe("projfs client", () => {
    class FakeParent {
        requests: ProjfsRequest[] = [];

        postMessage(msg: ProjfsRequest, targetOrigin: string) {
            this.requests.push(msg);
        }
    }

    class FakeSelf {
        listeners: ((ev: MessageEvent) => void)[] = [];

        addEventListener(type: "message", listener: (ev: MessageEvent) => void) {
            this.listeners.push(listener);
        }

        removeEventListener(type: "message", listener: (ev: MessageEvent) => void) {
            this.listeners = this.listeners.filter(l => l !== listener);
        }

        deliver(source: unknown, data: unknown, origin: string) {
            this.listeners.forEach(l => l({ source, data, origin } as MessageEvent));
        }
    }

    let parent: FakeParent;
    let self: FakeSelf;
    let client: ProjfsClient;

    function lastRequest() {
        return parent.requests[parent.requests.length - 1];
    }

    function replyTo(request: ProjfsRequest, body: object, source: unknown = parent, origin = EDITOR_ORIGIN) {
        self.deliver(source, { type: "projfs", id: request.id, ...body }, origin);
    }

    beforeEach(() => {
        parent = new FakeParent();
        self = new FakeSelf();
        client = new ProjfsClient({ target: parent, listener: self, search: "" });
    });

    afterEach(() => client.dispose());

    it("ignores replies from another origin while it posts to the editor's origin", async () => {
        client.dispose();
        client = new ProjfsClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example" });
        const read = client.read("main.ts");
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "forged" }, parent, "https://elsewhere.example");
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "real" });
        chai.expect(await read).equals("real");
    });
});

/** Returns a bitmap of the given size whose pixel at (x, y) has color (x + 2y) % 16. */
function testBitmap(width: number, height: number): pxt.sprite.BitmapData {
    const bitmap = new pxt.sprite.Bitmap(width, height);
    for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++)
            bitmap.set(x, y, (x + 2 * y) % 16);
    return bitmap.data();
}

/** Replaces the pixels of `image` with `bitmap`, as the image editor's result does. */
function withBitmap(image: pxt.ProjectImage, bitmap: pxt.sprite.BitmapData): pxt.ProjectImage {
    return { ...image, bitmap, jresData: pxt.sprite.base64EncodeBitmap(bitmap) };
}

describe("tilemap project change listeners", () => {
    let project: pxt.TilemapProject;
    let changes: number;
    const listener = () => changes++;

    beforeEach(() => {
        project = new pxt.TilemapProject();
        project.addProjectChangeListener(listener);
        changes = 0;
    });

    it("hears assets of every kind created, duplicated and removed", () => {
        const steps: [string, () => void][] = [
            ["image", () => project.createNewProjectImage(testBitmap(2, 2), "picture")],
            ["tile", () => project.createNewTile(testBitmap(16, 16), undefined, "grass")],
            ["animation", () => project.createNewAnimationFromData([testBitmap(2, 2)], 100, "walk")],
            ["song", () => project.createNewSong(pxt.assets.music.getEmptySong(2), "tune")],
            ["duplicate", () => project.duplicateAsset(project.getAssets(pxt.AssetType.Image)[0], "copy")],
            ["remove", () => project.removeAsset(project.getAssets(pxt.AssetType.Image)[0])],
        ];
        for (const [name, step] of steps) {
            changes = 0;
            step();
            chai.expect(changes, name).greaterThan(0);
        }
    });

    it("reports a listener that throws, and applies the change and calls the other listeners", () => {
        const reported: unknown[] = [];
        const report = pxt.reportException;
        pxt.reportException = e => { reported.push(e); };
        const throwing = () => { throw new Error("listener failed"); };
        project.removeProjectChangeListener(listener);
        project.addProjectChangeListener(throwing);
        project.addProjectChangeListener(listener);
        try {
            project.createNewProjectImage(testBitmap(2, 2), "hero");
        } finally {
            pxt.reportException = report;
        }
        chai.expect(reported.length).greaterThan(0);
        chai.expect(changes).greaterThan(0);
        chai.expect(project.getAssets(pxt.AssetType.Image).map(i => i.meta.displayName)).deep.equals(["hero"]);
    });
});

/** The pxt.json of a project with no dependencies or files, plus the fields of `extra`. */
function testPxtJson(extra: object = {}): string {
    return JSON.stringify({ name: "test", dependencies: {}, files: [], ...extra });
}

/** A main package whose package host serves `files`, its pxt.json loaded. */
function testMainPackage(files: pxt.Map<string>): pxt.MainPackage {
    const mainPkg = new pxt.MainPackage({ readFile: (_pkg: pxt.Package, name: string) => files[name] } as any);
    mainPkg.loadConfig(true);
    return mainPkg;
}

const TARGET_PALETTE = ["#000000", "#ffffff", "#ff2121", "#ff93c4"];
const PROJECT_PALETTE = ["#000000", "#123456", "#abcdef"];

/** Runs each test with `palette` as the target's palette and `presets` as its simulator theme presets. */
function withTargetVisuals(palette: string[], presets: pxt.SimulatorThemePreset[] | undefined) {
    let saved: { runtime: pxt.RuntimeOptions, simulator: pxt.AppSimulator };
    beforeEach(() => {
        saved = { runtime: pxt.appTarget.runtime, simulator: pxt.appTarget.simulator };
        pxt.appTarget.runtime = { palette: palette.slice() } as pxt.RuntimeOptions;
        pxt.appTarget.simulator = { themePresets: presets } as pxt.AppSimulator;
    });
    afterEach(() => {
        pxt.appTarget.runtime = saved.runtime;
        pxt.appTarget.simulator = saved.simulator;
    });
}

const ACCOUNT_THEME: pxt.SimulatorTheme = { ...simulatorTheme, "background-color": "#0000aa" };
/** The user's simulator theme as the asset host watches it. */
class FakeAccountTheme implements ProjassetsAccountTheme {
    listeners = new Set<() => void>();

    constructor(public theme: pxt.SimulatorTheme = ACCOUNT_THEME) {
    }

    get() {
        return this.theme;
    }

    addChangeListener(listener: () => void) {
        this.listeners.add(listener);
    }

    removeChangeListener(listener: () => void) {
        this.listeners.delete(listener);
    }
}

/** A frame a request comes from, connected to the document. */
function testFrame(): ProjassetsFrame & { isConnected: boolean } {
    return { isConnected: true };
}

const THEME_PRESETS: pxt.SimulatorThemePreset[] = [
    { id: "default", name: "Default", theme: simulatorTheme },
    { id: "purple", name: "Purple", theme: { ...simulatorTheme, "background-color": "#660066" } },
];

describe("projassets image listing", () => {
    let project: pxt.TilemapProject;

    beforeEach(() => {
        project = new pxt.TilemapProject();
    });

    it("describes an image by its asset file id, display name, kind, size and encoded pixels", () => {
        const bitmap = testBitmap(5, 3);
        project.createNewProjectImage(bitmap, "hero");
        const listed = getImageAssets(project);
        chai.expect(listed).deep.equals([{
            kind: "image",
            id: "image1",
            displayName: "hero",
            width: 5,
            height: 3,
            data: pxt.sprite.base64EncodeBitmap(bitmap),
        }]);
        const decoded = pxt.sprite.getBitmapFromJResURL(`data:${pxt.IMAGE_MIME_TYPE};base64,${listed[0].data}`).data();
        chai.expect(pxt.sprite.bitmapEquals(decoded, bitmap)).equals(true);
    });
});

describe("projassets host", () => {
    const SCOPE = "owner/repo";

    withTargetVisuals(TARGET_PALETTE, THEME_PRESETS);

    let project: pxt.TilemapProject | undefined;
    let configFiles: pxt.Map<string>;
    let mainPkg: pxt.MainPackage;
    let accountTheme: FakeAccountTheme;
    let config: ProjassetsConfig;
    let open: ProjassetsOpenProject | undefined;
    let clock: FakeClock;
    let host: ProjassetsHost;
    let nextId: number;

    /** An open project that has loaded. */
    function loadedProject(): ProjassetsOpenProject {
        return { loadedAsync: () => Promise.resolve() };
    }

    beforeEach(() => {
        project = new pxt.TilemapProject();
        project.createNewProjectImage(testBitmap(2, 2), "hero");
        configFiles = { [pxt.CONFIG_NAME]: testPxtJson() };
        mainPkg = testMainPackage(configFiles);
        accountTheme = new FakeAccountTheme();
        config = createProjassetsConfig(mainPkg, accountTheme);
        open = loadedProject();
        clock = new FakeClock();
        host = new ProjassetsHost(() => open, () => project, () => config, clock.now, clock.delay);
        nextId = 0;
    });

    /** Advances the clock to the end of the notification window of a change made now, sending the notification it holds. */
    function passNotifyWindow(): Promise<void> {
        return clock.advance(PROJASSETS_NOTIFY_DEBOUNCE_MS);
    }

    /** Replaces the project's pxt.json with one holding `extra`, and loads it as the editor does after a config edit. */
    function editConfig(extra: object) {
        configFiles[pxt.CONFIG_NAME] = testPxtJson(extra);
        mainPkg.loadConfig(true);
    }

    // sends a request from `frame` whose replies, and notifications if it subscribes, land in `received`
    function post(msg: any, received: (ProjassetsReply | ProjassetsNotification)[], key = SCOPE, frame: ProjassetsFrame = testFrame()): Promise<void> {
        return host.handleMessageAsync(key, { type: "projassets", id: "" + nextId++, ...msg }, r => received.push(r), frame);
    }

    async function send(msg: any): Promise<ProjassetsReply> {
        const received: (ProjassetsReply | ProjassetsNotification)[] = [];
        await post(msg, received);
        chai.expect(received.length).equals(1);
        return received[0] as ProjassetsReply;
    }

    /** Subscribes `frame` of `key`, checks the ack, and returns what the frame receives after it. */
    async function subscribe(key = SCOPE, frame: ProjassetsFrame = testFrame()): Promise<(ProjassetsReply | ProjassetsNotification)[]> {
        const received: (ProjassetsReply | ProjassetsNotification)[] = [];
        await post({ subtype: "subscribe" }, received, key, frame);
        chai.expect(received.map(r => r.subtype)).deep.equals(["ack"]);
        received.length = 0;
        return received;
    }

    const CHANGED = { type: "projassets", subtype: "changed" };

    it("joins each tileset tile to the project's or an extension's tile, and lists an id naming neither alone", async () => {
        const stone = testBitmap(16, 16);
        project.loadAssetsJRes({
            "*": { mimeType: pxt.IMAGE_MIME_TYPE, dataEncoding: "base64", namespace: "castle" },
            stone: { data: pxt.sprite.base64EncodeBitmap(stone), tilemapTile: true },
        } as any, true);
        const grass = testBitmap(16, 16);
        const own = project.createNewTile(grass, undefined, "grass");
        const removed = project.createNewTile(testBitmap(16, 16), undefined, "lava");
        const data = project.blankTilemap(16, 4, 3);
        data.tileset.tiles.push(own, project.resolveTile("castle.stone"), removed);
        project.createNewTilemapFromData(data, "level");
        project.deleteTile(removed.id);
        const reply = await send({ subtype: "list", kind: "tilemap" }) as ProjassetsAssetsReply<"tilemap">;
        chai.expect(reply.assets.length).equals(1);
        const tileset = reply.assets[0].tileset;
        chai.expect(tileset.map(t => t.id)).deep.equals(["myTiles.transparency16", "myTiles.tile1", "castle.stone", "myTiles.tile2"]);
        for (const tile of tileset.slice(0, 3)) {
            chai.expect(Object.keys(tile).sort(), tile.id).deep.equals(["data", "height", "id", "width"]);
            chai.expect([tile.width, tile.height], tile.id).deep.equals([16, 16]);
            chai.expect(tile.data, tile.id).to.be.a("string").and.not.equal("");
        }
        chai.expect(tileset[1].data).equals(pxt.sprite.base64EncodeBitmap(grass));
        chai.expect(tileset[2].data).equals(pxt.sprite.base64EncodeBitmap(stone));
        chai.expect(tileset[3]).deep.equals({ id: "myTiles.tile2" });
        chai.expect(getTileAssets(project).map(t => t.id)).not.to.include("castle.stone");
    });

    describe("subscriptions", () => {
        it("notifies a subscribed extension once after a burst of changes", async () => {
            const received = await subscribe();
            const image = project.getAssets(pxt.AssetType.Image)[0];
            project.updateAsset(withBitmap(image, testBitmap(4, 4)));
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            chai.expect(received).deep.equals([]);
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it("notifies once after the project's palette changes", async () => {
            const received = await subscribe();
            editConfig({ palette: PROJECT_PALETTE });
            chai.expect(received).deep.equals([]);
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
        });
    });

    // The editor reloads a project by replacing its main package and editor
    // package, then loading the new package's files and dependencies; the
    // editor package's asset project is built from the main package on its
    // first use and kept. This group drives the host through that load.
    describe("reload window", () => {
        /** The editor's hold on an open project: its editor package, as the asset host waits on it. */
        interface OpenProject extends ProjassetsOpenProject {
            mainPkg: pxt.MainPackage;
            files: pxt.Map<string>;
            tilemapProject?: pxt.TilemapProject;
        }

        // per project header: the files the workspace stores
        let stored: pxt.Map<pxt.Map<string>>;
        let current: OpenProject;
        let reloadHost: ProjassetsHost;

        // the editor's asset project getter: built from the main package on first use, then kept
        function getTilemapProject(): pxt.TilemapProject {
            if (!current.tilemapProject) {
                current.tilemapProject = new pxt.TilemapProject();
                current.tilemapProject.loadPackage(current.mainPkg);
            }
            return current.tilemapProject;
        }

        /** The files of a project whose asset file holds an image named by each of `names`. */
        function projectFiles(names: string[]): pxt.Map<string> {
            const seed = new pxt.TilemapProject();
            names.forEach((name, i) => seed.createNewProjectImage(testBitmap(i + 2, i + 2), name));
            return {
                [pxt.CONFIG_NAME]: testPxtJson({ files: [pxt.IMAGES_JRES] }),
                [pxt.IMAGES_JRES]: JSON.stringify(seed.getProjectAssetsJRes()),
            };
        }

        /**
         * Opens the project stored under `header` as the editor's load does:
         * the new editor package is open at once, and its files and pxt.json
         * arrive when the returned load is finished, which settles its
         * loadedAsync.
         */
        function beginLoad(header: string): { finish: () => void } {
            const files: pxt.Map<string> = {};
            const mainPkg = new pxt.MainPackage({ readFile: (_pkg: pxt.Package, name: string) => files[name] } as any);
            const loaded = pxt.Util.defer<void>();
            current = { loadedAsync: () => loaded.promise, mainPkg, files };
            return {
                finish: () => {
                    Object.assign(files, stored[header]);
                    mainPkg.loadConfig(true);
                    loaded.resolve(undefined);
                },
            };
        }

        /** The names of the images the editor's asset project holds, which its next asset build writes. */
        function builtImageNames(): string[] {
            return getImageAssets(getTilemapProject()).map(i => i.displayName);
        }

        // sends a request to the reload host; resolves with its one reply
        async function sendReload(msg: any): Promise<ProjassetsReply> {
            const received: (ProjassetsReply | ProjassetsNotification)[] = [];
            await reloadHost.handleMessageAsync(SCOPE, { type: "projassets", id: "" + nextId++, ...msg }, r => received.push(r), testFrame());
            chai.expect(received.length).equals(1);
            return received[0] as ProjassetsReply;
        }

        beforeEach(async () => {
            stored = { first: projectFiles(["hero", "villain"]) };
            beginLoad("first").finish();
            reloadHost = new ProjassetsHost(
                () => current,
                getTilemapProject,
                () => createProjassetsConfig(current.mainPkg, new FakeAccountTheme()),
                clock.now,
                clock.delay);
            chai.expect((await sendReload({ subtype: "subscribe" })).subtype).equals("ack");
        });

        /** Applies a palette to a project as the palette editor does: stores the edited pxt.json, then reloads it into the package. */
        function applyPalette(edited: OpenProject, header: string) {
            const edit = testPxtJson({ files: [pxt.IMAGES_JRES], palette: PROJECT_PALETTE });
            stored[header][pxt.CONFIG_NAME] = edit;
            edited.files[pxt.CONFIG_NAME] = edit;
            edited.mainPkg.loadConfig(true);
        }

        it("keeps every image when a palette change lands while the project reloads", async () => {
            const edited = current;
            const load = beginLoad("first");
            applyPalette(edited, "first");
            await passNotifyWindow();
            chai.expect(current.tilemapProject).equals(undefined);
            load.finish();
            chai.expect(builtImageNames()).deep.equals(["hero", "villain"]);
            chai.expect(Object.keys(getTilemapProject().getProjectAssetsJRes()).filter(k => k !== "*").length).equals(2);

            const listed = await sendReload({ subtype: "list", kind: "image" }) as ProjassetsAssetsReply;
            chai.expect(listed.assets.map(a => a.displayName)).deep.equals(["hero", "villain"]);
            chai.expect(listed.palette).deep.equals(PROJECT_PALETTE);
        });
    });
});

describe("projassets client", () => {
    class FakeParent {
        requests: ProjassetsRequest[] = [];

        postMessage(msg: ProjassetsRequest, targetOrigin: string) {
            this.requests.push(msg);
        }
    }

    class FakeSelf {
        listeners: ((ev: MessageEvent) => void)[] = [];

        addEventListener(type: "message", listener: (ev: MessageEvent) => void) {
            this.listeners.push(listener);
        }

        removeEventListener(type: "message", listener: (ev: MessageEvent) => void) {
            this.listeners = this.listeners.filter(l => l !== listener);
        }

        deliver(source: unknown, data: unknown, origin: string) {
            this.listeners.forEach(l => l({ source, data, origin } as MessageEvent));
        }
    }

    const IMAGE: ProjassetsImage = { kind: "image", id: "image1", displayName: "hero", width: 2, height: 2, data: "AAAA" };
    const NAME = "My Platformer";
    const PALETTE = ["#000000", "#ffffff"];

    let parent: FakeParent;
    let self: FakeSelf;
    let client: ProjassetsClient;

    function lastRequest() {
        return parent.requests[parent.requests.length - 1];
    }

    function replyTo(request: ProjassetsRequest, body: object, source: unknown = parent, origin = EDITOR_ORIGIN) {
        self.deliver(source, { type: "projassets", id: request.id, ...body }, origin);
    }

    beforeEach(() => {
        parent = new FakeParent();
        self = new FakeSelf();
        client = new ProjassetsClient({ target: parent, listener: self, search: "" });
    });

    afterEach(() => client.dispose());

    it("ignores replies from another origin while it posts to the editor's origin", async () => {
        client.dispose();
        client = new ProjassetsClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example" });
        const listed = client.list("image");
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [{ ...IMAGE, id: "forged" }], name: NAME, palette: PALETTE }, parent, "https://elsewhere.example");
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [IMAGE], name: NAME, palette: PALETTE });
        chai.expect((await listed).assets).deep.equals([IMAGE]);
    });
});

/** A promise a test settles when it chooses. */
interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
    let resolve: (value: T) => void;
    let reject: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** A program a test's fake compiler returns, told apart from others by `n`. */
function testProgram(n = 0): ProjprogramBuild {
    return {
        code: `(function () { return ${n}; })`,
        options: { parts: ["led"], fnArgs: {}, mute: false, aspectRatio: 1.22, storedState: { n } } as pxsim.SimulatorRunOptions,
    };
}

/** A compile result holding no simulator JavaScript, with an error in a file and one that concerns no file. */
function failedCompile(): pxtc.CompileResult {
    return {
        success: false,
        times: {},
        breakpoints: [],
        outfiles: {},
        diagnostics: [
            {
                fileName: "main.ts", start: 10, length: 3, line: 2, column: 4,
                code: 2304, category: ts.pxtc.DiagnosticCategory.Error, messageText: "Cannot find name 'foo'.",
            },
            {
                fileName: undefined, start: 0, length: 0,
                code: 9200, category: ts.pxtc.DiagnosticCategory.Warning,
                messageText: { messageText: "outer", category: ts.pxtc.DiagnosticCategory.Warning, code: 9200, next: { messageText: "inner", category: ts.pxtc.DiagnosticCategory.Warning, code: 9201 } } as any,
            },
        ],
    };
}

describe("projprogram host", () => {
    const SCOPE = "owner/repo";

    let open: ProjprogramOpenProject | undefined;
    // the arguments of each call of the compile function, in order
    let compileCalls: unknown[][];
    // what the compile function returns for the call it is given the index of
    let compileImpl: (call: number) => Promise<ProjprogramCompileOutcome>;
    let clock: FakeClock;
    let host: ProjprogramHost;
    let nextId: number;

    /** An open project that has loaded. */
    function loadedProject(): ProjprogramOpenProject {
        return { loadedAsync: () => Promise.resolve() };
    }

    beforeEach(() => {
        open = loadedProject();
        compileCalls = [];
        compileImpl = call => Promise.resolve(testProgram(call));
        clock = new FakeClock();
        host = new ProjprogramHost(() => open, (...args: unknown[]) => {
            compileCalls.push(args);
            return compileImpl(compileCalls.length - 1);
        }, clock.now, clock.delay);
        nextId = 0;
    });

    // sends a request whose reply lands in `received`
    function post(msg: any, received: ProjprogramReply[], key = SCOPE): Promise<void> {
        return host.handleMessageAsync(key, { type: "projprogram", id: "" + nextId++, ...msg }, r => received.push(r));
    }

    async function send(msg: any, key = SCOPE): Promise<ProjprogramReply> {
        const received: ProjprogramReply[] = [];
        await post(msg, received, key);
        chai.expect(received.length).equals(1);
        return received[0];
    }

    async function expectError(msg: any, code: ProjprogramErrorCode, key = SCOPE): Promise<ProjprogramErrorReply> {
        const reply = await send(msg, key);
        chai.expect(reply.subtype).equals("error");
        chai.expect((reply as ProjprogramErrorReply).code).equals(code);
        return reply as ProjprogramErrorReply;
    }

    /** Returns each reply's subtype, or its code for an error. */
    function outcomes(replies: ProjprogramReply[]): string[] {
        return replies.map(r => r.subtype === "error" ? r.code : r.subtype);
    }

    it("replies with the program the compile function returns, under the request's id", async () => {
        const received: ProjprogramReply[] = [];
        await host.handleMessageAsync(SCOPE, { type: "projprogram", id: "abc", subtype: "compile" }, r => received.push(r));
        const program = testProgram(0);
        chai.expect(received).deep.equals([{ type: "projprogram", id: "abc", subtype: "program", code: program.code, options: program.options }]);
    });

    it("replies with COMPILE_FAILED and the compile's diagnostics when the compile produces no program", async () => {
        const failed = failedCompile();
        compileImpl = () => Promise.resolve({ failed });
        const reply = await expectError({ subtype: "compile" }, "COMPILE_FAILED");
        chai.expect(reply.diagnostics).deep.equals(getProgramDiagnostics(failed));
        chai.expect(reply.diagnostics.map(({ message, ...rest }) => rest)).deep.equals([
            { fileName: "main.ts", line: 2, column: 4, code: 2304, category: "error" },
            { code: 9200, category: "warning" },
        ]);
        for (const diagnostic of reply.diagnostics)
            chai.expect(diagnostic.message).to.be.a("string").and.not.equal("");
    });

    describe("project switches", () => {
        it("refuses a request whose project switches during its compile with PROJECT_CLOSED, never sending its program, and refuses the requests queued behind it without compiling", async () => {
            const compile = deferred<ProjprogramCompileOutcome>();
            compileImpl = () => compile.promise;
            const received: ProjprogramReply[] = [];
            const compiling = post({ subtype: "compile" }, received);
            const queued = post({ subtype: "compile" }, received);
            await settle();
            open = loadedProject();
            compile.resolve(testProgram(1));
            await Promise.all([compiling, queued]);
            chai.expect(outcomes(received)).deep.equals(["PROJECT_CLOSED", "PROJECT_CLOSED"]);
            chai.expect(compileCalls.length).equals(1);
        });
    });
});

describe("projprogram client", () => {
    class FakeParent {
        requests: ProjprogramRequest[] = [];

        postMessage(msg: ProjprogramRequest, targetOrigin: string) {
            this.requests.push(msg);
        }
    }

    class FakeSelf {
        listeners: ((ev: MessageEvent) => void)[] = [];

        addEventListener(type: "message", listener: (ev: MessageEvent) => void) {
            this.listeners.push(listener);
        }

        removeEventListener(type: "message", listener: (ev: MessageEvent) => void) {
            this.listeners = this.listeners.filter(l => l !== listener);
        }

        deliver(source: unknown, data: unknown, origin: string) {
            this.listeners.forEach(l => l({ source, data, origin } as MessageEvent));
        }
    }

    const PROGRAM = { code: "(function () {})", options: { parts: ["led"], mute: false } };

    let parent: FakeParent;
    let self: FakeSelf;
    let client: ProjprogramClient;

    function lastRequest() {
        return parent.requests[parent.requests.length - 1];
    }

    function replyTo(request: ProjprogramRequest, body: object, source: unknown = parent, origin = EDITOR_ORIGIN) {
        self.deliver(source, { type: "projprogram", id: request.id, ...body }, origin);
    }

    beforeEach(() => {
        parent = new FakeParent();
        self = new FakeSelf();
        client = new ProjprogramClient({ target: parent, listener: self, search: "" });
    });

    afterEach(() => client.dispose());

    it("ignores replies from another origin while it posts to the editor's origin", async () => {
        client.dispose();
        client = new ProjprogramClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example" });
        const compiled = client.compile();
        replyTo(lastRequest(), { subtype: "program", code: "forged", options: {} }, parent, "https://elsewhere.example");
        replyTo(lastRequest(), { subtype: "program", ...PROGRAM });
        chai.expect(await compiled).deep.equals(PROGRAM);
    });
});

const versions = [
    "Here is some text",
    "Here is some more text", // 100
    "Completely different words", // 200
    "Not sure what to write now", // 300
    "What's important is that I have a lot of versions", // 400
    "Mission accomplished", // 500
    "Or maybe not quite yet", // 600
    "Maybe one more?", // 700
    "That should do it", // 800
];

function checkTimestamp(e: pxteditor.history.HistoryEntry, value: number) {
    chai.expect(e.timestamp).to.equal(value);
}

function checkCollapsedHistory(collapsedProject: pxt.workspace.ScriptText, originalProject: pxt.workspace.ScriptText) {
    const collapsedHistory = parseHistoryFile(collapsedProject[pxt.HISTORY_FILE]);
    const originalHistory = parseHistoryFile(originalProject[pxt.HISTORY_FILE]);

    for (const entry of collapsedHistory.entries) {
        const { files } = getTextAtTime(collapsedProject, collapsedHistory, entry.timestamp, patchText);
        const { files: originalFiles } = getTextAtTime(originalProject, originalHistory, entry.timestamp, patchText);

        chai.expect(files[pxt.MAIN_TS]).equals(originalFiles[pxt.MAIN_TS]);
        chai.expect(files[pxt.MAIN_BLOCKS]).equals(originalFiles[pxt.MAIN_BLOCKS]);
        chai.expect(files[pxt.CONFIG_NAME]).equals(originalFiles[pxt.CONFIG_NAME]);
    }
}

function testDiff(textA: string, textB: string) {
    const dmpPatch = differ.patch_make(textA, textB);
    const ourPatch = pxt.diff.computePatch(textA, textB);

    const dmpResult = differ.patch_apply(dmpPatch, textA)[0];
    const ourDmpResult = pxt.diff.applyPatch(textA, dmpPatch as any);
    const ourPatchResult = pxt.diff.applyPatch(textA, ourPatch);

    chai.expect(ourDmpResult).eq(dmpResult, "did not apply DMP patch correctly");
    chai.expect(ourPatchResult).eq(textB);
}

describe("diffing+patching", () => {
    it("should support the diff-match-patch format", () => {
        const textA = "Hello, my name is richard. I enjoy things";
        const textB = "Goodbye, my name is roberta. I dislike things";
        testDiff(textA, textB);
    });

    it("should handle new line deletions at the end of the file", () => {
        const textA = "Hello, \nmy name is roberta.\nI enjoy things\n";
        const textB = "Goodbye, \nmy name is roberta.\nI dislike things";
        testDiff(textA, textB);
    });

    it("should handle new line deletions at the end of the file when there is more than one", () => {
        const textA = "Hello, \nmy name is roberta.\nI enjoy things\n\n";
        const textB = "Goodbye, \nmy name is roberta.\nI dislike things\n";
        testDiff(textA, textB);
    });

    it("should handle new line deletions at the end of the file", () => {
        const textA = "Hello, \nmy name is roberta.\nI enjoy things";
        const textB = "Goodbye, \nmy name is roberta.\nI dislike things\n";
        testDiff(textA, textB);
    });

    it("should handle new line additions at the end of the file when there is more than one", () => {
        const textA = "Hello, \nmy name is roberta.\nI enjoy things\n";
        const textB = "Goodbye, \nmy name is roberta.\nI dislike things\n\n";
        testDiff(textA, textB);
    });

    it("should handle \\n -> \\r\\n", () => {
        const textA = "Hello, \nmy name is roberta.\nI enjoy things\n";
        const textB = "Goodbye, \r\nmy name is roberta.\r\nI dislike things\r\n";
        testDiff(textA, textB);
    });

    it("should handle \\r\\n -> \\n", () => {
        const textA = "Hello, \r\nmy name is roberta.\r\nI enjoy things\r\n";
        const textB = "Goodbye, \nmy name is roberta.\nI dislike things\n";
        testDiff(textA, textB);
    });
});

describe("history", () => {
    it("should create and apply patches", () => {
        let { text, history } = createTestHistory();

        for (let i = 0; history.length > 0; i++) {
            chai.expect(text[filename]).to.equal(versions[versions.length - 1 - i]);
            text = pxteditor.history.applyDiff(text, history.pop(), patchText);
        }

        chai.expect(text[filename]).to.equal(versions[0]);
    });

    it("should handle adding and removing files", () => {
        const v1 = { "main.ts": versions[0] };
        const v2 = { "main.ts": versions[1], "custom.blocks": versions[2] };
        const v3 = { "custom.blocks": versions[3] };

        const history: pxteditor.history.HistoryEntry[] = [];
        history.push(pxteditor.history.diffScriptText(v1, v2, Date.now(), diffText));
        history.push(pxteditor.history.diffScriptText(v2, v3, Date.now(), diffText));

        const res1 = pxteditor.history.applyDiff({...v3}, history.pop(), patchText);
        chai.expect(res1["main.ts"]).to.equal(versions[1]);
        chai.expect(res1["custom.blocks"]).to.equal(versions[2]);

        const res2 = pxteditor.history.applyDiff({...res1}, history.pop(), patchText);
        chai.expect(res2["main.ts"]).to.equal(versions[0]);
        chai.expect(res2["custom.blocks"]).to.equal(undefined);
    });
})

function createTestHistory() {
    let previous: pxt.workspace.ScriptText = { [filename]: versions[0] };

    let oldTheme = pxt.appTarget.appTheme;

    pxt.appTarget.appTheme = {
        timeMachineDiffInterval: 1
    }

    for (let i = 0; i < versions.length; i++) {
        let current = { ...previous, [filename]: versions[i] };

        updateHistory(previous, current, 100 * i, [], diffText, patchText);

        previous = current;
    }

    // console.log(JSON.stringify(parseHistoryFile(previous[pxt.HISTORY_FILE]).entries, null, 4));
    pxt.appTarget.appTheme = oldTheme;

    return {
        text: previous as pxt.workspace.ScriptText,
        history: parseHistoryFile(previous[pxt.HISTORY_FILE]).entries
    };
}

const testVersions: pxt.workspace.ScriptText[] = [];
const words = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.".split(" ");

let prevLines: string[];
function makeFile() {
    const numWords = Math.ceil(Math.random() * 100) + 10;
    let result = "";

    for (let i = 0; i < numWords; i++) {
        result += words[Math.floor(Math.random() * words.length)] + " ";
        if (i % 10 === 0) {
            result += "\n"
        }
    }

    const lines = result.split("\n");

    if (prevLines) {
        for (let i = 0; i < 3; i++) {
            lines.splice(
                Math.floor(Math.random() * (lines.length - 1)),
                0,
                prevLines[Math.floor(Math.random() * (prevLines.length - 1))]
            )
        }
    }

    prevLines = lines;

    result = lines.join("\n");

    if (Math.random() < 0.5) {
        result += "\n";
    }

    return result;
}

for (let i = 0; i < 20; i++) {
    const config: pxt.PackageConfig = {
        name: "test",
        dependencies: {},
        files: [
            pxt.IMAGES_JRES,
            pxt.TILEMAP_JRES,
            pxt.MAIN_BLOCKS,
        ],
        preferredEditor: pxt.BLOCKS_PROJECT_NAME
    };
    testVersions.push({
        [pxt.MAIN_BLOCKS]: makeFile(),
        [pxt.MAIN_TS]: makeFile(),
        [pxt.CONFIG_NAME]: JSON.stringify(config, null, 4)
    });
}

const ONE_MINUTE = 1000 * 60;
const ONE_HOUR = ONE_MINUTE * 60;
const ONE_DAY = ONE_HOUR * 24;

const testProject = createProjectText();


describe("updateHistory", () => {
    it("should generate diffs", () => {
        let prevText = { ...testVersions[0] };

        for (let i = 1; i < testVersions.length; i++) {
            let nextText = { ...testVersions[i] };

            pxteditor.history.updateHistory(prevText, nextText, i * ONE_HOUR, [], diffText, patchText);

            prevText = nextText;
        }

        const history = pxteditor.history.parseHistoryFile(prevText[pxt.HISTORY_FILE]);

        chai.expect(history.entries.length).to.equal(testVersions.length - 1);

        let currentText = prevText;
        for (let i = 0; i < history.entries.length; i++) {
            currentText = pxteditor.history.applyDiff(currentText, history.entries[history.entries.length - 1 - i], patchText);
            const comp = testVersions[testVersions.length - 2 - i];

            chai.expect(currentText[pxt.MAIN_BLOCKS]).to.equal(comp[pxt.MAIN_BLOCKS])
            chai.expect(currentText[pxt.MAIN_TS]).to.equal(comp[pxt.MAIN_TS])
            chai.expect(currentText[pxt.CONFIG_NAME]).to.equal(comp[pxt.CONFIG_NAME])
        }
    });

    it("should collapse diffs", () => {
        let prevText = { ...testVersions[0] };

        for (let i = 1; i < testVersions.length; i++) {
            let nextText = { ...testVersions[i] };

            pxteditor.history.updateHistory(prevText, nextText, i * ONE_MINUTE, [], diffText, patchText);

            prevText = nextText;
        }

        const history = pxteditor.history.parseHistoryFile(prevText[pxt.HISTORY_FILE]);

        chai.expect(history.entries.length).to.equal(Math.floor((testVersions.length / 5)) + 1);

        for (let i = 0; i < history.entries.length; i++) {
            const index = history.entries.length - 1 - i;
            const timestamp = history.entries[index].timestamp;
            const currentText = getTextAtTime(prevText, history, timestamp, patchText).files;

            const compIndex = index ? Math.floor(history.entries[index].timestamp / ONE_MINUTE) : 0;
            const comp = testVersions[compIndex];

            chai.expect(currentText[pxt.MAIN_BLOCKS]).to.equal(comp[pxt.MAIN_BLOCKS])
            chai.expect(currentText[pxt.MAIN_TS]).to.equal(comp[pxt.MAIN_TS])
            chai.expect(currentText[pxt.CONFIG_NAME]).to.equal(comp[pxt.CONFIG_NAME])
        }
    });

    it("should generate snapshots", () => {
        let prevText = { ...testVersions[0] };

        for (let i = 1; i < testVersions.length; i++) {
            let nextText = { ...testVersions[i] };

            pxteditor.history.updateHistory(prevText, nextText, i * ONE_HOUR, [], diffText, patchText);

            prevText = nextText;
        }

        const history = pxteditor.history.parseHistoryFile(prevText[pxt.HISTORY_FILE]);

        chai.expect(history.snapshots.length).to.equal(testVersions.length - 1);

        let currentText = prevText;
        for (let i = 0; i < history.snapshots.length; i++) {
            const index = history.snapshots.length - 1 - i;
            currentText = pxteditor.history.applySnapshot(currentText, history.snapshots[index].text)
            const comp = testVersions[testVersions.length - 2 - i];

            chai.expect(currentText[pxt.MAIN_BLOCKS]).to.equal(comp[pxt.MAIN_BLOCKS])
            chai.expect(currentText[pxt.MAIN_TS]).to.equal("")
            chai.expect(currentText[pxt.CONFIG_NAME]).to.equal(comp[pxt.CONFIG_NAME])
        }
    });

    it("should collapse snapshots", () => {
        let prevText = { ...testVersions[0] };

        const period = ONE_HOUR * 7;

        for (let i = 1; i < testVersions.length; i++) {
            let nextText = { ...testVersions[i] };

            pxteditor.history.updateHistory(prevText, nextText, i * period, [], diffText, patchText);

            prevText = nextText;
        }

        const history = pxteditor.history.parseHistoryFile(prevText[pxt.HISTORY_FILE]);
        chai.expect(history.snapshots.length).to.equal(10);

        let currentText = prevText;
        for (let i = 0; i < history.snapshots.length; i++) {
            const index = history.snapshots.length - 1 - i;
            currentText = pxteditor.history.applySnapshot(currentText, history.snapshots[index].text);

            const compIndex = index ? Math.floor(history.snapshots[index].timestamp / period) - 1 : 0;
            const comp = testVersions[compIndex];

            chai.expect(currentText[pxt.MAIN_BLOCKS]).to.equal(comp[pxt.MAIN_BLOCKS], index + "")
            chai.expect(currentText[pxt.MAIN_TS]).to.equal("")
            chai.expect(currentText[pxt.CONFIG_NAME]).to.equal(comp[pxt.CONFIG_NAME])
        }
    });

    it("should preserve extension event diffs when collapsing", () => {
        const beforeText: pxt.workspace.ScriptText = { ...testVersions[0] };
        const afterConfig = JSON.parse(beforeText[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        afterConfig.dependencies["test-extension"] = "github:test/test-extension#v2.0.0";
        let prevText: pxt.workspace.ScriptText = {
            ...beforeText,
            [pxt.CONFIG_NAME]: JSON.stringify(afterConfig, null, 4)
        };
        const event: pxteditor.history.SnapshotEvent = {
            type: "extension-updated",
            extensionName: "test-extension"
        };
        pxteditor.history.pushExtensionEventOnHistory(prevText, beforeText, 1, event, diffText);

        const period = ONE_HOUR * 7;
        for (let i = 2; i < testVersions.length; i++) {
            const nextText = { ...testVersions[i] };
            pxteditor.history.updateHistory(prevText, nextText, i * period, [], diffText, patchText);
            prevText = nextText;
        }

        const history = pxteditor.history.parseHistoryFile(prevText[pxt.HISTORY_FILE]);
        const eventEntries = history.entries.filter(entry => entry.event?.extensionName === "test-extension");
        chai.expect(eventEntries).to.have.length(2);

        const before = getTextAtTime(prevText, history, eventEntries[0].timestamp, patchText);
        const after = getTextAtTime(prevText, history, eventEntries[1].timestamp, patchText);
        const restoredBeforeConfig = JSON.parse(before.files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        const restoredAfterConfig = JSON.parse(after.files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        chai.expect(restoredBeforeConfig.dependencies["test-extension"]).to.equal(undefined);
        chai.expect(restoredAfterConfig.dependencies["test-extension"]).to.equal("github:test/test-extension#v2.0.0");
    });

    it("should restore to the version on the timestamp", () => {
        const project = { ...testProject };
        const history = JSON.parse(project[pxt.HISTORY_FILE]) as HistoryFile;

        for (const entry of history.entries) {
            const { files } = getTextAtTime(project, history, entry.timestamp, patchText);

            chai.expect(files[pxt.MAIN_TS]).equals(entry.timestamp.toString());
        }
    });
});

describe("collapseHistory", () => {
    it("should collapse history entries", () => {
        const project = { ...testProject };
        const collapsed = { ...project };
        const history = JSON.parse(project[pxt.HISTORY_FILE]) as HistoryFile;

        pxteditor.history.collapseHistory(
            collapsed,
            { interval: ONE_DAY },
            diffText,
            patchText
        );

        // taken from createProjectText below
        const expectedTimes = [
            // first entry
            new Date(2024, 8, 12, 8, 0, 0, 0),
            // end of each day
            new Date(2024, 8, 12, 8, 24, 0, 0),
            new Date(2024, 8, 13, 10, 7, 0, 0),
            new Date(2024, 8, 15, 8, 30, 45, 0),
        ]

        const newHistory = parseHistoryFile(collapsed[pxt.HISTORY_FILE]);

        chai.expect(newHistory.entries.length).to.equal(4);


        for (let i = 1; i < newHistory.entries.length; i++) {
            const entry = newHistory.entries[i];

            chai.expect(entry.timestamp).to.equal(expectedTimes[i].getTime());

            const { files } = getTextAtTime(project, newHistory, entry.timestamp, patchText);
            const { files: originalFiles } = getTextAtTime(project, history, entry.timestamp, patchText);

            chai.expect(files[pxt.MAIN_TS]).equals(originalFiles[pxt.MAIN_TS]);
        }
    });

    it("should collapse entries at a given interval", () => {
        let { text } = createTestHistory();

        const collapsed = { ...text };

        pxteditor.history.collapseHistory(collapsed, { interval: 250 }, diffText, patchText);
        checkCollapsedHistory(collapsed, text);
        const entries = parseHistoryFile(collapsed[pxt.HISTORY_FILE]).entries;

        chai.expect(entries.length).to.equal(3);
        checkTimestamp(entries[0], 0);
        checkTimestamp(entries[1], 200);
        checkTimestamp(entries[2], 500);
    });

    it("should respect a min timestamp when collapsing", () => {
        let { text } = createTestHistory();

        const collapsed = { ...text };

        pxteditor.history.collapseHistory(collapsed, { interval: 250, minTime: 300  }, diffText, patchText);
        checkCollapsedHistory(collapsed, text);

        const entries = parseHistoryFile(collapsed[pxt.HISTORY_FILE]).entries;

        chai.expect(entries.length).to.equal(4);
        checkTimestamp(entries[0], 0);
        checkTimestamp(entries[1], 100);
        checkTimestamp(entries[2], 200);
        checkTimestamp(entries[3], 500);
    });

    it("should respect a max timestamp when collapsing", () => {
        let { text } = createTestHistory();

        const collapsed = { ...text };

        pxteditor.history.collapseHistory(collapsed, { interval: 250, maxTime: 500 }, diffText, patchText);
        checkCollapsedHistory(collapsed, text);

        const entries = parseHistoryFile(collapsed[pxt.HISTORY_FILE]).entries;

        chai.expect(entries.length).to.equal(4);
        checkTimestamp(entries[0], 0);
        checkTimestamp(entries[1], 300);
        checkTimestamp(entries[2], 600);
        checkTimestamp(entries[3], 700);
    });

    it("should respect a min + max timestamp when collapsing", () => {
        let { text } = createTestHistory();

        const collapsed = { ...text };

        pxteditor.history.collapseHistory(collapsed, { interval: 250, minTime: 300, maxTime: 600 }, diffText, patchText);
        checkCollapsedHistory(collapsed, text);

        const entries = parseHistoryFile(collapsed[pxt.HISTORY_FILE]).entries;

        chai.expect(entries.length).to.equal(5);
        checkTimestamp(entries[0], 0);
        checkTimestamp(entries[1], 100);
        checkTimestamp(entries[2], 200);
        checkTimestamp(entries[3], 400);
        checkTimestamp(entries[4], 700);
    });
});

describe("pushSnapshotOnHistory", () => {
    it("should preserve snapshot event metadata", () => {
        const text = { ...testProject };
        delete text[pxt.HISTORY_FILE];
        const event: pxteditor.history.SnapshotEvent = {
            type: "extension-removed",
            phase: "before",
            extensionName: "test-extension"
        };
        const snapshotText = {
            ...text,
            [pxt.MAIN_BLOCKS]: "before extension change"
        };

        pxteditor.history.pushSnapshotOnHistory(text, 100, event, snapshotText);
        pxteditor.history.pushSnapshotOnHistory(text, 100, {
            ...event,
            phase: "after"
        });

        const history = pxteditor.history.parseHistoryFile(text[pxt.HISTORY_FILE]);
        chai.expect(history.snapshots).to.have.length(2);
        chai.expect(history.snapshots[0].event).to.deep.equal(event);
        chai.expect(history.snapshots[0].text[pxt.HISTORY_FILE]).to.equal(undefined);
        chai.expect(history.snapshots[0].text[pxt.MAIN_BLOCKS]).to.equal("before extension change");
        chai.expect(history.snapshots[1].timestamp).to.equal(101);
        chai.expect(history.snapshots[1].event.phase).to.equal("after");
    });
});

describe("pushExtensionEventOnHistory", () => {
    it("should store extension changes as a pxt.json diff with before and after markers", () => {
        const beforeText: pxt.workspace.ScriptText = { ...testVersions[0] };
        const afterConfig = JSON.parse(beforeText[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        afterConfig.dependencies["test-extension"] = "github:test/test-extension#v2.0.0";
        const afterText: pxt.workspace.ScriptText = {
            ...beforeText,
            [pxt.CONFIG_NAME]: JSON.stringify(afterConfig, null, 4)
        };
        const event: pxteditor.history.SnapshotEvent = {
            type: "extension-updated",
            extensionName: "test-extension"
        };

        pxteditor.history.updateHistory(beforeText, afterText, 99, [], diffText, patchText);
        pxteditor.history.pushExtensionEventOnHistory(afterText, beforeText, 100, event, diffText);

        const history = pxteditor.history.parseHistoryFile(afterText[pxt.HISTORY_FILE]);
        chai.expect(history.snapshots).to.have.length(1);
        chai.expect(history.snapshots[0].event).to.equal(undefined);
        chai.expect(history.entries).to.have.length(2);
        chai.expect(history.entries[0].event.phase).to.equal("before");
        chai.expect(history.entries[0].changes).to.have.length(0);
        chai.expect(history.entries[1].event.phase).to.equal("after");
        chai.expect(history.entries[1].changes).to.have.length(1);
        chai.expect(history.entries[1].changes[0].filename).to.equal(pxt.CONFIG_NAME);

        const after = pxteditor.history.getTextAtTime(afterText, history, history.entries[1].timestamp, patchText);
        const before = pxteditor.history.getTextAtTime(afterText, history, history.entries[0].timestamp, patchText);
        chai.expect(after.files[pxt.CONFIG_NAME]).to.equal(afterText[pxt.CONFIG_NAME]);
        chai.expect(before.files[pxt.CONFIG_NAME]).to.equal(beforeText[pxt.CONFIG_NAME]);

        const nextText: pxt.workspace.ScriptText = {
            ...afterText,
            [pxt.MAIN_TS]: "changed after extension event"
        };
        pxteditor.history.updateHistory(afterText, nextText, 200, [], diffText, patchText);
        const nextHistory = pxteditor.history.parseHistoryFile(nextText[pxt.HISTORY_FILE]);
        const timestamps = nextHistory.entries.map(entry => entry.timestamp);
        chai.expect(new Set(timestamps).size).to.equal(timestamps.length);
    });

    it("should preserve timed snapshots that predate the extension change", () => {
        const beforeText: pxt.workspace.ScriptText = { ...testVersions[0] };
        pxteditor.history.pushSnapshotOnHistory(beforeText, 50);
        const afterConfig = JSON.parse(beforeText[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        afterConfig.dependencies["test-extension"] = "github:test/test-extension#v2.0.0";
        const afterText: pxt.workspace.ScriptText = {
            ...beforeText,
            [pxt.CONFIG_NAME]: JSON.stringify(afterConfig, null, 4)
        };

        pxteditor.history.updateHistory(beforeText, afterText, 99, [], diffText, patchText);
        pxteditor.history.pushExtensionEventOnHistory(afterText, beforeText, 100, {
            type: "extension-updated",
            extensionName: "test-extension"
        }, diffText);

        const history = pxteditor.history.parseHistoryFile(afterText[pxt.HISTORY_FILE]);
        chai.expect(history.snapshots).to.have.length(1);
        chai.expect(history.snapshots[0].timestamp).to.equal(50);
        chai.expect(history.entries.filter(entry => entry.event)).to.have.length(2);
    });

    it("should preserve automatic history when pxt.json did not change", () => {
        const beforeText: pxt.workspace.ScriptText = { ...testVersions[0] };
        const afterText: pxt.workspace.ScriptText = {
            ...beforeText,
            [pxt.MAIN_TS]: "non-extension change"
        };
        pxteditor.history.updateHistory(beforeText, afterText, 99, [], diffText, patchText);
        const automaticHistory = afterText[pxt.HISTORY_FILE];

        pxteditor.history.pushExtensionEventOnHistory(afterText, beforeText, 100, {
            type: "extension-updated",
            extensionName: "test-extension"
        }, diffText);

        chai.expect(afterText[pxt.HISTORY_FILE]).to.equal(automaticHistory);
    });
});

describe("updateShareHistory", () => {
    it("should preserve the type of shared versions", () => {
        const text = { ...testVersions[0] };
        pxteditor.history.updateShareHistory(text, 100, [{
            id: "snapshot-id",
            type: "snapshot"
        }]);
        pxteditor.history.updateShareHistory(text, 200, [{
            id: "snapshot-id",
            type: "snapshot"
        }, {
            id: "permalink-id",
            type: "permalink"
        }]);

        const history = pxteditor.history.parseHistoryFile(text[pxt.HISTORY_FILE]);
        chai.expect(history.shares).to.deep.equal([{
            id: "snapshot-id",
            type: "snapshot",
            timestamp: 100
        }, {
            id: "permalink-id",
            type: "permalink",
            timestamp: 200
        }]);
    });
});


describe("pxt.github.normalizeTutorialPath", () => {
    const testPath = "Mojang/EducationContent/computing/unit-2/lesson-1";

    it("should parse repos of the format owner/repo/path/to/file", () => {
        chai.expect(pxt.github.normalizeTutorialPath(testPath)).equals(testPath);
    });

    it("should parse repos of the format github:owner/repo/path/to/file", () => {
        const path = "github:" + testPath;
        chai.expect(pxt.github.normalizeTutorialPath(path)).equals(testPath);
    });

    it("should parse repos of the format https://github.com/owner/repo/path/to/file", () => {
        const path = "https://github.com/" + testPath;
        chai.expect(pxt.github.normalizeTutorialPath(path)).equals(testPath);

        const path2 = "http://github.com/" + testPath;
        chai.expect(pxt.github.normalizeTutorialPath(path2)).equals(testPath);
    });

    it("should parse actual links to markdown files in github", () => {
        const url = "https://github.com/Mojang/EducationContent/blob/master/computing/unit-2/lesson-1.md";
        chai.expect(pxt.github.normalizeTutorialPath(url)).equals(testPath);
    });
});

describe("pxt.github local repositories", () => {
    const monoConfig = JSON.stringify({ name: "ext", description: "Nested extension", dependencies: {}, files: ["main.ts"] });
    const serverFiles: pxt.Map<any> = {
        "localrepos": { repos: ["owner/mono"] },
        "gh/owner/mono": { name: "mono", description: "Monorepo root" },
        "gh/owner/mono/refs": { refs: {} },
        "gh/owner/mono/ext/text": { "pxt.json": monoConfig, "main.ts": "namespace ext {}" },
    };
    let requests: string[];
    let refuseWithoutToken: boolean;
    let saved: { isNodeJS: boolean, localToken: string, localRequestAsync: any, packagesConfigAsync: any };

    class SilentLogger extends pxt.ConsoleLogger {
        log() { }
        error() { }
    }

    function serveAt(href: string) {
        (global as any).window = { location: { href } };
    }

    before(() => {
        saved = {
            isNodeJS: pxt.Util.isNodeJS,
            localToken: pxt.Cloud.localToken,
            localRequestAsync: pxt.Cloud.localRequestAsync,
            packagesConfigAsync: pxt.packagesConfigAsync
        };
        pxt.setLogger(new SilentLogger());
        pxt.Util.isNodeJS = false;
        pxt.Cloud.localToken = "local-token";
        (pxt.Cloud as any).localRequestAsync = (path: string) => {
            requests.push(path);
            if (refuseWithoutToken && !pxt.Cloud.localToken)
                return Promise.resolve({ statusCode: 403, headers: {}, buffer: undefined, json: undefined, text: "Error 403" });
            const json = serverFiles[path];
            return Promise.resolve(json
                ? { statusCode: 200, headers: {}, buffer: undefined, json, text: JSON.stringify(json) }
                : { statusCode: 404, headers: {}, buffer: undefined, json: undefined, text: `${path}: missing on disk` });
        };
        (pxt as any).packagesConfigAsync = () => Promise.resolve({});
    });

    beforeEach(() => {
        requests = [];
        refuseWithoutToken = false;
        pxt.Cloud.localToken = "local-token";
    });

    after(async () => {
        serveAt("http://localhost:3232/");
        serverFiles["localrepos"] = { repos: [] };
        await pxt.github.initLocalReposAsync();
        delete (global as any).window;
        pxt.Util.isNodeJS = saved.isNodeJS;
        pxt.Cloud.localToken = saved.localToken;
        (pxt.Cloud as any).localRequestAsync = saved.localRequestAsync;
        (pxt as any).packagesConfigAsync = saved.packagesConfigAsync;
        pxt.setLogger(new pxt.ConsoleLogger());
    });

    it("does not consult a server that is not on localhost", async () => {
        serveAt("https://editor.example/");
        await pxt.github.initLocalReposAsync();
        chai.expect(requests).deep.equals([]);
        chai.expect(pxt.github.isLocalRepo("owner/mono")).equals(false);
    });

    it("lists the locally served repositories without a local token when the server allows it (pxt serve --noauth)", async () => {
        serveAt("http://localhost:3232/");
        pxt.Cloud.localToken = "";
        await pxt.github.initLocalReposAsync();
        chai.expect(requests).deep.equals(["localrepos"]);
        chai.expect(pxt.github.isLocalRepo("owner/mono")).equals(true);
    });

    it("resolves no repositories locally when the server refuses the listing", async () => {
        serveAt("http://localhost:3232/");
        pxt.Cloud.localToken = "";
        refuseWithoutToken = true;
        await pxt.github.initLocalReposAsync();
        chai.expect(requests).deep.equals(["localrepos"]);
        chai.expect(pxt.github.isLocalRepo("owner/mono")).equals(false);
    });

    it("lists the locally served repositories from the local server", async () => {
        serveAt("http://localhost:3232/");
        await pxt.github.initLocalReposAsync();
        chai.expect(requests).deep.equals(["localrepos"]);
        chai.expect(pxt.github.isLocalRepo("github:Owner/Mono/ext#v1.0.0")).equals(true);
        chai.expect(pxt.github.isLocalRepo("owner/mono")).equals(true);
        chai.expect(pxt.github.isLocalRepo("owner/other")).equals(false);
    });

    it("treats locally served repositories as approved", () => {
        chai.expect(pxt.github.repoStatus(pxt.github.parseRepoId("owner/mono/ext"), {}))
            .equals(pxt.github.GitRepoStatus.Approved);
        chai.expect(pxt.github.repoStatus(pxt.github.parseRepoId("owner/other"), {}))
            .equals(pxt.github.GitRepoStatus.Unknown);
    });

    it("reads repository metadata from the local server", async () => {
        const repo = await pxt.github.repoAsync("owner/mono/ext", {});
        chai.expect(requests).deep.equals(["gh/owner/mono"]);
        chai.expect(repo.name).equals("mono-ext");
        chai.expect(repo.fullName).equals("owner/mono/ext");
        chai.expect(repo.status).equals(pxt.github.GitRepoStatus.Approved);
    });

    it("reports no versions and no refs", async () => {
        chai.expect(await pxt.github.latestVersionAsync("owner/mono", {})).equals(undefined);
        chai.expect(await pxt.github.listRefsAsync("owner/mono")).deep.equals([]);
        chai.expect(requests).deep.equals(["gh/owner/mono/refs"]);
    });

    it("adds a locally served extension without a ref", async () => {
        const res = await pxt.github.downloadLatestPackageAsync(pxt.github.parseRepoId("owner/mono/ext"));
        chai.expect(res.version).equals("github:owner/mono/ext");
        chai.expect(res.config.name).equals("ext");
        chai.expect(requests).deep.equals(["gh/owner/mono/ext/text"]);
    });

    it("serves the working tree for any requested ref", async () => {
        const pkg = await pxt.github.downloadPackageAsync("github:owner/mono/ext#v1.0.0", {});
        chai.expect(pkg.files["main.ts"]).equals("namespace ext {}");
        chai.expect(requests).deep.equals(["gh/owner/mono/ext/text"]);
    });

    it("fails with the local server's error when the package is missing", async () => {
        let err: any;
        try {
            await pxt.github.downloadPackageAsync("github:owner/mono/nothere", {});
        } catch (e) {
            err = e;
        }
        chai.expect(err, "expected an error").to.exist;
        chai.expect(err.message).equals("gh/owner/mono/nothere/text: missing on disk");
        chai.expect(err.statusCode).equals(404);
        chai.expect(requests).deep.equals(["gh/owner/mono/nothere/text"]);
    });
});

function createProjectText(): pxt.workspace.ScriptText {
    // A realistic timeline of project edits
    const dates = [
        new Date(2024, 8, 12, 8, 0, 0, 0),
        new Date(2024, 8, 12, 8, 15, 0, 0),
        new Date(2024, 8, 12, 8, 17, 0, 0),
        new Date(2024, 8, 12, 8, 23, 0, 0),
        new Date(2024, 8, 12, 8, 24, 0, 0),

        new Date(2024, 8, 13, 8, 25, 0, 0),
        new Date(2024, 8, 13, 8, 45, 0, 0),
        new Date(2024, 8, 13, 8, 47, 0, 0),
        new Date(2024, 8, 13, 9, 13, 0, 0),
        new Date(2024, 8, 13, 9, 27, 0, 0),
        new Date(2024, 8, 13, 9, 34, 0, 0),
        new Date(2024, 8, 13, 9, 52, 0, 0),
        new Date(2024, 8, 13, 9, 54, 0, 0),
        new Date(2024, 8, 13, 9, 56, 0, 0),
        new Date(2024, 8, 13, 10, 5, 0, 0),
        new Date(2024, 8, 13, 10, 7, 0, 0),

        new Date(2024, 8, 15, 8, 0, 0, 0),
        new Date(2024, 8, 15, 8, 15, 0, 0),
        new Date(2024, 8, 15, 8, 15, 20, 0),
        new Date(2024, 8, 15, 8, 15, 45, 0),
        new Date(2024, 8, 15, 8, 16, 0, 0),
        new Date(2024, 8, 15, 8, 16, 20, 0),
        new Date(2024, 8, 15, 8, 16, 45, 0),
        new Date(2024, 8, 15, 8, 17, 0, 0),
        new Date(2024, 8, 15, 8, 17, 20, 0),
        new Date(2024, 8, 15, 8, 17, 45, 0),
        new Date(2024, 8, 15, 8, 18, 0, 0),
        new Date(2024, 8, 15, 8, 18, 20, 0),
        new Date(2024, 8, 15, 8, 18, 45, 0),
        new Date(2024, 8, 15, 8, 19, 0, 0),
        new Date(2024, 8, 15, 8, 19, 20, 0),
        new Date(2024, 8, 15, 8, 19, 45, 0),
        new Date(2024, 8, 15, 8, 20, 0, 0),
        new Date(2024, 8, 15, 8, 20, 20, 0),
        new Date(2024, 8, 15, 8, 20, 45, 0),
        new Date(2024, 8, 15, 8, 21, 0, 0),
        new Date(2024, 8, 15, 8, 21, 20, 0),
        new Date(2024, 8, 15, 8, 21, 45, 0),
        new Date(2024, 8, 15, 8, 22, 0, 0),
        new Date(2024, 8, 15, 8, 22, 20, 0),
        new Date(2024, 8, 15, 8, 22, 45, 0),
        new Date(2024, 8, 15, 8, 23, 0, 0),
        new Date(2024, 8, 15, 8, 23, 20, 0),
        new Date(2024, 8, 15, 8, 23, 45, 0),
        new Date(2024, 8, 15, 8, 24, 0, 0),
        new Date(2024, 8, 15, 8, 24, 20, 0),
        new Date(2024, 8, 15, 8, 24, 45, 0),
        new Date(2024, 8, 15, 8, 25, 0, 0),
        new Date(2024, 8, 15, 8, 25, 20, 0),
        new Date(2024, 8, 15, 8, 25, 45, 0),
        new Date(2024, 8, 15, 8, 26, 0, 0),
        new Date(2024, 8, 15, 8, 26, 20, 0),
        new Date(2024, 8, 15, 8, 26, 45, 0),
        new Date(2024, 8, 15, 8, 27, 0, 0),
        new Date(2024, 8, 15, 8, 27, 20, 0),
        new Date(2024, 8, 15, 8, 27, 45, 0),
        new Date(2024, 8, 15, 8, 28, 0, 0),
        new Date(2024, 8, 15, 8, 28, 20, 0),
        new Date(2024, 8, 15, 8, 28, 45, 0),
        new Date(2024, 8, 15, 8, 29, 0, 0),
        new Date(2024, 8, 15, 8, 29, 20, 0),
        new Date(2024, 8, 15, 8, 29, 45, 0),
        new Date(2024, 8, 15, 8, 30, 0, 0),
        new Date(2024, 8, 15, 8, 30, 20, 0),
        new Date(2024, 8, 15, 8, 30, 45, 0),

        new Date(2024, 8, 18, 8, 45, 0, 0),
    ];

    let currentText = {
        [pxt.MAIN_TS]: "start"
    };

    // At each time, push an edit that contains the
    // timestamp
    for (const date of dates) {
        const newText = {
            ...currentText,
            [pxt.MAIN_TS]: "" + date.getTime()
        };

        updateHistory(
            currentText,
            newText,
            date.getTime(),
            [],
            diffText,
            patchText
        )

        currentText = {
            ...newText
        };
    }

    return currentText;
}

describe("fixed-instance dropdown options", () => {
    // the values of `options`, a separator standing as "separator"
    function values(options: ReturnType<typeof getInstanceDropdownOptions>) {
        return options.map(o => o === "separator" ? o : o[1]);
    }

    // a fixed-instance symbol `ns.<name>` of the type `retType`
    function instanceSymbol(name: string, retType: string, attributes: pxtc.CommentAttrs = {} as pxtc.CommentAttrs): pxtc.SymbolInfo {
        return {
            name,
            namespace: "ns",
            qName: `ns.${name}`,
            fileName: "main.ts",
            kind: pxtc.SymbolKind.Variable,
            parameters: [],
            retType,
            attributes: { ...attributes, fixedInstance: true },
        };
    }

    // a fixed-instance type `ns.<name>` extending `extendsTypes`
    function typeSymbol(name: string, extendsTypes?: string[]): pxtc.SymbolInfo {
        return {
            name,
            namespace: "ns",
            qName: `ns.${name}`,
            fileName: "main.ts",
            kind: pxtc.SymbolKind.Class,
            parameters: [],
            retType: `ns.${name}`,
            extendsTypes,
            attributes: { fixedInstances: true } as pxtc.CommentAttrs,
        };
    }

    // API info declaring the fixed-instance type `ns.Thing` and `symbols`
    function thingBlocksInfo(symbols: pxtc.SymbolInfo[]): pxtc.BlocksInfo {
        const byQName: pxt.Map<pxtc.SymbolInfo> = { "ns.Thing": typeSymbol("Thing") };
        for (const symbol of symbols) byQName[symbol.qName] = symbol;
        return { apis: { byQName }, blocks: [], blocksById: {}, enumsByName: {}, kindsByName: {} };
    }

    // builds a `FieldInstanceDropdown` of `ns.Thing` with `options`
    function instanceField(options: Partial<FieldCustomDropdownOptions>) {
        return new FieldInstanceDropdown("", { type: "ns.Thing", blocksInfo: undefined, ...options });
    }

    // the values of the options of a `FieldInstanceDropdown` of `ns.Thing`
    // built with `options`, read as its dropdown opens
    function openedValues(options: Partial<FieldCustomDropdownOptions>) {
        return values(instanceField(options).getOptions(false));
    }

    it("lists the instances the live API info declares as the field's dropdown opens, not those captured when the field was built", () => {
        const opened = openedValues({
            data: [["old", "ns.old"]],
            getBlocksInfo: () => thingBlocksInfo([instanceSymbol("new", "ns.Thing")]),
        });
        chai.expect(opened).to.include("ns.new");
        chai.expect(opened).to.not.include("ns.old");
    });

    it("keeps the field's value when the live API info no longer declares it", () => {
        let blocksInfo: pxtc.BlocksInfo | undefined;
        const field = instanceField({ data: [["old", "ns.old"]], getBlocksInfo: () => blocksInfo });
        chai.expect(field.getValue()).equals("ns.old");
        blocksInfo = thingBlocksInfo([instanceSymbol("new", "ns.Thing")]);
        chai.expect(values(field.getOptions(false))).deep.equals(["ns.new"]);
        chai.expect(field.getValue()).equals("ns.old");
    });
});

describe("editor toggle layout", () => {
    // the fields of `value` that `expected` names, for comparing a part of a layout
    function pick<T>(value: T, expected: Partial<T>): Partial<T> {
        const picked: Partial<T> = {};
        for (const k of Object.keys(expected) as (keyof T)[]) picked[k] = value[k];
        return picked;
    }

    function expectLayout(actual: ReturnType<typeof getEditorToggleLayout>, expected: Partial<ReturnType<typeof getEditorToggleLayout>>) {
        chai.expect(pick(actual, expected)).deep.equals(expected);
    }

    function layout(extra: Partial<EditorToggleLayoutInput> = {}) {
        return getEditorToggleLayout({
            python: true,
            showJavaScript: true,
            showPython: true,
            showBlocks: true,
            pythonIsActive: false,
            isJavaScriptActive: false,
            isPythonActive: false,
            extensionEditors: [],
            activeExtensionEditor: undefined,
            lastExtensionEditor: undefined,
            ...extra,
        });
    }

    it("keeps the toggle's own layout when no extension tab is offered", () => {
        chai.expect(layout()).deep.equals({
            trigger: { language: "javascript" }, second: undefined, showDropdown: true, dropdownActive: false,
            dropdownLanguages: ["javascript", "python"], dropdownSeparator: false, dropdownExtensions: [],
        });
        expectLayout(layout({ pythonIsActive: true, isPythonActive: true }), { trigger: { language: "python" }, dropdownActive: true });
        expectLayout(layout({ showBlocks: false }), { trigger: { language: "javascript" }, second: { language: "python" }, showDropdown: false, dropdownLanguages: [] });
        expectLayout(layout({ showPython: false, python: false }), { trigger: { language: "javascript" }, second: undefined, showDropdown: false });
    });
});

describe("simulator extension editor tab host", () => {
    const ORIGIN = "https://sim.example";
    const EXT = "someorg/pxt-ext";
    const OTHER = "otherorg/pxt-other";

    interface Posted {
        msg: any;
        origin: string;
        transfer: unknown[] | undefined;
    }

    class FakeWindow {
        posted: Posted[] = [];
        postMessage(msg: any, origin: string, transfer?: unknown[]) {
            this.posted.push({ msg, origin, transfer });
        }
    }

    // the parts of an element the host touches; a removed frame loses its content window, as in the browser
    class FakeElement {
        style: pxt.Map<string> = {};
        dataset: pxt.Map<string> = {};
        attributes: pxt.Map<string> = {};
        children: FakeElement[] = [];
        parentElement: FakeElement | undefined;
        // the window of the frame's page, which outlives the frame's removal
        readonly window = new FakeWindow();
        contentWindow: FakeWindow | null = this.window;
        className = "";
        title = "";
        src = "";
        textContent = "";
        allowFullscreen = false;
        get isConnected() { return !!this.parentElement; }
        setAttribute(name: string, value: string) { this.attributes[name] = value; }
        focus() { }
        appendChild(child: FakeElement) {
            this.children.push(child);
            child.parentElement = this;
            return child;
        }
        removeChild(child: FakeElement) {
            this.children = this.children.filter(c => c !== child);
            child.parentElement = undefined;
            child.contentWindow = null;
            return child;
        }
    }

    interface FakeChannel {
        port1: { id: string };
        port2: { id: string };
    }

    let container: FakeElement;
    let simulatorColumn: FakeElement;
    let simulatorFrames: pxt.Map<FakeElement>;
    let channels: FakeChannel[];
    let state: SimxEditorSimulatorState;
    let host: SimxEditorHost;

    function registration(key: string, extra: Partial<SimxEditorRegistration> = {}): SimxEditorRegistration {
        return { key, label: key + " label", url: `${ORIGIN}/simx/${key}/-/index.html`, ...extra };
    }

    const params = { parentOrigin: "https://editor.example", target: "arcade", project: "p1", language: "en" };

    // the simulator frame of `key`, created and loaded as the driver does it
    function loadSimulatorFrame(key: string): FakeElement {
        const frame = new FakeElement();
        frame.src = `${ORIGIN}/simx/${key}/-/simx/index.html?channel=${encodeURIComponent(key)}`;
        simulatorColumn.appendChild(frame);
        simulatorFrames[key] = frame;
        host.simulatorFrameLoaded(key, frame as unknown as HTMLIFrameElement);
        return frame;
    }

    function tab(key: string): FakeElement {
        return host.getFrame(key) as unknown as FakeElement;
    }

    function ready(key: string, extra: { source?: unknown, origin?: string } = {}) {
        host.handleMessage({ data: { type: "simxeditor", event: "ready" }, source: tab(key).contentWindow, origin: ORIGIN, ...extra });
    }

    function events(frame: FakeElement) {
        return frame.window.posted.filter(p => p.msg.type === "simxeditor").map(p => p.msg);
    }

    function ports(frame: FakeElement) {
        return frame.window.posted.filter(p => p.msg.type === "simxeditorport");
    }

    beforeEach(() => {
        container = new FakeElement();
        simulatorColumn = new FakeElement();
        simulatorFrames = {};
        channels = [];
        state = "Running";
        let nextPort = 0;
        host = new SimxEditorHost({
            createFrame: () => new FakeElement() as unknown as HTMLIFrameElement,
            createLoader: label => {
                const loader = new FakeElement();
                loader.textContent = label;
                return loader as unknown as HTMLElement;
            },
            // as the editor wires it
            framePermissions: grants => pxsim.simulatorFramePermissions(grants),
            startSimulatorExtension: key => {
                return simulatorFrames[key] as unknown as HTMLIFrameElement;
            },
            addTabFrame: () => { },
            removeTabFrame: () => { },
            getSimulatorState: () => state,
            createChannel: () => {
                const channel = { port1: { id: "p" + nextPort++ }, port2: { id: "p" + nextPort++ } };
                channels.push(channel);
                return channel as unknown as MessageChannel;
            },
        });
    });

    function show(key: string, extra: Partial<SimxEditorRegistration> = {}) {
        host.show(registration(key, extra), container as unknown as HTMLElement, params);
    }

    describe("the tab frame", () => {
        it("loads the tab's page with the simulator frame's parameters and the editor role, under the registration's grants", () => {
            show(EXT, { allowPopups: true, allowClipboard: true, allowDownloads: true });
            const frame = tab(EXT);
            const url = new URL(frame.src);
            chai.expect(url.origin + url.pathname).equals(`${ORIGIN}/simx/${EXT}/-/index.html`);
            const query: pxt.Map<string> = {};
            url.searchParams.forEach((value, name) => query[name] = value);
            chai.expect(query).deep.equals({
                parentOrigin: "https://editor.example", channel: EXT, role: "editor", apiLevel: pxsim.SIMX_API_LEVEL.toString(),
                target: "arcade", project: "p1", language: "en",
            });
            chai.expect(frame.attributes).deep.equals({
                sandbox: "allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads",
                allow: "autoplay;microphone;clipboard-read;clipboard-write",
            });
            chai.expect(frame.allowFullscreen).equals(true);
            chai.expect(frame.dataset).deep.equals({ simxkey: EXT, simxrole: "editor", origin: ORIGIN });
            chai.expect(frame.parentElement).equals(container);
        });

        it("accepts the ready event only from the tab frame's window and origin", () => {
            show(EXT);
            ready(EXT, { origin: "https://elsewhere.example" });
            ready(EXT, { source: new FakeWindow() });
            host.handleMessage({ data: { type: "simxeditor", event: "ready" }, source: undefined, origin: ORIGIN });
            chai.expect(host.isReady(EXT)).equals(false);
            ready(EXT);
            chai.expect(host.isReady(EXT)).equals(true);
        });

        it("removes every tab frame when its project closes or reloads, posting nothing first", () => {
            show(EXT);
            ready(EXT);
            show(OTHER);
            const frames = [tab(EXT), tab(OTHER)];
            const before = events(frames[0]).length;
            host.close();
            chai.expect([tab(EXT), tab(OTHER)]).deep.equals([undefined, undefined]);
            chai.expect(frames.map(f => f.parentElement)).deep.equals([undefined, undefined]);
            chai.expect(events(frames[0]).length).equals(before);
            chai.expect(events(frames[1])).deep.equals([]);

            show(EXT);
            chai.expect(tab(EXT)).not.equals(frames[0]);
        });
    });

    describe("lifecycle events", () => {
        it("posts the tab its visibility and the simulator's state once it is ready, then shown and hidden on every switch", () => {
            show(EXT);
            const frame = tab(EXT);
            chai.expect(events(frame)).deep.equals([]);
            ready(EXT);
            host.hide();
            show(OTHER);
            show(EXT);
            show(EXT);
            chai.expect(events(frame)).deep.equals([
                { type: "simxeditor", event: "shown" },
                { type: "simxeditor", event: "simulatorstate", state: "Running" },
                { type: "simxeditor", event: "fullscreen", enabled: false },
                { type: "simxeditor", event: "hidden" },
                { type: "simxeditor", event: "shown" },
            ]);
            chai.expect(frame.contentWindow.posted.every(p => p.origin === ORIGIN)).equals(true);
        });
    });

    describe("actions", () => {
        const create = (qName: string) => ({ type: "simxeditor", event: "action", action: "create", qName } as const);

        it("posts an action requested before the tab is ready right after the events that follow its ready event", () => {
            host.requestAction(EXT, create("ext.Thing"));
            show(EXT);
            loadSimulatorFrame(EXT);
            chai.expect(events(tab(EXT))).deep.equals([]);
            ready(EXT);
            chai.expect(events(tab(EXT))).deep.equals([
                { type: "simxeditor", event: "shown" },
                { type: "simxeditor", event: "simulatorstate", state: "Running" },
                { type: "simxeditor", event: "fullscreen", enabled: false },
                create("ext.Thing"),
            ]);
            chai.expect(ports(tab(EXT)).length).equals(1);
        });
    });

    describe("port brokering", () => {
        function brokered(key: string, simulatorFrame: FakeElement) {
            return { tab: ports(tab(key)), simulator: ports(simulatorFrame) };
        }

        it("brokers a port pair when the tab becomes ready after its simulator frame loaded", () => {
            const simulatorFrame = loadSimulatorFrame(EXT);
            show(EXT);
            chai.expect(brokered(EXT, simulatorFrame).tab).deep.equals([]);
            ready(EXT);
            const { tab: tabPorts, simulator } = brokered(EXT, simulatorFrame);
            chai.expect(channels.length).equals(1);
            chai.expect(simulator).deep.equals([{ msg: { type: "simxeditorport", key: EXT }, origin: ORIGIN, transfer: [channels[0].port1] }]);
            chai.expect(tabPorts).deep.equals([{ msg: { type: "simxeditorport", key: EXT }, origin: ORIGIN, transfer: [channels[0].port2] }]);
        });
    });
});
