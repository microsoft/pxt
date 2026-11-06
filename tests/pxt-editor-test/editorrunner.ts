/// <reference path="../../localtypings/pxteditor.d.ts"/>

/* eslint-disable mocha-no-side-effect-code */
import * as chai from "chai";
import * as dmp from "diff-match-patch";
import * as pxteditor from "../../pxteditor";
import { getTextAtTime, HistoryFile, parseHistoryFile, updateHistory } from "../../pxteditor/history";
import {
    answerSimxEditorRequest,
    findSimxInstanceCreator,
    getDependencyRepository,
    getProjectSimxEditors,
    getSimxEditorKeyOfMarker,
    getSimxEditorMarkerName,
    getSimxEditorRegistrations,
    isSimxInProject,
    resolveSimxEditorLabel,
    SimxEditorHost,
    SimxEditorRegistration,
} from "../../webapp/src/simxEditorHost";
import {
    getEditorToggleLayout,
    EditorToggleLayoutInput,
    getSimxEditorIconMaskStyle,
    getSimxEditorMenuItemContent,
    showsSimxEditorTabs,
    SimxEditorTabsShownInput,
} from "../../webapp/src/editorToggleLayout";
import { getEditorToolbarControls, EditorToolbarControlsInput } from "../../webapp/src/editorToolbarControls";
import {
    getParentOrigin as getSimxEditorParentOrigin,
    getSimxApiLevel as getSimxEditorApiLevel,
    hasEditorTab,
    SimxEditorSimulatorState,
} from "../../pxtservices/simxeditor";
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
    getFolderFileName,
    getFolderUsage,
    getProjfsFolder,
    getVisibleFiles,
    isDeclaredInProjectFolder,
    isValidRelativeName,
    PROJFS_FOLDER_QUOTA_BYTES,
    PROJFS_MAX_FOLDER_FILES,
    PROJFS_MAX_NAME_LENGTH,
    PROJFS_MAX_NAME_SEGMENTS,
    PROJFS_MAX_PENDING_REQUESTS,
    PROJFS_NOTIFY_DEBOUNCE_MS,
    PROJFS_NOTIFY_MAX_DELAY_MS,
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
import { OpenProjectTracker } from "../../webapp/src/simxRequests";
import {
    getParentOrigin,
    getProjectId,
    getSimxApiLevel as getProjfsApiLevel,
    getSimxChannel,
    getTargetId,
    ProjfsClient,
    ProjfsContentReply,
    ProjfsError,
    ProjfsErrorCode,
    ProjfsErrorReply,
    ProjfsFilesReply,
    ProjfsNotification,
    ProjfsReply,
    ProjfsRequest,
} from "../../pxtservices/projfs";
import {
    createProjassetsConfig,
    getAnimationAssets,
    getImageAssets,
    getJsonAssets,
    getSongAssets,
    getTileAssets,
    getTilemapAssets,
    getVisualConfig,
    ProjassetsAccountTheme,
    ProjassetsConfig,
    ProjassetsFrame,
    ProjassetsHost,
    ProjassetsOpenProject,
    PROJASSETS_LIST_RATE_LIMIT,
    PROJASSETS_LIST_RATE_WINDOW_MS,
    PROJASSETS_NOTIFY_DEBOUNCE_MS,
    PROJASSETS_NOTIFY_MAX_DELAY_MS,
} from "../../webapp/src/projassetsHost";
import {
    getParentOrigin as getProjassetsParentOrigin,
    getSimxApiLevel as getProjassetsApiLevel,
    ProjassetsAssetOfKind,
    ProjassetsAssetsReply,
    ProjassetsClient,
    ProjassetsError,
    ProjassetsErrorCode,
    ProjassetsErrorReply,
    ProjassetsImage,
    ProjassetsKind,
    ProjassetsListing,
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
    PROJPROGRAM_RATE_LIMIT,
    PROJPROGRAM_RATE_WINDOW_MS,
} from "../../webapp/src/projprogramHost";
import {
    getParentOrigin as getProjprogramParentOrigin,
    getSimxApiLevel as getProjprogramApiLevel,
    ProjprogramClient,
    ProjprogramDiagnostic,
    ProjprogramError,
    ProjprogramErrorCode,
    ProjprogramErrorReply,
    ProjprogramProgramReply,
    ProjprogramReply,
    ProjprogramRequest,
} from "../../pxtservices/projprogram";
import {
    filterHomeSearchCards,
    getAvailableHomeSearchFilters,
    getHomeSearchFilterOptionCounts,
} from "../../webapp/src/homeSearchFilters";
import { projectMayDeclareBlocks } from "../../webapp/src/cachedApiInfo";
import { MenuItem } from "blockly";
import { getInstanceDropdownOptions, isReservedInstanceValue, CREATE_INSTANCE_OPTION_VALUE, FieldInstanceDropdown, NO_INSTANCE_OPTION_VALUE, OPEN_INSTANCE_OPTION_VALUE } from "../../pxtblocks/fields/field_instancedropdown";
import type { FieldCustomDropdownOptions } from "../../pxtblocks/fields/field_utils";
import { getFixedInstanceDropdownOptions } from "../../pxtblocks/fields/symbolDropdownOptions";

pxt.appTarget = {
    versions: {
        target: "1"
    },
    appTheme: {
        defaultLocale: "en"
    }
} as any

const differ = new dmp.diff_match_patch();

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
    it("accepts relative names", () => {
        for (const name of ["notes.txt", "data/level1.json", "a..b.txt", ".hidden", "a\\b.txt"])
            chai.expect(isValidRelativeName(name), name).equals(true);
    });

    it("rejects names that are not relative paths or have empty, . or .. segments", () => {
        const names: unknown[] = [
            "", "..", "../x", "a/../b", "a/..", "a\\..\\b", "/abs", "\\abs",
            "a//b", "a/", "./a", "a/./b", ".", 42, undefined, null, ["a"],
        ];
        for (const name of names)
            chai.expect(isValidRelativeName(name), JSON.stringify(name)).equals(false);
    });

    it("prepends the folder to relative names", () => {
        chai.expect(getFolderFileName("owner/repo", "notes.txt")).equals("owner/repo/notes.txt");
        chai.expect(getFolderFileName("owner/repo", "other/repo/x.ts")).equals("owner/repo/other/repo/x.ts");
        chai.expect(getFolderFileName("owner/repo", "../x.ts")).equals(undefined);
    });

    it("refuses names ending in the reserved marker suffix, at any depth", () => {
        for (const name of ["x" + pxt.SIMX_EDITOR_MARKER_SUFFIX, "a/x" + pxt.SIMX_EDITOR_MARKER_SUFFIX, pxt.SIMX_EDITOR_MARKER_SUFFIX])
            chai.expect(getFolderFileName("owner/repo", name), name).equals(undefined);
        chai.expect(getFolderFileName("owner/repo", "x" + pxt.SIMX_EDITOR_MARKER_SUFFIX + ".md")).equals("owner/repo/x" + pxt.SIMX_EDITOR_MARKER_SUFFIX + ".md");
    });

    it("refuses names under a malformed folder", () => {
        chai.expect(getFolderFileName("../owner", "x.ts")).equals(undefined);
        chai.expect(getFolderFileName("", "x.ts")).equals(undefined);
        chai.expect(getFolderFileName("pxt_modules/owner", "x.ts")).equals(undefined);
    });

    it("makes visible exactly the stored folder files pxt.json lists, by relative name, in listed order", () => {
        const files = {
            [pxt.CONFIG_NAME]: JSON.stringify({
                files: [
                    "main.ts", "owner/repo/b.txt", "owner/repo/missing.ts", "owner/repo/d/a.txt",
                    "owner/repo2/c.txt", "other/repo/e.txt", "owner/repo/unsafe\\..\\f.txt",
                ]
            }),
            [pxt.MAIN_TS]: "let x = 1",
            [pxt.SIMSTATE_JSON]: "{}",
            "owner/repo/d/a.txt": "\u00e9",
            "owner/repo/b.txt": "bb",
            "owner/repo/unlisted.ts": "",
            "owner/repo2/c.txt": "c",
            "other/repo/e.txt": "e",
            "owner/repo/unsafe\\..\\f.txt": "f",
        };
        chai.expect(getVisibleFiles(files, "owner/repo")).deep.equals([
            { name: "b.txt", size: 2 },
            { name: "d/a.txt", size: 2 },
        ]);
        chai.expect(getVisibleFiles(files, "other/repo")).deep.equals([
            { name: "e.txt", size: 1 },
        ]);
    });

    it("sees no files when pxt.json is missing or malformed", () => {
        const inFolder = { "owner/repo/a.txt": "" };
        chai.expect(getVisibleFiles({ ...inFolder }, "owner/repo")).deep.equals([]);
        chai.expect(getVisibleFiles({ [pxt.CONFIG_NAME]: "{", ...inFolder }, "owner/repo")).deep.equals([]);
        chai.expect(getVisibleFiles({ [pxt.CONFIG_NAME]: `{"files":"owner/repo/a.txt"}`, ...inFolder }, "owner/repo")).deep.equals([]);
    });

    it("counts every stored file under the folder, listed or not, by its content and its relative name", () => {
        const files = {
            [pxt.CONFIG_NAME]: JSON.stringify({ files: ["owner/repo/a.txt"] }),
            "owner/repo/a.txt": "aaa",
            "owner/repo/hand-made.txt": "\u20ac",
            "owner/repo2/b.txt": "bbbbbbbb",
            "owner/b.txt": "bbbbbbbb",
            "main.ts": "bbbbbbbb",
        };
        chai.expect(getFolderUsage(files, "owner/repo")).deep.equals({
            bytes: pxt.Util.toUTF8Array("a.txt").length + 3 + pxt.Util.toUTF8Array("hand-made.txt").length + 3,
            files: 2,
        });
    });

    it("gives every key of one repository the repository's folder", () => {
        chai.expect(getProjfsFolder("owner/repo")).equals("owner/repo");
        chai.expect(getProjfsFolder("owner/repo/sub")).equals("owner/repo");
        chai.expect(getProjfsFolder("owner/repo/sub/deeper")).equals("owner/repo");
        chai.expect(getProjfsFolder("other/repo")).equals("other/repo");
    });

    it("gives a key in any letter case its repository's folder in lower case", () => {
        chai.expect(getProjfsFolder("Owner/Repo")).equals("owner/repo");
        chai.expect(getProjfsFolder("OWNER/repo/Sub")).equals("owner/repo");
    });

    it("gives a key that names no repository no folder", () => {
        for (const key of ["", "owner", "../owner", "pxt_modules/owner"])
            chai.expect(getProjfsFolder(key), key).equals(undefined);
    });

    it("finds a symbol of the project's own code declared in a file in the folder, at any depth", () => {
        chai.expect(isDeclaredInProjectFolder({ pkg: undefined, fileName: "owner/repo/things.g.ts" }, "owner/repo")).equals(true);
        chai.expect(isDeclaredInProjectFolder({ pkg: null, fileName: "owner/repo/sub/things.ts" }, "owner/repo")).equals(true);
    });

    it("does not find a symbol of the project's own code declared outside the folder", () => {
        for (const fileName of ["main.ts", "owner/other/things.g.ts", "owner/repo-two/things.g.ts", "other/owner/repo/things.g.ts"])
            chai.expect(isDeclaredInProjectFolder({ pkg: undefined, fileName }, "owner/repo"), fileName).equals(false);
    });

    it("does not find a symbol a package declares, whatever its file", () => {
        chai.expect(isDeclaredInProjectFolder({ pkg: "ext", fileName: "pxt_modules/ext/things.g.ts" }, "owner/repo")).equals(false);
        chai.expect(isDeclaredInProjectFolder({ pkg: "ext", fileName: "owner/repo/things.g.ts" }, "owner/repo")).equals(false);
    });
});

// lets every queued promise reaction run
function settle() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/** A clock for a projfs or projassets host, whose delays resolve only as a test advances it. */
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
        failWrites = false;
        failListing = false;
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
            if (this.failWrites) throw new Error("disk full");
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
            if (this.failListing) throw new Error("pxt.json could not be updated");
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

        /** Replaces every file as the editor package's setFiles does. */
        setFiles(files: pxt.Map<string>) {
            this.files = { ...files };
            this.notify(undefined);
        }

        dirtied: { name: string, content: string | undefined, stored: string | undefined }[] = [];
        failDirty = false;

        markDirty(name: string, content: string | undefined) {
            if (this.failDirty) throw new Error("editor gone");
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

    it("replies with the request's id", async () => {
        const replies: ProjfsReply[] = [];
        await host.handleMessageAsync(FOLDER, { type: "projfs", id: "abc", subtype: "list" }, r => replies.push(r as ProjfsReply), testFrame());
        chai.expect(replies[0].type).equals("projfs");
        chai.expect(replies[0].id).equals("abc");
    });

    it("lists only the folder's listed files, by relative name", async () => {
        const reply = await send({ subtype: "list" }) as ProjfsFilesReply;
        chai.expect(reply.subtype).equals("files");
        chai.expect(reply.files).deep.equals([
            { name: "listed.txt", size: 5 },
        ]);
    });

    it("reads a listed folder file by its relative name", async () => {
        const reply = await send({ subtype: "read", name: "listed.txt" }) as ProjfsContentReply;
        chai.expect(reply).deep.include({ subtype: "content", name: "listed.txt", content: "hello" });
    });

    it("reaches no file outside the folder", async () => {
        for (const name of [pxt.MAIN_TS, pxt.CONFIG_NAME, pxt.SIMSTATE_JSON, "owner/repo/listed.txt"])
            await expectError({ subtype: "read", name }, "NOT_FOUND");
    });

    it("reads main.ts only as a file the extension wrote under that name", async () => {
        await send({ subtype: "write", name: pxt.MAIN_TS, content: "scoped" });
        const reply = await send({ subtype: "read", name: pxt.MAIN_TS }) as ProjfsContentReply;
        chai.expect(reply).deep.include({ subtype: "content", name: pxt.MAIN_TS, content: "scoped" });
        chai.expect(project.files[pxt.MAIN_TS]).equals("let x = 1");
    });

    it("hides a stored folder file pxt.json does not list from list and read", async () => {
        project = newProject({ "owner/repo/unlisted.txt": "secret" });
        const listed = await send({ subtype: "list" }) as ProjfsFilesReply;
        chai.expect(listed.files.map(f => f.name)).deep.equals(["listed.txt"]);
        await expectError({ subtype: "read", name: "unlisted.txt" }, "NOT_FOUND");
    });

    it("refuses to read a missing file", async () => {
        await expectError({ subtype: "read", name: "nope.ts" }, "NOT_FOUND");
    });

    it("refuses invalid names on reads", async () => {
        for (const name of ["../main.ts", "/main.ts", "\\main.ts", "a//b", "a/", "", ".", "./a", "a/./b", 7, undefined])
            await expectError({ subtype: "read", name }, "INVALID_NAME");
    });

    it("lists and reads only under the frame's folder, whatever the message names", async () => {
        project = newProject({ [pxt.CONFIG_NAME]: JSON.stringify({ files: ["owner/repo/listed.txt", "other/repo/theirs.txt"] }), "other/repo/theirs.txt": "theirs" });
        const listed = await send({ subtype: "list", channel: "other/repo", scope: "other/repo" }) as ProjfsFilesReply;
        chai.expect(listed.files.map(f => f.name)).deep.equals(["listed.txt"]);
        await expectError({ subtype: "read", name: "theirs.txt", channel: "other/repo", scope: "other/repo" }, "NOT_FOUND");
    });

    it("keeps the folders of two repositories apart", async () => {
        project = newProject({
            [pxt.CONFIG_NAME]: JSON.stringify({ files: ["owner/repo/listed.txt", "other/repo/theirs.txt", "owner/repo2/sibling.txt"] }),
            "other/repo/theirs.txt": "theirs",
            "owner/repo2/sibling.txt": "sibling",
        });
        chai.expect(((await send({ subtype: "list" }, "other/repo")) as ProjfsFilesReply).files.map(f => f.name)).deep.equals(["theirs.txt"]);
        chai.expect(((await send({ subtype: "list" }, "owner/repo2")) as ProjfsFilesReply).files.map(f => f.name)).deep.equals(["sibling.txt"]);
        chai.expect(((await send({ subtype: "read", name: "theirs.txt" }, "other/repo")) as ProjfsContentReply).content).equals("theirs");
        await expectError({ subtype: "read", name: "theirs.txt" }, "NOT_FOUND");
        await expectError({ subtype: "read", name: "listed.txt" }, "NOT_FOUND", "other/repo");
    });

    it("writes a new file under the folder and lists it", async () => {
        const reply = await send({ subtype: "write", name: "notes/today.txt", content: "hi" });
        chai.expect(reply).deep.include({ subtype: "ack", name: "notes/today.txt" });
        chai.expect(project.files["owner/repo/notes/today.txt"]).equals("hi");
        chai.expect(project.listed()).deep.equals([pxt.MAIN_TS, "owner/repo/listed.txt", "owner/repo/notes/today.txt"]);
        chai.expect(project.calls).deep.equals(["write owner/repo/notes/today.txt", "list owner/repo/notes/today.txt"]);
    });

    it("replaces a listed file without changing pxt.json", async () => {
        await send({ subtype: "write", name: "listed.txt", content: "bye" });
        chai.expect(project.files["owner/repo/listed.txt"]).equals("bye");
        chai.expect(project.calls).deep.equals(["write owner/repo/listed.txt"]);
    });

    it("lists a stored folder file pxt.json no longer lists when it is written", async () => {
        project = newProject({ "owner/repo/dropped.txt": "old" });
        await send({ subtype: "write", name: "dropped.txt", content: "new" });
        chai.expect(project.calls).deep.equals(["write owner/repo/dropped.txt", "list owner/repo/dropped.txt"]);
    });

    it("sees its own writes on the next list", async () => {
        await send({ subtype: "write", name: "a.txt", content: "abc" });
        const reply = await send({ subtype: "list" }) as ProjfsFilesReply;
        chai.expect(reply.files.map(f => f.name)).deep.equals(["listed.txt", "a.txt"]);
    });

    it("refuses invalid names without touching the project", async () => {
        for (const name of ["../main.ts", "/main.ts", "\\main.ts", "a//b", "a/", "", "./a", 7]) {
            await expectError({ subtype: "write", name, content: "x" }, "INVALID_NAME");
            await expectError({ subtype: "delete", name }, "INVALID_NAME");
        }
        chai.expect(project.calls).deep.equals([]);
    });

    it("refuses writing an asset file, at any depth and letter case, without touching the project", async () => {
        for (const name of ["a.jres", "sub/A.JRES", "a/b/c.jres"]) {
            await expectError({ subtype: "write", name, content: "{}" }, "INVALID_NAME");
        }
        chai.expect(project.calls).deep.equals([]);
    });

    it("refuses names ending in the reserved marker suffix, at any depth, without touching the project", async () => {
        for (const name of ["x" + pxt.SIMX_EDITOR_MARKER_SUFFIX, "a/x" + pxt.SIMX_EDITOR_MARKER_SUFFIX]) {
            await expectError({ subtype: "write", name, content: "x" }, "INVALID_NAME");
            await expectError({ subtype: "read", name }, "INVALID_NAME");
            await expectError({ subtype: "delete", name }, "INVALID_NAME");
        }
        chai.expect(project.calls).deep.equals([]);
    });

    it("stores every write under the frame's folder, whatever the message names", async () => {
        const reply = await send({ subtype: "write", name: "other/repo/x.ts", content: "x", channel: "other/repo", scope: "other/repo" });
        chai.expect(reply).deep.include({ subtype: "ack", name: "other/repo/x.ts" });
        chai.expect(project.files["owner/repo/other/repo/x.ts"]).equals("x");
        chai.expect(Object.keys(project.files).filter(n => n.startsWith("other/"))).deep.equals([]);
    });

    it("only ever changes pxt.json entries under the folder", async () => {
        await send({ subtype: "write", name: "a.txt", content: "a" });
        await send({ subtype: "write", name: "b/c.txt", content: "c" });
        await send({ subtype: "delete", name: "a.txt" });
        await send({ subtype: "delete", name: "listed.txt" });
        const touched = project.calls.map(c => c.split(" ")[1]);
        chai.expect(touched.every(name => name.startsWith(FOLDER + "/"))).equals(true);
        chai.expect(project.listed()).deep.equals([pxt.MAIN_TS, "owner/repo/b/c.txt"]);
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

        /** A host whose subscribers a test can count. */
        class CountingHost extends ProjfsHost {
            subscriberCount() {
                return this.subscribers.length;
            }
        }

        it("acknowledges a subscription with the request's id, and a second one from the same frame changes nothing", async () => {
            const frame = testFrame();
            const received: (ProjfsReply | ProjfsNotification)[] = [];
            await host.handleMessageAsync(FOLDER, { type: "projfs", id: "s1", subtype: "subscribe" }, r => received.push(r), frame);
            await host.handleMessageAsync(FOLDER, { type: "projfs", id: "s2", subtype: "subscribe" }, r => received.push(r), frame);
            chai.expect(received).deep.equals([
                { type: "projfs", id: "s1", subtype: "ack" },
                { type: "projfs", id: "s2", subtype: "ack" },
            ]);
            received.length = 0;
            project.save("owner/repo/listed.txt", "edited");
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("listed.txt")]);
        });

        it("notifies the extension's own writes by their names relative to the folder", async () => {
            const received = await subscribe();
            await send({ subtype: "write", name: "listed.txt", content: "bye" });
            await send({ subtype: "write", name: "notes/today.txt", content: "hi" });
            chai.expect(received).deep.equals([]);
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("listed.txt", "notes/today.txt")]);
        });

        it("notifies the extension's own delete", async () => {
            const received = await subscribe();
            await send({ subtype: "delete", name: "listed.txt" });
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("listed.txt")]);
        });

        it("notifies a user's save through the editor package", async () => {
            const received = await subscribe();
            project.save("owner/repo/listed.txt", "edited in the text editor");
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("listed.txt")]);
        });

        it("notifies nothing for a save that leaves a file's content as it was", async () => {
            const received = await subscribe();
            project.save("owner/repo/listed.txt", "hello");
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
        });

        it("notifies a delete through the editor package", async () => {
            const received = await subscribe();
            await project.deleteFileAsync("owner/repo/listed.txt");
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("listed.txt")]);
        });

        it("notifies a file the editor package stores", async () => {
            const received = await subscribe();
            project.setFile("owner/repo/new.txt", "new");
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("new.txt")]);
        });

        it("notifies a change to a file's listing in pxt.json", async () => {
            project = newProject({ "owner/repo/unlisted.txt": "secret" });
            const received = await subscribe();
            project.save(pxt.CONFIG_NAME, pxtJson("owner/repo/listed.txt", "owner/repo/unlisted.txt"));
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("unlisted.txt")]);
            await project.setListedAsync("owner/repo/listed.txt", false);
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("unlisted.txt"), changed("listed.txt")]);
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

        it("notifies the names a replacement of every file adds, removes and changes", async () => {
            project = newProject({
                [pxt.CONFIG_NAME]: pxtJson("owner/repo/listed.txt", "owner/repo/kept.txt", "owner/repo/dropped.txt"),
                "owner/repo/kept.txt": "kept",
                "owner/repo/unlisted.txt": "secret",
                "owner/repo/dropped.txt": "dropped",
            });
            const received = await subscribe();
            project.setFiles({
                [pxt.CONFIG_NAME]: pxtJson("owner/repo/listed.txt", "owner/repo/kept.txt", "owner/repo/unlisted.txt", "owner/repo/added.txt"),
                [pxt.MAIN_TS]: "let x = 2",
                "owner/repo/listed.txt": "pulled",
                "owner/repo/kept.txt": "kept",
                "owner/repo/unlisted.txt": "secret",
                "owner/repo/added.txt": "added",
            });
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("listed.txt", "unlisted.txt", "dropped.txt", "added.txt")]);
        });

        it("notifies nothing for a replacement of every file that leaves the folder as it was", async () => {
            const received = await subscribe();
            project.setFiles({ ...project.files, [pxt.MAIN_TS]: "let x = 2" });
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
        });

        it("compares a replacement with the folder as last notified", async () => {
            const received = await subscribe();
            project.save("owner/repo/listed.txt", "edited");
            await passNotifyWindow();
            project.setFiles({ ...project.files, "owner/repo/listed.txt": "edited" });
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("listed.txt")]);
        });

        it("notifies a burst of changes once, each name once, in first-change order, the reported names before the compared ones", async () => {
            const received = await subscribe();
            project.save("owner/repo/b.txt", "b");
            project.save("owner/repo/a.txt", "a");
            project.save("owner/repo/b.txt", "b2");
            await send({ subtype: "write", name: "a.txt", content: "a2" });
            project.setFiles({ ...project.files, "owner/repo/z.txt": "z" });
            chai.expect(received).deep.equals([]);
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("b.txt", "a.txt", "z.txt")]);
            await advance(PROJFS_NOTIFY_MAX_DELAY_MS);
            chai.expect(received.length).equals(1);
        });

        it(`notifies once, ${PROJFS_NOTIFY_DEBOUNCE_MS} ms after the last change of a burst within the window`, async () => {
            const received = await subscribe();
            project.save("owner/repo/a.txt", "a");
            await advance(PROJFS_NOTIFY_DEBOUNCE_MS - 1);
            chai.expect(received).deep.equals([]);
            project.save("owner/repo/b.txt", "b");
            await advance(PROJFS_NOTIFY_DEBOUNCE_MS - 1);
            chai.expect(received).deep.equals([]);
            await advance(1);
            chai.expect(received).deep.equals([changed("a.txt", "b.txt")]);
            await advance(PROJFS_NOTIFY_MAX_DELAY_MS);
            chai.expect(received).deep.equals([changed("a.txt", "b.txt")]);
        });

        it(`notifies a stream of changes longer than ${PROJFS_NOTIFY_MAX_DELAY_MS} ms once at that delay, and once after the stream ends`, async () => {
            const received = await subscribe();
            const step = PROJFS_NOTIFY_DEBOUNCE_MS / 2;
            let count = 0;
            const change = () => project.save("owner/repo/stream.txt", `${count++}`);
            change();
            let elapsed = 0;
            while (elapsed + step < PROJFS_NOTIFY_MAX_DELAY_MS) {
                await advance(step);
                elapsed += step;
                change();
                chai.expect(received).deep.equals([]);
            }
            await advance(PROJFS_NOTIFY_MAX_DELAY_MS - elapsed - 1);
            chai.expect(received).deep.equals([]);
            await advance(1);
            chai.expect(received).deep.equals([changed("stream.txt")]);
            for (let i = 0; i < 4; i++) {
                change();
                await advance(step);
            }
            chai.expect(received).deep.equals([changed("stream.txt")]);
            await advance(PROJFS_NOTIFY_DEBOUNCE_MS - step - 1);
            chai.expect(received).deep.equals([changed("stream.txt")]);
            await advance(1);
            chai.expect(received).deep.equals([changed("stream.txt"), changed("stream.txt")]);
        });

        it("notifies each folder's subscribers of that folder's changes only", async () => {
            project = newProject({ [pxt.CONFIG_NAME]: pxtJson("owner/repo/listed.txt", "other/repo/theirs.txt"), "other/repo/theirs.txt": "theirs" });
            const mine = await subscribe("owner/repo");
            const theirs = await subscribe("other/repo");
            project.save("owner/repo/listed.txt", "edited");
            await passNotifyWindow();
            chai.expect(mine).deep.equals([changed("listed.txt")]);
            chai.expect(theirs).deep.equals([]);
            await send({ subtype: "delete", name: "theirs.txt" }, "other/repo");
            await passNotifyWindow();
            chai.expect(mine).deep.equals([changed("listed.txt")]);
            chai.expect(theirs).deep.equals([changed("theirs.txt")]);
        });

        it("notifies each subscribed frame of the folder, whichever registration of the repository it was created for", async () => {
            const simulatorFrame = await subscribe("owner/repo");
            const tabFrame = await subscribe("owner/repo");
            const subfolderFrame = await subscribe("Owner/Repo/sub");
            project.save("owner/repo/listed.txt", "edited");
            await passNotifyWindow();
            for (const received of [simulatorFrame, tabFrame, subfolderFrame])
                chai.expect(received).deep.equals([changed("listed.txt")]);
        });

        it("answers a subscription without queueing it behind the folder's requests", async () => {
            const release = project.holdWrites();
            const replies: ProjfsReply[] = [];
            const writing = post({ subtype: "write", name: "a.txt", content: "a" }, replies);
            const received = await subscribe();
            chai.expect(replies).deep.equals([]);
            release();
            await writing;
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack"]);
            await passNotifyWindow();
            chai.expect(received).deep.equals([changed("a.txt")]);
        });

        it("refuses a subscription from a key naming no repository, or while no project is open", async () => {
            await expectError({ subtype: "subscribe" }, "UNREGISTERED", "not a repository");
            host = new ProjfsHost(() => undefined, clock.now, clock.delay);
            await expectError({ subtype: "subscribe" }, "PROJECT_CLOSED");
        });

        it("drops a subscriber whose frame has been removed when it next notifies", async () => {
            const counting = new CountingHost(() => project, clock.now, clock.delay);
            host = counting;
            const removedFrame = testFrame();
            const removed = await subscribe(FOLDER, removedFrame);
            const kept = await subscribe();
            removedFrame.isConnected = false;
            project.save("owner/repo/listed.txt", "edited");
            await passNotifyWindow();
            chai.expect(removed).deep.equals([]);
            chai.expect(kept).deep.equals([changed("listed.txt")]);
            chai.expect(counting.subscriberCount()).equals(1);
        });

        it("drops subscribers whose frames have been removed when another frame subscribes", async () => {
            const counting = new CountingHost(() => project, clock.now, clock.delay);
            host = counting;
            const removedFrames = [testFrame(), testFrame()];
            for (const frame of removedFrames) await subscribe(FOLDER, frame);
            removedFrames.forEach(frame => frame.isConnected = false);
            await subscribe();
            chai.expect(counting.subscriberCount()).equals(1);
        });

        it("listens to a project once, however many frames subscribe", async () => {
            await subscribe("owner/repo");
            await subscribe("other/repo");
            await subscribe("owner/repo");
            chai.expect(project.changeListeners.size).equals(1);
        });

        it("drops a pending notification when the project closes, lets go of the project, and ends its subscriptions", async () => {
            const first = project;
            const received = await subscribe();
            first.save("owner/repo/listed.txt", "edited");
            host.close();
            chai.expect(first.changeListeners.size).equals(0);
            project = newProject();
            const next = await subscribe();
            await advance(PROJFS_NOTIFY_MAX_DELAY_MS);
            chai.expect(received).deep.equals([]);
            chai.expect(next).deep.equals([]);
            first.save("owner/repo/listed.txt", "edited again");
            await advance(PROJFS_NOTIFY_MAX_DELAY_MS);
            chai.expect(received).deep.equals([]);
        });

        it("ends a subscription when its project closes, and stops listening to it", async () => {
            const first = project;
            const received = await subscribe();
            project = newProject();
            first.save("owner/repo/listed.txt", "late");
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
            chai.expect(first.changeListeners.size).equals(0);
        });

        it("follows the project a new subscription is made in", async () => {
            const first = project;
            const old = await subscribe();
            project = newProject();
            const current = await subscribe();
            chai.expect(first.changeListeners.size).equals(0);
            chai.expect(project.changeListeners.size).equals(1);
            project.save("owner/repo/listed.txt", "edited");
            await passNotifyWindow();
            chai.expect(old).deep.equals([]);
            chai.expect(current).deep.equals([changed("listed.txt")]);
        });

        it("ends its subscriptions, and lets nothing escape, when the files cannot be read for a notification", async () => {
            const received = await subscribe();
            project.save("owner/repo/listed.txt", "edited");
            project.getFiles = () => { throw new Error("files unavailable"); };
            const reported: unknown[] = [];
            const report = pxt.reportException;
            pxt.reportException = e => { reported.push(e); };
            try {
                await passNotifyWindow();
            } finally {
                pxt.reportException = report;
            }
            chai.expect(reported.length).equals(1);
            chai.expect(project.changeListeners.size).equals(0);
            chai.expect(received).deep.equals([]);
        });
    });

    describe("quota", () => {
        const KIB = 1024;
        // what the folder holds before a test writes: listed.txt, its name and its content
        const HELD = pxt.Util.toUTF8Array("listed.txt").length + pxt.Util.toUTF8Array("hello").length;

        it("accepts a write that brings the folder to exactly the quota", async () => {
            const content = "x".repeat(PROJFS_FOLDER_QUOTA_BYTES - HELD - pxt.Util.toUTF8Array("big.txt").length);
            const reply = await send({ subtype: "write", name: "big.txt", content });
            chai.expect(reply.subtype).equals("ack");
        });

        it("counts a file's name toward the quota", async () => {
            const content = "x".repeat(PROJFS_FOLDER_QUOTA_BYTES - HELD - pxt.Util.toUTF8Array("big.txt").length);
            await expectError({ subtype: "write", name: "big2.txt", content }, "QUOTA_EXCEEDED");
            chai.expect((await send({ subtype: "write", name: "big.txt", content })).subtype).equals("ack");
        });

        it("refuses a write one byte over the quota, whole", async () => {
            const content = "x".repeat(PROJFS_FOLDER_QUOTA_BYTES - HELD - pxt.Util.toUTF8Array("big.txt").length + 1);
            const before = { ...project.files };
            await expectError({ subtype: "write", name: "big.txt", content }, "QUOTA_EXCEEDED");
            chai.expect(project.calls).deep.equals([]);
            chai.expect(project.files).deep.equals(before);
        });

        it("subtracts the size of the file a write replaces", async () => {
            project = newProject({ "owner/repo/data.bin": "x".repeat(400 * KIB) });
            const replace = await send({ subtype: "write", name: "data.bin", content: "y".repeat(500 * KIB) });
            chai.expect(replace.subtype).equals("ack");
            await expectError({ subtype: "write", name: "second.bin", content: "z".repeat(20 * KIB) }, "QUOTA_EXCEEDED");
        });

        it("counts unlisted files in the folder and ignores other folders", async () => {
            project = newProject({
                "owner/repo/hand-made.txt": "x".repeat(300 * KIB),
                "owner/repo2/big.txt": "x".repeat(500 * KIB),
                "main2.ts": "x".repeat(500 * KIB),
            });
            chai.expect(await send({ subtype: "write", name: "ok.txt", content: "x".repeat(200 * KIB) })).deep.include({ subtype: "ack", name: "ok.txt" });
            await expectError({ subtype: "write", name: "over.txt", content: "x".repeat(12 * KIB) }, "QUOTA_EXCEEDED");
        });

        it("counts multi-byte characters and data: URIs at their stored length", async () => {
            // two, three and four UTF-8 bytes: nine in all
            const wide = "\u00e9\u20ac\ud83d\ude00";
            const fill = "x".repeat(PROJFS_FOLDER_QUOTA_BYTES - HELD - "wide.txt".length - 9);
            await expectError({ subtype: "write", name: "wide.txt", content: wide + fill + "x" }, "QUOTA_EXCEEDED");
            chai.expect((await send({ subtype: "write", name: "wide.txt", content: wide + fill })).subtype).equals("ack");
            project = newProject();
            const euros = "\u20ac".repeat(Math.floor(PROJFS_FOLDER_QUOTA_BYTES / 3));
            await expectError({ subtype: "write", name: "euros.txt", content: euros }, "QUOTA_EXCEEDED");
            const uri = "data:application/octet-stream;base64," + "A".repeat(PROJFS_FOLDER_QUOTA_BYTES);
            await expectError({ subtype: "write", name: "blob.bin", content: uri }, "QUOTA_EXCEEDED");
        });

        it("frees the size of a deleted file", async () => {
            project = newProject({ "owner/repo/data.bin": "x".repeat(500 * KIB) });
            await expectError({ subtype: "write", name: "second.bin", content: "z".repeat(20 * KIB) }, "QUOTA_EXCEEDED");
            await send({ subtype: "delete", name: "data.bin" });
            chai.expect((await send({ subtype: "write", name: "second.bin", content: "z".repeat(20 * KIB) })).subtype).equals("ack");
        });

        it("accepts a write that leaves a folder over the quota smaller, and refuses one that grows it", async () => {
            const half = PROJFS_FOLDER_QUOTA_BYTES / 2;
            project = newProject({ "owner/repo/a.bin": "x".repeat(half + KIB), "owner/repo/b.bin": "x".repeat(half + KIB) });
            await expectError({ subtype: "write", name: "c.txt", content: "x" }, "QUOTA_EXCEEDED");
            chai.expect((await send({ subtype: "write", name: "a.bin", content: "y".repeat(half) })).subtype).equals("ack");
            chai.expect(project.files["owner/repo/a.bin"]).equals("y".repeat(half));
            await expectError({ subtype: "write", name: "a.bin", content: "y".repeat(half + 1) }, "QUOTA_EXCEEDED");
        });

        it(`refuses a write that would store more than ${PROJFS_MAX_FOLDER_FILES} files in the folder, and accepts a replacement`, async () => {
            const files: pxt.Map<string> = {};
            for (let i = 1; i < PROJFS_MAX_FOLDER_FILES - 1; i++)
                files[`owner/repo/f${i}.txt`] = "x";
            project = newProject(files);
            chai.expect((await send({ subtype: "write", name: "last.txt", content: "x" })).subtype).equals("ack");
            await expectError({ subtype: "write", name: "over.txt", content: "x" }, "QUOTA_EXCEEDED");
            chai.expect((await send({ subtype: "write", name: "last.txt", content: "y" })).subtype).equals("ack");
            chai.expect(project.files).not.to.have.property("owner/repo/over.txt");
        });

        it("refuses a write whose content alone exceeds the quota on arrival, without a place in the queue", async () => {
            project = undefined;
            const replies: ProjfsReply[] = [];
            const posted: Promise<void>[] = [];
            for (let i = 0; i < PROJFS_MAX_PENDING_REQUESTS - 1; i++)
                posted.push(post({ subtype: "list" }, replies));
            posted.push(post({ subtype: "write", name: "big.txt", content: "x".repeat(PROJFS_FOLDER_QUOTA_BYTES + 1) }, replies));
            posted.push(post({ subtype: "list" }, replies));
            await Promise.all(posted);
            const codes = replies.map(r => (r as ProjfsErrorReply).code);
            chai.expect(codes.slice(PROJFS_MAX_PENDING_REQUESTS - 1)).deep.equals(["QUOTA_EXCEEDED", "PROJECT_CLOSED"]);
        });
    });

    describe("name rules", () => {
        it("refuses a written name longer than the limit", async () => {
            const longest = "n".repeat(PROJFS_MAX_NAME_LENGTH - ".txt".length) + ".txt";
            chai.expect((await send({ subtype: "write", name: longest, content: "x" })).subtype).equals("ack");
            await expectError({ subtype: "write", name: "n" + longest, content: "x" }, "INVALID_NAME");
        });

        it("refuses a written name with more segments than the limit", async () => {
            const deepest = new Array(PROJFS_MAX_NAME_SEGMENTS - 1).fill("d").join("/") + "/x.txt";
            chai.expect((await send({ subtype: "write", name: deepest, content: "x" })).subtype).equals("ack");
            await expectError({ subtype: "write", name: "d/" + deepest, content: "x" }, "INVALID_NAME");
        });

        it("refuses written names the file explorer refuses for a new file", async () => {
            const names = [
                "a b.txt", "notes.txt ", " notes.txt", "a:b.txt", "a?b.txt", "a#b.txt", "a*b.txt", "a\\b.txt",
                "caf\u00e9.txt", "a\u0001.txt", ".hidden", "-a.txt",
            ];
            for (const name of names) {
                chai.expect(pxt.isValidProjectFileName(name), name).equals(false);
                await expectError({ subtype: "write", name, content: "x" }, "INVALID_NAME");
            }
            chai.expect(project.calls).deep.equals([]);
        });

        it("refuses a written name whose last segment is pxt.json, at any depth and in any letter case, without touching the project", async () => {
            for (const name of [pxt.CONFIG_NAME, `sub/${pxt.CONFIG_NAME}`, "a/b/PXT.JSON"])
                await expectError({ subtype: "write", name, content: "{}" }, "INVALID_NAME");
            chai.expect(project.calls).deep.equals([]);
            chai.expect((await send({ subtype: "write", name: `${pxt.CONFIG_NAME}.txt`, content: "{}" })).subtype).equals("ack");
        });

        it("applies the written-name rules to writes only, so a stored file named otherwise can still be read and deleted", async () => {
            project = newProject({
                [pxt.CONFIG_NAME]: JSON.stringify({ files: ["owner/repo/hand made.txt"] }),
                "owner/repo/hand made.txt": "by hand",
            });
            chai.expect(((await send({ subtype: "read", name: "hand made.txt" })) as ProjfsContentReply).content).equals("by hand");
            chai.expect((await send({ subtype: "delete", name: "hand made.txt" })).subtype).equals("ack");
        });
    });

    it("deletes a file and removes it from pxt.json", async () => {
        const reply = await send({ subtype: "delete", name: "listed.txt" });
        chai.expect(reply).deep.include({ subtype: "ack", name: "listed.txt" });
        chai.expect(project.files).not.to.have.property("owner/repo/listed.txt");
        chai.expect(project.listed()).deep.equals([pxt.MAIN_TS]);
    });

    it("deletes a stored folder file pxt.json does not list", async () => {
        project = newProject({ "owner/repo/unlisted.txt": "x" });
        await send({ subtype: "delete", name: "unlisted.txt" });
        chai.expect(project.calls).deep.equals(["delete owner/repo/unlisted.txt"]);
    });

    it("removes a listed folder file that is not stored", async () => {
        project = newProject();
        delete project.files["owner/repo/listed.txt"];
        await send({ subtype: "delete", name: "listed.txt" });
        chai.expect(project.calls).deep.equals(["unlist owner/repo/listed.txt"]);
    });

    it("removes a deleted file from the testFiles list of pxt.json, stored or not", async () => {
        project = newProject({
            [pxt.CONFIG_NAME]: JSON.stringify({ files: [pxt.MAIN_TS], testFiles: ["owner/repo/stored.ts", "owner/repo/missing.ts", "test.ts"] }),
            "owner/repo/stored.ts": "test",
        });
        chai.expect((await send({ subtype: "delete", name: "stored.ts" })).subtype).equals("ack");
        chai.expect((await send({ subtype: "delete", name: "missing.ts" })).subtype).equals("ack");
        chai.expect(project.calls).deep.equals(["delete owner/repo/stored.ts", "unlist owner/repo/missing.ts"]);
        chai.expect((JSON.parse(project.files[pxt.CONFIG_NAME]) as pxt.PackageConfig).testFiles).deep.equals(["test.ts"]);
    });

    it("refuses to delete a file that does not exist", async () => {
        await expectError({ subtype: "delete", name: "nope.txt" }, "NOT_FOUND");
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

        it("applies a burst over the limit completely, in arrival order, answering each request as it applies", async () => {
            const replies: ProjfsReply[] = [];
            const count = 2 * PROJFS_RATE_LIMIT + 5;
            const posted: Promise<void>[] = [];
            for (let i = 0; i < count; i++)
                posted.push(post({ subtype: "write", name: i % 2 ? "shared.txt" : `f${i}.txt`, content: `${i}` }, replies));
            await settle();
            chai.expect(replies.length).equals(PROJFS_RATE_LIMIT);
            await advance(PROJFS_RATE_WINDOW_MS);
            chai.expect(replies.length).equals(2 * PROJFS_RATE_LIMIT);
            await advance(PROJFS_RATE_WINDOW_MS);
            await Promise.all(posted);
            chai.expect(replies.map(r => r.subtype)).deep.equals(new Array(count).fill("ack"));
            chai.expect(replies.map(r => r.id)).deep.equals(new Array(count).fill(0).map((_, i) => `${i}`));
            chai.expect(project.calls.filter(c => c.startsWith("write"))).deep.equals(
                new Array(count).fill(0).map((_, i) => `write owner/repo/${i % 2 ? "shared.txt" : `f${i}.txt`}`));
            chai.expect(project.files["owner/repo/shared.txt"]).equals(`${count - 2}`);
        });

        it("keeps requests behind a held write waiting, so they see it", async () => {
            await writeMany(PROJFS_RATE_LIMIT);
            const replies: ProjfsReply[] = [];
            const held = post({ subtype: "write", name: "listed.txt", content: "new" }, replies);
            const read = post({ subtype: "read", name: "listed.txt" }, replies);
            await settle();
            chai.expect(replies).deep.equals([]);
            await advance(PROJFS_RATE_WINDOW_MS);
            await Promise.all([held, read]);
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack", "content"]);
            chai.expect((replies[1] as ProjfsContentReply).content).equals("new");
        });

        it("does not limit reads", async () => {
            await writeMany(PROJFS_RATE_LIMIT);
            chai.expect((await send({ subtype: "list" })).subtype).equals("files");
            chai.expect((await send({ subtype: "read", name: "listed.txt" })).subtype).equals("content");
        });

        it("limits each repository's folder separately, so one folder's held writes never hold another's", async () => {
            await writeMany(PROJFS_RATE_LIMIT);
            const replies: ProjfsReply[] = [];
            const held = post({ subtype: "write", name: "extra.txt", content: "x" }, replies);
            const reply = await send({ subtype: "write", name: "x.txt", content: "x" }, "other/repo");
            chai.expect(reply).deep.include({ subtype: "ack", name: "x.txt" });
            chai.expect(project.files["other/repo/x.txt"]).equals("x");
            chai.expect(replies).deep.equals([]);
            await advance(PROJFS_RATE_WINDOW_MS);
            await held;
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack"]);
        });

        it(`refuses writes and deletes beyond ${PROJFS_MAX_PENDING_REQUESTS} waiting for replies, applying the waiting ones`, async () => {
            const replies: ProjfsReply[] = [];
            const posted: Promise<void>[] = [];
            for (let i = 0; i < PROJFS_MAX_PENDING_REQUESTS; i++)
                posted.push(post({ subtype: "write", name: `f${i % 100}.txt`, content: `${i}` }, replies));
            posted.push(post({ subtype: "write", name: "extra.txt", content: "x" }, replies));
            posted.push(post({ subtype: "delete", name: "f0.txt" }, replies));

            while (replies.length < PROJFS_MAX_PENDING_REQUESTS)
                await advance(PROJFS_RATE_WINDOW_MS);
            await Promise.all(posted);
            chai.expect(replies.slice(0, PROJFS_MAX_PENDING_REQUESTS).every(r => r.subtype === "ack")).equals(true);
            chai.expect(replies.slice(PROJFS_MAX_PENDING_REQUESTS).map(r => (r as ProjfsErrorReply).code)).deep.equals(["RATE_LIMITED", "RATE_LIMITED"]);
            chai.expect(project.files).not.to.have.property("owner/repo/extra.txt");
            chai.expect(project.files).to.have.property("owner/repo/f0.txt");
            chai.expect((await send({ subtype: "write", name: "later.txt", content: "x" })).subtype).equals("ack");
        });

        it("sends a RATE_LIMITED reply only after the replies to the requests before it", async () => {
            const replies: ProjfsReply[] = [];
            const posted: Promise<void>[] = [];
            for (let i = 0; i < PROJFS_MAX_PENDING_REQUESTS; i++)
                posted.push(post({ subtype: "write", name: `f${i % 100}.txt`, content: "x" }, replies));
            posted.push(post({ subtype: "write", name: "extra.txt", content: "x" }, replies));
            await settle();
            chai.expect(replies.map(r => r.subtype)).deep.equals(new Array(PROJFS_RATE_LIMIT).fill("ack"));

            while (replies.length < PROJFS_MAX_PENDING_REQUESTS)
                await advance(PROJFS_RATE_WINDOW_MS);
            await Promise.all(posted);
            chai.expect(replies.map(r => r.id)).deep.equals(new Array(PROJFS_MAX_PENDING_REQUESTS + 1).fill(0).map((_, i) => `${i}`));
            chai.expect((replies[PROJFS_MAX_PENDING_REQUESTS] as ProjfsErrorReply).code).equals("RATE_LIMITED");
        });

        it(`counts reads and lists toward the ${PROJFS_MAX_PENDING_REQUESTS} requests that may wait for replies`, async () => {
            const replies: ProjfsReply[] = [];
            const posted: Promise<void>[] = [];
            for (let i = 0; i < PROJFS_MAX_PENDING_REQUESTS; i++)
                posted.push(post(i % 2 ? { subtype: "list" } : { subtype: "read", name: "listed.txt" }, replies));
            posted.push(post({ subtype: "read", name: "listed.txt" }, replies));
            posted.push(post({ subtype: "list" }, replies));
            await Promise.all(posted);
            chai.expect(replies.slice(0, PROJFS_MAX_PENDING_REQUESTS).every(r => r.subtype !== "error")).equals(true);
            chai.expect(replies.slice(PROJFS_MAX_PENDING_REQUESTS).map(r => (r as ProjfsErrorReply).code)).deep.equals(["RATE_LIMITED", "RATE_LIMITED"]);
            chai.expect((await send({ subtype: "list" })).subtype).equals("files");
        });

        it("measures the rate window on a monotonic clock, unmoved by changes to the wall clock", async () => {
            const wallClock = Date.now;
            const perf = performance as { now?: () => number };
            let monotonic = 0;
            let wall = 1000000;
            Date.now = () => wall;
            perf.now = () => monotonic;
            try {
                host = new ProjfsHost(() => project, undefined, clock.delay);
                await writeMany(PROJFS_RATE_LIMIT);
                wall += 2 * PROJFS_RATE_WINDOW_MS;
                const replies: ProjfsReply[] = [];
                const held = post({ subtype: "write", name: "extra.txt", content: "x" }, replies);
                await settle();
                chai.expect(replies).deep.equals([]);
                monotonic += PROJFS_RATE_WINDOW_MS;
                await advance(PROJFS_RATE_WINDOW_MS);
                await held;
                chai.expect(replies.map(r => r.subtype)).deep.equals(["ack"]);
            } finally {
                Date.now = wallClock;
                delete perf.now;
            }
        });
    });

    describe("repository folders", () => {
        it("serves a key that names a subfolder of a repository from the repository's folder", async () => {
            const listed = await send({ subtype: "list" }, "owner/repo/sub") as ProjfsFilesReply;
            chai.expect(listed.files.map(f => f.name)).deep.equals(["listed.txt"]);
            chai.expect(((await send({ subtype: "read", name: "listed.txt" }, "owner/repo/sub")) as ProjfsContentReply).content).equals("hello");
            chai.expect((await send({ subtype: "write", name: "child.txt", content: "c" }, "owner/repo/sub")).subtype).equals("ack");
            chai.expect(project.files["owner/repo/child.txt"]).equals("c");
            chai.expect(((await send({ subtype: "read", name: "child.txt" })) as ProjfsContentReply).content).equals("c");
            chai.expect(Object.keys(project.files).filter(n => n.startsWith("owner/repo/sub/"))).deep.equals([]);
        });

        it("gives the keys of one repository one quota", async () => {
            const content = "x".repeat(PROJFS_FOLDER_QUOTA_BYTES / 2);
            chai.expect((await send({ subtype: "write", name: "a.bin", content }, "owner/repo")).subtype).equals("ack");
            await expectError({ subtype: "write", name: "b.bin", content }, "QUOTA_EXCEEDED", "owner/repo/sub");
            chai.expect((await send({ subtype: "write", name: "b.bin", content }, "other/repo")).subtype).equals("ack");
        });

        it("gives the keys of one repository one rate window", async () => {
            await writeMany(PROJFS_RATE_LIMIT, "owner/repo");
            const replies: ProjfsReply[] = [];
            const held = post({ subtype: "write", name: "extra.txt", content: "x" }, replies, "owner/repo/sub");
            await settle();
            chai.expect(replies).deep.equals([]);
            chai.expect((await send({ subtype: "write", name: "x.txt", content: "x" }, "other/repo")).subtype).equals("ack");
            await advance(PROJFS_RATE_WINDOW_MS);
            await held;
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack"]);
        });

        it("serves a key in any letter case from its repository's lower-case folder, sharing its quota and queue", async () => {
            chai.expect((await send({ subtype: "write", name: "mixed.txt", content: "m" }, "Owner/Repo")).subtype).equals("ack");
            chai.expect(project.files["owner/repo/mixed.txt"]).equals("m");
            chai.expect(Object.keys(project.files).filter(n => n.startsWith("Owner/"))).deep.equals([]);
            chai.expect(((await send({ subtype: "read", name: "mixed.txt" }, "owner/repo")) as ProjfsContentReply).content).equals("m");
            const content = "x".repeat(PROJFS_FOLDER_QUOTA_BYTES / 2);
            chai.expect((await send({ subtype: "write", name: "a.bin", content }, "OWNER/REPO/sub")).subtype).equals("ack");
            await expectError({ subtype: "write", name: "b.bin", content }, "QUOTA_EXCEEDED");
        });

        it("refuses every request from a key that names no repository with UNREGISTERED", async () => {
            await expectError({ subtype: "list" }, "UNREGISTERED", "notarepo");
            await expectError({ subtype: "write", name: "a.txt", content: "x" }, "UNREGISTERED", "notarepo");
            chai.expect(project.calls).deep.equals([]);
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

        it("completes a request that began applying in its project, and refuses the requests queued behind it", async () => {
            const first = project;
            const release = first.holdWrites();
            const replies: ProjfsReply[] = [];
            const applying = post({ subtype: "write", name: "a.txt", content: "a" }, replies);
            const queued = post({ subtype: "write", name: "b.txt", content: "b" }, replies);
            const read = post({ subtype: "read", name: "listed.txt" }, replies);
            await settle();
            project = newProject();
            release();
            await Promise.all([applying, queued, read]);
            chai.expect(replies.map(r => r.subtype === "error" ? (r as ProjfsErrorReply).code : r.subtype))
                .deep.equals(["ack", "PROJECT_CLOSED", "PROJECT_CLOSED"]);
            chai.expect(first.calls).deep.equals(["write owner/repo/a.txt", "list owner/repo/a.txt"]);
            chai.expect(project.calls).deep.equals([]);
        });

        it("treats a reopened project as another project", async () => {
            const release = project.holdWrites();
            const replies: ProjfsReply[] = [];
            const applying = post({ subtype: "write", name: "a.txt", content: "a" }, replies);
            const queued = post({ subtype: "write", name: "b.txt", content: "b" }, replies);
            await settle();
            project = new FakeProject({ ...project.files });
            release();
            await Promise.all([applying, queued]);
            chai.expect((replies[1] as ProjfsErrorReply).code).equals("PROJECT_CLOSED");
            chai.expect(project.files).not.to.have.property("owner/repo/b.txt");
        });

        it("applies requests that arrive after a switch to the project open then", async () => {
            project = newProject();
            await send({ subtype: "write", name: "a.txt", content: "a" });
            chai.expect(project.files["owner/repo/a.txt"]).equals("a");
        });

        it("refuses requests that arrive when no project is open", async () => {
            project = undefined;
            await expectError({ subtype: "list" }, "PROJECT_CLOSED");
            await expectError({ subtype: "write", name: "a.txt", content: "x" }, "PROJECT_CLOSED");
        });

        it("refuses a request held past the project's close, and every request until another project loads", async () => {
            const tracker = new OpenProjectTracker<FakeProject>(() => project);
            host = new ProjfsHost(() => tracker.get(), clock.now, clock.delay);
            await writeMany(PROJFS_RATE_LIMIT);
            const closed = project;
            const replies: ProjfsReply[] = [];
            const held = post({ subtype: "write", name: "extra.txt", content: "x" }, replies);
            tracker.close();
            await advance(PROJFS_RATE_WINDOW_MS);
            await held;
            chai.expect((replies[0] as ProjfsErrorReply).code).equals("PROJECT_CLOSED");
            chai.expect(closed.files).not.to.have.property("owner/repo/extra.txt");
            await expectError({ subtype: "list" }, "PROJECT_CLOSED");
            project = newProject();
            chai.expect((await send({ subtype: "list" })).subtype).equals("files");
        });
    });

    it("applies requests one at a time, in order, so a request on another folder waits for the one applying", async () => {
        project = newProject({ "other/repo/old.txt": "old" });
        const release = project.holdWrites();
        const replies: ProjfsReply[] = [];
        const written = post({ subtype: "write", name: "a.txt", content: "a" }, replies);
        const deleted = post({ subtype: "delete", name: "old.txt" }, replies, "other/repo");
        await settle();
        chai.expect(project.calls).deep.equals([]);
        chai.expect(replies).deep.equals([]);
        release();
        await Promise.all([written, deleted]);
        chai.expect(replies.map(r => r.id)).deep.equals(["0", "1"]);
        chai.expect(project.calls).deep.equals(["write owner/repo/a.txt", "list owner/repo/a.txt", "delete other/repo/old.txt"]);
    });

    it("fails a write whose file cannot be listed, leaving it stored for a retry to list", async () => {
        project.failListing = true;
        await expectError({ subtype: "write", name: "a.txt", content: "x" }, "FAILED");
        chai.expect(project.files["owner/repo/a.txt"]).equals("x");
        await expectError({ subtype: "read", name: "a.txt" }, "NOT_FOUND");
        project.failListing = false;
        chai.expect((await send({ subtype: "write", name: "a.txt", content: "x" })).subtype).equals("ack");
        chai.expect(((await send({ subtype: "read", name: "a.txt" })) as ProjfsContentReply).content).equals("x");
    });

    it("acknowledges a write and a delete while pxt.json is malformed, leaving pxt.json as it is", async () => {
        for (const config of ["not json", JSON.stringify({ name: "no files list" })]) {
            project = newProject({ [pxt.CONFIG_NAME]: config });
            chai.expect((await send({ subtype: "write", name: "a.txt", content: "a" })).subtype, config).equals("ack");
            chai.expect((await send({ subtype: "delete", name: "listed.txt" })).subtype, config).equals("ack");
            chai.expect(project.files[pxt.CONFIG_NAME], config).equals(config);
            chai.expect(project.files["owner/repo/a.txt"], config).equals("a");
            chai.expect(project.files, config).not.to.have.property("owner/repo/listed.txt");
        }
    });

    it("fails a request the project cannot apply and keeps serving", async () => {
        project.failWrites = true;
        const reply = await expectError({ subtype: "write", name: "a.txt", content: "x" }, "FAILED");
        chai.expect(reply.message).equals("disk full");
        project.failWrites = false;
        chai.expect((await send({ subtype: "write", name: "a.txt", content: "x" })).subtype).equals("ack");
    });

    it("refuses malformed requests", async () => {
        await expectError({ subtype: "rename", name: "a.txt" }, "INVALID_REQUEST");
        await expectError({ subtype: "write", name: "a.txt", content: 42 }, "INVALID_REQUEST");
        const replies: ProjfsReply[] = [];
        await host.handleMessageAsync(FOLDER, "not a request", r => replies.push(r as ProjfsReply), testFrame());
        chai.expect((replies[0] as ProjfsErrorReply).code).equals("INVALID_REQUEST");
    });

    describe("dirty", () => {
        it("passes a flagged write through the edit pipeline after saving and listing it", async () => {
            const reply = await send({ subtype: "write", name: "code.ts", content: "let b = 1", dirty: true });
            chai.expect(reply).deep.include({ subtype: "ack", name: "code.ts" });
            chai.expect(project.calls).deep.equals(["write owner/repo/code.ts", "list owner/repo/code.ts", "dirty owner/repo/code.ts"]);
            chai.expect(project.dirtied).deep.equals([{ name: "owner/repo/code.ts", content: "let b = 1", stored: "let b = 1" }]);
        });

        it("passes a flagged replacement through the edit pipeline", async () => {
            await send({ subtype: "write", name: "listed.txt", content: "bye", dirty: true });
            chai.expect(project.calls).deep.equals(["write owner/repo/listed.txt", "dirty owner/repo/listed.txt"]);
        });

        it("passes a flagged delete through the edit pipeline after deleting and unlisting the file", async () => {
            await send({ subtype: "delete", name: "listed.txt", dirty: true });
            chai.expect(project.calls).deep.equals(["delete owner/repo/listed.txt", "dirty owner/repo/listed.txt"]);
            chai.expect(project.listed()).deep.equals([pxt.MAIN_TS]);
            chai.expect(project.dirtied).deep.equals([{ name: "owner/repo/listed.txt", content: undefined, stored: undefined }]);
        });

        it("keeps unflagged and dirty: false changes out of the edit pipeline", async () => {
            await send({ subtype: "write", name: "a.txt", content: "a" });
            await send({ subtype: "write", name: "b.txt", content: "b", dirty: false });
            await send({ subtype: "delete", name: "a.txt" });
            await send({ subtype: "delete", name: "b.txt", dirty: false });
            chai.expect(project.dirtied).deep.equals([]);
        });

        it("refuses a flag that is not a boolean without touching the project", async () => {
            for (const dirty of ["true", 1, null, {}]) {
                await expectError({ subtype: "write", name: "a.txt", content: "a", dirty }, "INVALID_REQUEST");
                await expectError({ subtype: "delete", name: "listed.txt", dirty }, "INVALID_REQUEST");
            }
            chai.expect(project.calls).deep.equals([]);
        });

        it("keeps refused flagged changes out of the edit pipeline", async () => {
            await expectError({ subtype: "write", name: "../x.ts", content: "x", dirty: true }, "INVALID_NAME");
            await expectError({ subtype: "delete", name: "nope.txt", dirty: true }, "NOT_FOUND");
            await expectError({ subtype: "write", name: "big.txt", content: "x".repeat(PROJFS_FOLDER_QUOTA_BYTES), dirty: true }, "QUOTA_EXCEEDED");
            chai.expect(project.calls).deep.equals([]);
        });

        it("counts flagged and unflagged changes against the same rate limit, holding a flagged change until it applies", async () => {
            for (let i = 0; i < PROJFS_RATE_LIMIT; i++)
                await send({ subtype: "write", name: `f${i}.txt`, content: "x", dirty: i % 2 === 0 || undefined });
            const replies: ProjfsReply[] = [];
            const held = post({ subtype: "write", name: "extra.txt", content: "x", dirty: true }, replies);
            await settle();
            chai.expect(replies).deep.equals([]);
            chai.expect(project.dirtied.length).equals(PROJFS_RATE_LIMIT / 2);
            await advance(PROJFS_RATE_WINDOW_MS);
            await held;
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack"]);
            chai.expect(project.dirtied.length).equals(PROJFS_RATE_LIMIT / 2 + 1);
        });

        it("applies flagged and unflagged changes one at a time, in order", async () => {
            const replies: ProjfsReply[] = [];
            const collect = (r: ProjfsReply | ProjfsNotification) => replies.push(r as ProjfsReply);
            host.handleMessageAsync(FOLDER, { type: "projfs", id: "1", subtype: "write", name: "a.ts", content: "1", dirty: true }, collect, testFrame());
            host.handleMessageAsync(FOLDER, { type: "projfs", id: "2", subtype: "write", name: "b.txt", content: "2" }, collect, testFrame());
            await host.handleMessageAsync(FOLDER, { type: "projfs", id: "3", subtype: "write", name: "a.ts", content: "3", dirty: true }, collect, testFrame());
            chai.expect(replies.map(r => r.id)).deep.equals(["1", "2", "3"]);
            chai.expect(project.calls).deep.equals([
                "write owner/repo/a.ts", "list owner/repo/a.ts", "dirty owner/repo/a.ts",
                "write owner/repo/b.txt", "list owner/repo/b.txt",
                "write owner/repo/a.ts", "dirty owner/repo/a.ts",
            ]);
            chai.expect(project.dirtied.map(d => d.stored)).deep.equals(["1", "3"]);
        });

        it("fails a flagged change the edit pipeline cannot take, with the change saved", async () => {
            project.failDirty = true;
            const reply = await expectError({ subtype: "write", name: "a.ts", content: "x", dirty: true }, "FAILED");
            chai.expect(reply.message).equals("editor gone");
            chai.expect(project.files["owner/repo/a.ts"]).equals("x");
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

        it("refuses a flagged delete whose project closed while it was deleted, with the file deleted in that project", async () => {
            const first = project;
            let release!: () => void;
            const gate = new Promise<void>(resolve => release = resolve);
            const deleteFileAsync = first.deleteFileAsync.bind(first);
            first.deleteFileAsync = async (name: string) => {
                await gate;
                await deleteFileAsync(name);
            };
            const replies: ProjfsReply[] = [];
            const applying = post({ subtype: "delete", name: "listed.txt", dirty: true }, replies);
            await settle();
            project = newProject();
            release();
            await applying;
            chai.expect((replies[0] as ProjfsErrorReply).code).equals("PROJECT_CLOSED");
            chai.expect(first.files).not.to.have.property("owner/repo/listed.txt");
            chai.expect(first.dirtied).deep.equals([]);
            chai.expect(project.calls).deep.equals([]);
        });

        it("applies flagged changes as artifacts where no editor takes user edits", async () => {
            const files: pxt.Map<string> = { [pxt.CONFIG_NAME]: JSON.stringify({ files: [] }) };
            const withoutEditor: ProjfsProject = {
                loadedAsync: () => Promise.resolve(),
                getFiles: () => ({ ...files }),
                writeFileAsync: async (name, content) => { files[name] = content; },
                deleteFileAsync: async name => { delete files[name]; },
                setListedAsync: async () => { },
                addChangeListener: () => { },
                removeChangeListener: () => { },
            };
            host = new ProjfsHost(() => withoutEditor, clock.now, clock.delay);
            chai.expect((await send({ subtype: "write", name: "a.ts", content: "x", dirty: true })).subtype).equals("ack");
            chai.expect(files["owner/repo/a.ts"]).equals("x");
        });
    });

    // The editor reloads a project by replacing its editor package, whose
    // files arrive from the workspace, as the workspace stored them when the
    // load began, only once the load reads them; until then the package holds
    // no files and no pxt.json. These tests drive the host through that load.
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
        function beginLoad(header: string): { finish: () => void, fail: () => void } {
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
                fail: () => loaded.reject(new Error("load failed")),
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
            stored = { first: projectFiles({ "items.ts": "holds a, b" }), second: projectFiles({ "items.ts": "holds c" }) };
            beginLoad("first").finish();
            host = new ProjfsHost(() => current, clock.now, clock.delay);
        });

        it("answers a list and a read that arrive while the project loads once it has loaded", async () => {
            const load = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const answered = Promise.all([post({ subtype: "list" }, replies), post({ subtype: "read", name: "items.ts" }, replies)]);
            await settle();
            load.finish();
            await answered;
            chai.expect((replies[0] as ProjfsFilesReply).files).deep.equals([{ name: "items.ts", size: pxt.Util.toUTF8Array("holds a, b").length }]);
            chai.expect((replies[1] as ProjfsContentReply).content).equals("holds a, b");
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

        it("applies a delete that arrives while the project loads once it has loaded", async () => {
            const load = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const answered = post({ subtype: "delete", name: "items.ts" }, replies);
            await settle();
            load.finish();
            await answered;
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack"]);
            chai.expect(stored.first[`${FOLDER}/items.ts`]).equals(undefined);
        });

        it("keeps an extension's requests in order across the load", async () => {
            const load = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const written = post({ subtype: "write", name: "items.ts", content: "holds a, b, d" }, replies);
            await settle();
            load.finish();
            await Promise.all([written, post({ subtype: "read", name: "items.ts" }, replies)]);
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack", "content"]);
            chai.expect((replies[1] as ProjfsContentReply).content).equals("holds a, b, d");
        });

        it("refuses with PROJECT_CLOSED a request whose project is replaced while it waits", async () => {
            const replaced = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const answered = post({ subtype: "write", name: "pushed.ts", content: "pushed" }, replies);
            await settle();
            const load = beginLoad("second");
            replaced.finish();
            await answered;
            chai.expect((replies[0] as ProjfsErrorReply).code).equals("PROJECT_CLOSED");
            chai.expect(stored.first[`${FOLDER}/pushed.ts`]).equals(undefined);
            load.finish();
            chai.expect(((await send({ subtype: "read", name: "items.ts" })) as ProjfsContentReply).content).equals("holds c");
        });

        it("refuses with PROJECT_CLOSED a request whose project fails to load", async () => {
            const load = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const answered = post({ subtype: "list" }, replies);
            await settle();
            load.fail();
            await answered;
            chai.expect((replies[0] as ProjfsErrorReply).code).equals("PROJECT_CLOSED");
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

    it("replaces the blocks editor's content when it shows the file", () => {
        editor.active = "blocks";
        editor.openFile = "owner/repo/code.blocks";
        applyUserEdit(editor, "owner/repo/code.blocks", "<xml/>");
        chai.expect(editor.calls).deep.equals(["override blocks <xml/>", "sim dirty", "typecheck"]);
    });

    it("leaves the editor's content alone when it shows another file", () => {
        applyUserEdit(editor, "owner/repo/other.ts", "let o = 1");
        chai.expect(editor.calls).deep.equals(["sim dirty", "typecheck"]);
    });

    it("leaves the editor's content alone when neither the text nor the blocks editor is active", () => {
        editor.active = "other";
        applyUserEdit(editor, "owner/repo/code.ts", "let b = 2");
        chai.expect(editor.calls).deep.equals(["sim dirty", "typecheck"]);
    });

    it("dirties and typechecks after a delete without replacing any content", () => {
        applyUserEdit(editor, "owner/repo/code.ts", undefined);
        chai.expect(editor.calls).deep.equals(["sim dirty", "typecheck"]);
    });

    it("passes each flagged change through the editor, scheduling one typecheck per change", async () => {
        const files: pxt.Map<string> = { [pxt.CONFIG_NAME]: JSON.stringify({ files: [] }) };
        const project: ProjfsProject = {
            loadedAsync: () => Promise.resolve(),
            getFiles: () => ({ ...files }),
            writeFileAsync: async (name, content) => { files[name] = content; },
            deleteFileAsync: async name => { delete files[name]; },
            setListedAsync: async () => { },
            markDirty: (name, content) => applyUserEdit(editor, name, content),
            addChangeListener: () => { },
            removeChangeListener: () => { },
        };
        const host = new ProjfsHost(() => project);
        const writes: Promise<void>[] = [];
        for (let i = 0; i < 5; i++)
            writes.push(host.handleMessageAsync("owner/repo", { type: "projfs", id: "" + i, subtype: "write", name: `b${i}.ts`, content: "x", dirty: true }, () => { }, testFrame()));
        await Promise.all(writes);
        chai.expect(editor.calls.filter(c => c === "sim dirty").length).equals(5);
        chai.expect(editor.calls.filter(c => c === "typecheck").length).equals(5);
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
            "owner/repo/other.ts": new FakeFile("let o = 1"),
        };
        saved: string[] = [];

        setFile(name: string, content: string) {
            this.files[name] = new FakeFile(content);
        }

        async saveFileAsync(name: string) {
            this.saved.push(name);
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

    it("leaves the write of a file the text editor does not show unforced", async () => {
        await writeProjectFileAsync(epkg, editorShowing("owner/repo/other.ts"), "owner/repo/code.ts", "let b = 2");
        chai.expect(epkg.files["owner/repo/code.ts"].writes).deep.equals([{ content: "let b = 2", force: false }]);
    });

    it("leaves the write unforced when the blocks editor shows the file", async () => {
        await writeProjectFileAsync(epkg, editorShowing("owner/repo/code.ts", "blocks"), "owner/repo/code.ts", "let b = 2");
        chai.expect(epkg.files["owner/repo/code.ts"].writes).deep.equals([{ content: "let b = 2", force: false }]);
    });

    it("leaves the write unforced when no editor shows the project", async () => {
        await writeProjectFileAsync(epkg, undefined, "owner/repo/code.ts", "let b = 2");
        chai.expect(epkg.files["owner/repo/code.ts"].writes).deep.equals([{ content: "let b = 2", force: false }]);
    });

    it("adds and saves a file the package does not store", async () => {
        await writeProjectFileAsync(epkg, editorShowing("owner/repo/code.ts"), "owner/repo/new.ts", "let n = 1");
        chai.expect(epkg.files["owner/repo/new.ts"].content).equals("let n = 1");
        chai.expect(epkg.saved).deep.equals(["owner/repo/new.ts"]);
    });
});

/**
 * Checks one of the client files' editor origin readers: it returns the origin
 * a frame URL's `parentOrigin` parameter carries, and undefined for a URL with
 * none or an empty one.
 */
function expectParentOriginReader(read: (search?: string) => string | undefined) {
    chai.expect(read("?parentOrigin=https%3A%2F%2Feditor.example&channel=owner%2Frepo")).equals("https://editor.example");
    chai.expect(read("?channel=owner%2Frepo")).equals(undefined);
    chai.expect(read("?parentOrigin=")).equals(undefined);
}

/**
 * Checks one of the client files' API level readers: it returns the level a
 * frame URL's `apiLevel` parameter carries, and 0 for a URL with none or with
 * one that is not a non-negative integer.
 */
function expectApiLevelReader(read: (search?: string) => number) {
    const level = pxsim.SIMX_API_LEVEL;
    chai.expect(read(`?parentOrigin=https%3A%2F%2Feditor.example&channel=owner%2Frepo&apiLevel=${level}`)).equals(level);
    chai.expect(read(`?apiLevel=${level + 1}`)).equals(level + 1);
    chai.expect(read("?apiLevel=0")).equals(0);
    chai.expect(read("?channel=owner%2Frepo")).equals(0);
    chai.expect(read("")).equals(0);
    for (const malformed of ["", "-1", "1.5", "1e2", "0x1", " 1", "one"]) {
        chai.expect(read("?apiLevel=" + encodeURIComponent(malformed)), malformed).equals(0);
    }
}

// the origin the fake editor's messages come from in the client suites
const EDITOR_ORIGIN = "https://editor.example";

describe("projfs client", () => {
    class FakeParent {
        requests: ProjfsRequest[] = [];
        origins: string[] = [];

        postMessage(msg: ProjfsRequest, targetOrigin: string) {
            this.requests.push(msg);
            this.origins.push(targetOrigin);
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

        deliver(source: unknown, data: unknown, origin = EDITOR_ORIGIN) {
            this.listeners.forEach(l => l({ source, data, origin } as MessageEvent));
        }
    }

    let parent: FakeParent;
    let self: FakeSelf;
    let client: ProjfsClient;
    let clock: FakeClock;

    function lastRequest() {
        return parent.requests[parent.requests.length - 1];
    }

    function replyTo(request: ProjfsRequest, body: object, source: unknown = parent, origin = EDITOR_ORIGIN) {
        self.deliver(source, { type: "projfs", id: request.id, ...body }, origin);
    }

    beforeEach(() => {
        parent = new FakeParent();
        self = new FakeSelf();
        clock = new FakeClock();
        client = new ProjfsClient({ target: parent, listener: self, search: "" });
    });

    afterEach(() => client.dispose());

    it("posts requests to the editor with unique ids", async () => {
        const listed = client.list();
        const read = client.read("main.ts");
        chai.expect(parent.requests.map(r => r.subtype)).deep.equals(["list", "read"]);
        chai.expect(parent.requests.every(r => r.type === "projfs")).equals(true);
        chai.expect(parent.requests[0].id).not.equals(parent.requests[1].id);
        chai.expect(parent.origins).deep.equals(["*", "*"]);
        replyTo(parent.requests[0], { subtype: "files", files: [] });
        replyTo(parent.requests[1], { subtype: "content", name: "main.ts", content: "" });
        await Promise.all([listed, read]);
    });

    it("resolves each method with its reply", async () => {
        const listed = client.list();
        replyTo(lastRequest(), { subtype: "files", files: [{ name: "main.ts", size: 3 }] });
        chai.expect(await listed).deep.equals([{ name: "main.ts", size: 3 }]);

        const read = client.read("main.ts");
        chai.expect(lastRequest()).deep.include({ subtype: "read", name: "main.ts" });
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "abc" });
        chai.expect(await read).equals("abc");

        const written = client.write("a.txt", "hi");
        chai.expect(lastRequest()).deep.include({ subtype: "write", name: "a.txt", content: "hi" });
        replyTo(lastRequest(), { subtype: "ack", name: "a.txt" });
        chai.expect(await written).equals("a.txt");

        const deleted = client.delete("a.txt");
        chai.expect(lastRequest()).deep.include({ subtype: "delete", name: "a.txt" });
        replyTo(lastRequest(), { subtype: "ack", name: "a.txt" });
        chai.expect(await deleted).equals("a.txt");
    });

    it("rejects with the editor's error code", async () => {
        const written = client.write("big.txt", "x");
        replyTo(lastRequest(), { subtype: "error", code: "QUOTA_EXCEEDED", message: "too big" });
        const error = await written.then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjfsError);
        chai.expect(error.code).equals("QUOTA_EXCEEDED");
        chai.expect(error.message).equals("too big");
    });

    it("ignores replies from other windows and to unknown requests", async () => {
        const read = client.read("main.ts");
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "forged" }, {});
        self.deliver(parent, { type: "projfs", id: "unknown", subtype: "content", content: "stray" });
        self.deliver(parent, { type: "other", id: lastRequest().id });
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "real" });
        chai.expect(await read).equals("real");
    });

    function changed(...names: string[]): ProjfsNotification {
        return { type: "projfs", subtype: "changed", names };
    }

    it("subscribes once the editor acknowledges, then calls the listener with each notification's names", async () => {
        const seen: string[][] = [];
        const subscribed = client.subscribe(names => seen.push(names));
        chai.expect(lastRequest()).deep.include({ type: "projfs", subtype: "subscribe" });
        self.deliver(parent, changed("early.txt"));
        chai.expect(seen).deep.equals([]);
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        self.deliver(parent, changed("a.txt", "b/c.txt"));
        self.deliver(parent, changed("a.txt"));
        chai.expect(seen).deep.equals([["a.txt", "b/c.txt"], ["a.txt"]]);
    });

    it("ignores change notifications from other windows", async () => {
        const seen: string[][] = [];
        const subscribed = client.subscribe(names => seen.push(names));
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        self.deliver({}, changed("forged.txt"));
        self.deliver(parent, { type: "other", subtype: "changed", names: ["other.txt"] });
        chai.expect(seen).deep.equals([]);
    });

    it("rejects a refused subscription, never calls its listener, and sends a new request on the next call", async () => {
        const seen: string[][] = [];
        const refused = client.subscribe(names => seen.push(names));
        replyTo(lastRequest(), { subtype: "error", code: "PROJECT_CLOSED", message: "closed" });
        chai.expect((await refused.then(() => undefined, e => e)).code).equals("PROJECT_CLOSED");
        self.deliver(parent, changed("a.txt"));
        chai.expect(seen).deep.equals([]);
        const subscribed = client.subscribe(names => seen.push(names));
        chai.expect(parent.requests.map(r => r.subtype)).deep.equals(["subscribe", "subscribe"]);
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        self.deliver(parent, changed("b.txt"));
        chai.expect(seen).deep.equals([["b.txt"]]);
    });

    it("subscribes once however often subscribe is called, and calls each listener once per notification", async () => {
        const calls: string[] = [];
        const first = () => calls.push("first");
        const second = () => calls.push("second");
        const subscribed = [client.subscribe(first), client.subscribe(second)];
        chai.expect(parent.requests.length).equals(1);
        replyTo(lastRequest(), { subtype: "ack" });
        await Promise.all(subscribed);
        await client.subscribe(first);
        chai.expect(parent.requests.length).equals(1);
        self.deliver(parent, changed("a.txt"));
        chai.expect(calls).deep.equals(["first", "second"]);
    });

    it("fails a subscribe after dispose with DISPOSED, without posting it, even once a subscription was acknowledged", async () => {
        const subscribed = client.subscribe(() => { });
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        client.dispose();
        const seen: string[][] = [];
        const error = await client.subscribe(names => seen.push(names)).then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjfsError);
        chai.expect(error.code).equals("DISPOSED");
        chai.expect(parent.requests.map(r => r.subtype)).deep.equals(["subscribe"]);
        self.deliver(parent, changed("a.txt"));
        chai.expect(seen).deep.equals([]);
    });

    it("stops calling listeners once disposed", async () => {
        const seen: string[][] = [];
        const subscribed = client.subscribe(names => seen.push(names));
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        client.dispose();
        chai.expect(self.listeners).deep.equals([]);
        self.deliver(parent, changed("a.txt"));
        chai.expect(seen).deep.equals([]);
    });

    it("reads the frame's key from the frame URL, unless given one", () => {
        chai.expect(getSimxChannel(undefined, "?parentOrigin=http%3A%2F%2Flocalhost%3A3232&channel=owner%2Frepo&language=en")).equals("owner/repo");
        chai.expect(getSimxChannel("owner/known", "?channel=owner%2Frepo")).equals("owner/known");
        chai.expect(getSimxChannel(undefined, "?parentOrigin=x")).equals(undefined);
        chai.expect(getSimxChannel(undefined, "")).equals(undefined);
    });

    it("reads the hosting target's id from the frame URL", () => {
        chai.expect(getTargetId("?parentOrigin=http%3A%2F%2Flocalhost%3A3232&channel=owner%2Frepo&target=arcade")).equals("arcade");
        chai.expect(getTargetId("?channel=owner%2Frepo")).equals(undefined);
        chai.expect(getTargetId("?target=")).equals(undefined);
    });

    it("reads the editor's origin from the frame URL", () => {
        expectParentOriginReader(getParentOrigin);
    });

    it("reads the open project's id from the frame URL", () => {
        chai.expect(getProjectId("?parentOrigin=http%3A%2F%2Flocalhost%3A3232&channel=owner%2Frepo&target=arcade&project=3b1f7c2e-project")).equals("3b1f7c2e-project");
        chai.expect(getProjectId("?channel=owner%2Frepo&target=arcade")).equals(undefined);
        chai.expect(getProjectId("?project=")).equals(undefined);
    });

    it("reads the editor's API level from the frame URL, or 0 when it is absent or malformed", () => {
        expectApiLevelReader(getProjfsApiLevel);
    });

    it("keeps waiting for a reply however late it comes, and resolves with it", async () => {
        client.dispose();
        client = new ProjfsClient({ target: parent, listener: self, search: "", slowReplyMs: 5 });
        let settled = false;
        const written = client.write("a.txt", "x").then(name => { settled = true; return name; });
        await new Promise(resolve => setTimeout(resolve, 30));
        chai.expect(settled).equals(false);
        replyTo(lastRequest(), { subtype: "ack", name: "a.txt" });
        chai.expect(await written).equals("a.txt");
    });

    it("reports a request still waiting after slowReplyMs once, and keeps waiting", async () => {
        client.dispose();
        const slow: ProjfsRequest[] = [];
        client = new ProjfsClient({ target: parent, listener: self, search: "", slowReplyMs: 5, onSlowReply: r => slow.push(r) });
        const answered = client.read("fast.txt");
        replyTo(lastRequest(), { subtype: "content", name: "fast.txt", content: "" });
        await answered;
        const written = client.write("slow.txt", "x");
        await new Promise(resolve => setTimeout(resolve, 30));
        chai.expect(slow).deep.equals([lastRequest()]);
        replyTo(lastRequest(), { subtype: "ack", name: "slow.txt" });
        chai.expect(await written).equals("slow.txt");
    });

    it("flags dirty writes and deletes, and sends no flag otherwise", async () => {
        client.write("a.txt", "x", { dirty: true });
        chai.expect(lastRequest()).deep.include({ subtype: "write", dirty: true });
        client.delete("a.txt", { dirty: true });
        chai.expect(lastRequest()).deep.include({ subtype: "delete", dirty: true });
        client.write("a.txt", "x");
        client.write("a.txt", "x", { dirty: false });
        client.delete("a.txt");
        client.delete("a.txt", {});
        for (const request of parent.requests.slice(2))
            chai.expect(Object.keys(request).sort(), request.subtype).deep.equals(
                request.subtype === "write" ? ["content", "id", "name", "subtype", "type"] : ["id", "name", "subtype", "type"]);
        for (const request of parent.requests)
            replyTo(request, { subtype: "ack", name: "a.txt" });
    });

    it("fails pending requests with DISPOSED when disposed, since their outcome is unknown", async () => {
        const listed = client.list();
        const written = client.write("a.txt", "x");
        client.dispose();
        for (const pending of [listed, written]) {
            const error = await (pending as Promise<unknown>).then(() => undefined, e => e);
            chai.expect(error.code).equals("DISPOSED");
        }
        chai.expect(self.listeners).deep.equals([]);
    });

    it("fails a request made after dispose with DISPOSED at once, without posting it", async () => {
        client.dispose();
        const error = await client.list().then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjfsError);
        chai.expect(error.code).equals("DISPOSED");
        chai.expect(parent.requests).deep.equals([]);
    });

    it("fails a request it cannot post with FAILED, and never reports it as slow", async () => {
        client.dispose();
        const slow: ProjfsRequest[] = [];
        parent.postMessage = () => { throw new Error("could not be cloned"); };
        client = new ProjfsClient({ target: parent, listener: self, search: "", slowReplyMs: 5, onSlowReply: r => slow.push(r) });
        const error = await client.write("a.txt", "x").then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjfsError);
        chai.expect(error.code).equals("FAILED");
        await new Promise(resolve => setTimeout(resolve, 30));
        chai.expect(slow).deep.equals([]);
    });

    it("reports a slow reply at once when slowReplyMs is 0", async () => {
        client.dispose();
        const slow: ProjfsRequest[] = [];
        client = new ProjfsClient({ target: parent, listener: self, search: "", slowReplyMs: 0, onSlowReply: r => slow.push(r) });
        const written = client.write("a.txt", "x");
        await new Promise(resolve => setTimeout(resolve, 20));
        chai.expect(slow).deep.equals([lastRequest()]);
        replyTo(lastRequest(), { subtype: "ack", name: "a.txt" });
        await written;
    });

    it("posts requests to the editor's origin from the frame URL by default, or to the origin it is given", async () => {
        client.dispose();
        client = new ProjfsClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example&channel=owner%2Frepo" });
        const listed = client.list();
        replyTo(lastRequest(), { subtype: "files", files: [] });
        await listed;
        client.dispose();
        client = new ProjfsClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example", targetOrigin: "https://other.example" });
        const again = client.list();
        replyTo(lastRequest(), { subtype: "files", files: [] }, parent, "https://other.example");
        await again;
        chai.expect(parent.origins).deep.equals(["https://editor.example", "https://other.example"]);
    });

    it("ignores replies from another origin while it posts to the editor's origin", async () => {
        client.dispose();
        client = new ProjfsClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example" });
        const read = client.read("main.ts");
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "forged" }, parent, "https://elsewhere.example");
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "real" });
        chai.expect(await read).equals("real");
    });

    it("accepts replies from any origin while it posts to any origin", async () => {
        const read = client.read("main.ts");
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "real" }, parent, "https://elsewhere.example");
        chai.expect(await read).equals("real");
    });

    /** Connects the client to a host serving `owner/repo`; returns the project's stored files. */
    function connectToHost(): pxt.Map<string> {
        const files: pxt.Map<string> = {
            [pxt.CONFIG_NAME]: JSON.stringify({ files: [pxt.MAIN_TS] }),
            [pxt.MAIN_TS]: "",
        };
        let listeners: ((name: string | undefined) => void)[] = [];
        const notify = (name: string) => listeners.forEach(listener => listener(name));
        const project: ProjfsProject = {
            loadedAsync: () => Promise.resolve(),
            getFiles: () => ({ ...files }),
            writeFileAsync: async (name, content) => {
                files[name] = content;
                notify(name);
            },
            deleteFileAsync: async name => {
                delete files[name];
                notify(name);
                await project.setListedAsync(name, false);
            },
            setListedAsync: async (name, listed) => {
                const config = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                config.files = listed ? [...config.files, name] : config.files.filter(f => f !== name);
                files[pxt.CONFIG_NAME] = JSON.stringify(config);
                notify(pxt.CONFIG_NAME);
            },
            addChangeListener: listener => { listeners.push(listener); },
            removeChangeListener: listener => { listeners = listeners.filter(l => l !== listener); },
        };
        const host = new ProjfsHost(() => project, clock.now, clock.delay);
        const frame = testFrame();
        // the editor posts each reply and notification back to the frame's window
        parent.postMessage = (msg: ProjfsRequest) => {
            host.handleMessageAsync("owner/repo", msg, reply => self.deliver(parent, reply), frame);
        };
        return files;
    }

    it("round-trips text and data: URIs through the host", async () => {
        connectToHost();
        const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        const text = "caf\u00e9 \ud83d\ude00\nline 2";
        chai.expect(await client.write("images/pixel.png", png)).equals("images/pixel.png");
        chai.expect(await client.write("notes.txt", text)).equals("notes.txt");
        chai.expect(await client.read("images/pixel.png")).equals(png);
        chai.expect(await client.read("notes.txt")).equals(text);
        chai.expect(await client.list()).deep.equals([
            { name: "images/pixel.png", size: png.length },
            { name: "notes.txt", size: pxt.Util.toUTF8Array(text).length },
        ]);
        for (const name of [pxt.CONFIG_NAME, pxt.MAIN_TS]) {
            const error = await client.read(name).then(() => undefined, e => e);
            chai.expect(error.code, name).equals("NOT_FOUND");
        }
    });

    it("resolves every write of a burst larger than the host's rate limit once the host applies it", async () => {
        const files = connectToHost();
        let acked = 0;
        const writes: Promise<string>[] = [];
        for (let i = 0; i <= PROJFS_RATE_LIMIT; i++)
            writes.push(client.write(`f${i}.txt`, `${i}`).then(name => { acked++; return name; }));
        await settle();
        chai.expect(acked).equals(PROJFS_RATE_LIMIT);
        chai.expect(files).not.to.have.property(`owner/repo/f${PROJFS_RATE_LIMIT}.txt`);
        await clock.advance(PROJFS_RATE_WINDOW_MS);
        chai.expect(await Promise.all(writes)).deep.equals(writes.map((_, i) => `f${i}.txt`));
        chai.expect(files[`owner/repo/f${PROJFS_RATE_LIMIT}.txt`]).equals(`${PROJFS_RATE_LIMIT}`);
    });

    it("returns names from write and delete that read and delete accept", async () => {
        const files = connectToHost();
        const written = await client.write("data/level1.json", "{}");
        chai.expect(await client.read(written)).equals("{}");
        chai.expect(files["owner/repo/data/level1.json"]).equals("{}");
        const deleted = await client.delete(written);
        chai.expect(deleted).equals(written);
        chai.expect(files).not.to.have.property("owner/repo/data/level1.json");
        const again = await client.write("notes.txt", "hi");
        await client.delete(again);
        chai.expect(await client.list()).deep.equals([]);
    });

    it("hears its own writes and deletes through the host, by the names it gave them", async () => {
        connectToHost();
        const seen: string[][] = [];
        await client.subscribe(names => seen.push(names));
        await client.write("notes.txt", "hi");
        await client.write("data/level1.json", "{}");
        chai.expect(seen).deep.equals([]);
        await clock.advance(PROJFS_NOTIFY_DEBOUNCE_MS);
        chai.expect(seen).deep.equals([["notes.txt", "data/level1.json"]]);
        await client.delete("notes.txt");
        await clock.advance(PROJFS_NOTIFY_DEBOUNCE_MS);
        chai.expect(seen).deep.equals([["notes.txt", "data/level1.json"], ["notes.txt"]]);
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

    it("hears an asset update", () => {
        const image = project.createNewProjectImage(testBitmap(4, 4), "hero");
        changes = 0;
        project.updateAsset(withBitmap(image, testBitmap(8, 8)));
        chai.expect(changes).greaterThan(0);
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

    it("hears undo and redo", () => {
        project.createNewProjectImage(testBitmap(4, 4), "hero");
        project.pushUndo();
        changes = 0;
        project.undo();
        chai.expect(changes, "undo").greaterThan(0);
        chai.expect(project.getAssets(pxt.AssetType.Image)).deep.equals([]);
        changes = 0;
        project.redo();
        chai.expect(changes, "redo").greaterThan(0);
        chai.expect(project.getAssets(pxt.AssetType.Image).map(i => i.meta.displayName)).deep.equals(["hero"]);
    });

    it("calls every listener, and no longer calls a removed one", () => {
        let other = 0;
        const otherListener = () => other++;
        project.addProjectChangeListener(otherListener);
        project.createNewProjectImage(testBitmap(2, 2), "a");
        chai.expect(changes).greaterThan(0);
        chai.expect(other).greaterThan(0);
        project.removeProjectChangeListener(listener);
        changes = 0;
        other = 0;
        project.createNewProjectImage(testBitmap(2, 2), "b");
        chai.expect(changes).equals(0);
        chai.expect(other).greaterThan(0);
    });

    it("keeps the listeners of separate projects apart", () => {
        const second = new pxt.TilemapProject();
        second.createNewProjectImage(testBitmap(2, 2), "elsewhere");
        chai.expect(changes).equals(0);
    });

    it("hears assets loaded from an asset file, and not gallery assets", () => {
        const seed = new pxt.TilemapProject();
        seed.createNewProjectImage(testBitmap(2, 2), "loaded");
        project.loadAssetsJRes(seed.getProjectAssetsJRes(), true);
        chai.expect(changes).equals(0);
        project.loadAssetsJRes(seed.getProjectAssetsJRes());
        chai.expect(changes).greaterThan(0);
        chai.expect(project.getAssets(pxt.AssetType.Image).map(i => i.meta.displayName)).deep.equals(["loaded"]);
    });

    it("hears tilemaps loaded from a tileset file", () => {
        const seed = new pxt.TilemapProject();
        seed.createNewTilemap("first", 16, 4, 4);
        project.loadTilemapJRes(seed.getProjectTilesetJRes(), true);
        const next = new pxt.TilemapProject();
        next.createNewTilemap("second", 16, 4, 4);
        const tiles = project.getAssets(pxt.AssetType.Tile).length;
        changes = 0;
        project.loadTilemapJRes(next.getProjectTilesetJRes(), true);
        chai.expect(changes).greaterThan(0);
        chai.expect(project.getAssets(pxt.AssetType.Tilemap).length).equals(2);
        chai.expect(project.getAssets(pxt.AssetType.Tile).length).equals(tiles);
    });

    it("hears assets removed because no active block uses them", () => {
        const image = project.createNewImage(2, 2);
        project.updateAsset({ ...image, meta: { blockIDs: ["block1"] } });
        changes = 0;
        project.removeInactiveBlockAssets(["block1"]);
        chai.expect(changes).equals(0);
        project.removeInactiveBlockAssets([]);
        chai.expect(changes).greaterThan(0);
        chai.expect(project.getAssets(pxt.AssetType.Image)).deep.equals([]);
    });

    it("hears unnamed images no block uses removed when an undo point is pushed", () => {
        project.createNewImage(2, 2);
        changes = 0;
        project.pushUndo();
        chai.expect(changes).greaterThan(0);
        chai.expect(project.getAssets(pxt.AssetType.Image)).deep.equals([]);
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
/** The user's simulator theme as the asset host watches it, changed as a preference change would change it. */
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

    /** Sets the theme, which may be the same, and tells every listener the preference may have changed. */
    change(theme: pxt.SimulatorTheme) {
        this.theme = theme;
        this.listeners.forEach(listener => listener());
    }
}

/** A frame a project-asset request comes from, in the document until a test removes it. */
function testFrame(): ProjassetsFrame & { isConnected: boolean } {
    return { isConnected: true };
}

const THEME_PRESETS: pxt.SimulatorThemePreset[] = [
    { id: "default", name: "Default", theme: simulatorTheme },
    { id: "purple", name: "Purple", theme: { ...simulatorTheme, "background-color": "#660066" } },
];

describe("main package config load listeners", () => {
    it("calls each listener each time the main package loads its pxt.json, and no longer calls a removed one", () => {
        const files = { [pxt.CONFIG_NAME]: testPxtJson() };
        const mainPkg = testMainPackage(files);
        let first = 0;
        let second = 0;
        const firstListener = () => first++;
        mainPkg.addConfigLoadListener(firstListener);
        mainPkg.addConfigLoadListener(() => second++);
        files[pxt.CONFIG_NAME] = testPxtJson({ palette: PROJECT_PALETTE });
        mainPkg.loadConfig(true);
        chai.expect([first, second]).deep.equals([1, 1]);
        chai.expect(mainPkg.config.palette).deep.equals(PROJECT_PALETTE);
        mainPkg.removeConfigLoadListener(firstListener);
        mainPkg.loadConfig(true);
        chai.expect([first, second]).deep.equals([1, 2]);
    });

    it("reports a listener that throws, and calls the other listeners", () => {
        const files = { [pxt.CONFIG_NAME]: testPxtJson() };
        const mainPkg = testMainPackage(files);
        let called = 0;
        mainPkg.addConfigLoadListener(() => { throw new Error("listener failed"); });
        mainPkg.addConfigLoadListener(() => called++);
        const reported: unknown[] = [];
        const report = pxt.reportException;
        pxt.reportException = e => { reported.push(e); };
        try {
            files[pxt.CONFIG_NAME] = testPxtJson({ name: "renamed" });
            mainPkg.loadConfig(true);
        } finally {
            pxt.reportException = report;
        }
        chai.expect(reported.length).equals(1);
        chai.expect(called).equals(1);
        chai.expect(mainPkg.config.name).equals("renamed");
    });
});

describe("projassets visual configuration", () => {
    withTargetVisuals(TARGET_PALETTE, THEME_PRESETS);

    function visualConfigOf(extra: object, presets = THEME_PRESETS, accountTheme: pxt.SimulatorTheme = ACCOUNT_THEME) {
        return getVisualConfig(testMainPackage({ [pxt.CONFIG_NAME]: testPxtJson(extra) }), presets, accountTheme);
    }

    it("gives the target's palette when the project sets none", () => {
        chai.expect(visualConfigOf({}).palette).deep.equals(TARGET_PALETTE);
    });

    it("gives the project's palette when its pxt.json sets one", () => {
        chai.expect(visualConfigOf({ palette: PROJECT_PALETTE }).palette).deep.equals(PROJECT_PALETTE);
    });

    it("draws the palette from the package's effective palette, the one the palette editor opens on", () => {
        const mainPkg = testMainPackage({ [pxt.CONFIG_NAME]: testPxtJson({ palette: PROJECT_PALETTE }) });
        chai.expect(mainPkg.effectivePalette()).deep.equals(PROJECT_PALETTE);
        chai.expect(testMainPackage({ [pxt.CONFIG_NAME]: testPxtJson() }).effectivePalette()).deep.equals(TARGET_PALETTE);
    });

    it("gives the target's palette for a main package whose pxt.json has not loaded", () => {
        const unloaded = new pxt.MainPackage({ readFile: (): string => undefined } as any);
        chai.expect(unloaded.effectivePalette()).deep.equals(TARGET_PALETTE);
    });

    it("gives the account's simulator theme when the project declares none", () => {
        chai.expect(visualConfigOf({}).theme).deep.equals(ACCOUNT_THEME);
    });

    it("resolves a project theme naming a preset to the preset's tokens", () => {
        chai.expect(visualConfigOf({ theme: "Purple" }).theme).deep.equals(THEME_PRESETS[1].theme);
    });

    it("resolves a project theme naming no preset to the account's tokens in that layout", () => {
        chai.expect(visualConfigOf({ theme: "retro" }).theme).deep.equals({ ...ACCOUNT_THEME, layout: "retro" });
    });

    it("resolves a project theme of tokens to the account's tokens overridden by the project's", () => {
        chai.expect(visualConfigOf({ theme: { "background-color": "#00ff00" } }).theme)
            .deep.equals({ ...ACCOUNT_THEME, "background-color": "#00ff00" });
    });

    it("gives no theme when the target offers no simulator themes", () => {
        const mainPkg = testMainPackage({ [pxt.CONFIG_NAME]: testPxtJson({ theme: "Purple" }) });
        chai.expect(getVisualConfig(mainPkg, [], ACCOUNT_THEME)).not.to.have.property("theme");
        chai.expect(getVisualConfig(mainPkg, undefined, undefined)).not.to.have.property("theme");
    });
});

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

    it("lists an image with no display name, without a displayName field", () => {
        project.createNewImage(2, 2);
        const listed = getImageAssets(project);
        chai.expect(listed.length).equals(1);
        chai.expect(listed[0]).deep.include({ kind: "image", id: "image1", width: 2, height: 2 });
        chai.expect(listed[0]).not.to.have.property("displayName");
    });

    it("reports the ids and pixels under which the project's asset file stores each image", () => {
        project.createNewProjectImage(testBitmap(3, 3), "named");
        project.createNewImage(4, 4);
        const jres = project.getProjectAssetsJRes();
        const listed = getImageAssets(project);
        chai.expect(listed.length).equals(2);
        for (const image of listed) {
            const entry = jres[image.id];
            chai.expect(entry, image.id).not.equals(undefined);
            chai.expect(typeof entry === "string" ? entry : entry.data, image.id).equals(image.data);
        }
    });

    it("lists images only, not assets of other kinds", () => {
        project.createNewProjectImage(testBitmap(2, 2), "picture");
        project.createNewTile(testBitmap(16, 16), undefined, "grass");
        project.getTransparency(16);
        project.createNewAnimationFromData([testBitmap(2, 2)], 100, "walk");
        project.createNewSong(pxt.assets.music.getEmptySong(2), "tune");
        project.createNewJsonAsset({ level: 1 }, "level.json", "levelData");
        chai.expect(getImageAssets(project).map(i => i.displayName)).deep.equals(["picture"]);
        chai.expect(getImageAssets(project).every(i => i.kind === "image")).equals(true);
    });

    it("lists the project's own images, not those its extensions supply", () => {
        const data = pxt.sprite.base64EncodeBitmap(testBitmap(2, 2));
        project.loadAssetsJRes({
            "*": { mimeType: pxt.IMAGE_MIME_TYPE, dataEncoding: "base64", namespace: pxt.sprite.IMAGES_NAMESPACE },
            fromExtension: { data, displayName: "fromExtension" },
        } as any, true);
        project.createNewProjectImage(testBitmap(2, 2), "own");
        chai.expect(getImageAssets(project).map(i => i.displayName)).deep.equals(["own"]);
    });

    it("answers from the live project, before its asset file is rebuilt", () => {
        const image = project.createNewProjectImage(testBitmap(2, 2), "hero");
        project.needsRebuild = false;
        const edited = testBitmap(6, 4);
        project.updateAsset(withBitmap(image, edited));
        chai.expect(project.needsRebuild).equals(true);
        chai.expect(getImageAssets(project)).deep.equals([{
            kind: "image",
            id: "image1",
            displayName: "hero",
            width: 6,
            height: 4,
            data: pxt.sprite.base64EncodeBitmap(edited),
        }]);
    });

    it("leaves out an image once it is removed", () => {
        const image = project.createNewProjectImage(testBitmap(2, 2), "hero");
        project.createNewProjectImage(testBitmap(2, 2), "villain");
        project.removeAsset(image);
        chai.expect(getImageAssets(project).map(i => i.displayName)).deep.equals(["villain"]);
    });
});

describe("projassets song listing", () => {
    let project: pxt.TilemapProject;

    beforeEach(() => {
        project = new pxt.TilemapProject();
    });

    it("describes each song by its asset file id, kind, display name and encoded song, without a displayName field when it has none", () => {
        const song = pxt.assets.music.getEmptySong(2);
        project.createNewSong(song, "tune");
        project.createNewSong(song);
        const listed = getSongAssets(project);
        const data = pxt.assets.music.encodeSongToHex(song);
        chai.expect(listed).to.have.deep.members([
            { kind: "song", id: "song1", displayName: "tune", data },
            { kind: "song", id: "song2", data },
        ]);
        chai.expect(listed.find(s => s.id === "song2")).not.to.have.property("displayName");
    });

    it("reports the ids and encoded songs under which the project's asset file stores each song", () => {
        project.createNewSong(pxt.assets.music.getEmptySong(2), "tune");
        project.createNewSong(pxt.assets.music.getEmptySong(2));
        const jres = project.getProjectAssetsJRes();
        const listed = getSongAssets(project);
        chai.expect(listed.length).equals(2);
        for (const song of listed) {
            const entry = jres[song.id];
            chai.expect(entry, song.id).not.equals(undefined);
            chai.expect(typeof entry === "string" ? undefined : entry.mimeType, song.id).equals(pxt.SONG_MIME_TYPE);
            chai.expect(typeof entry === "string" ? undefined : entry.data, song.id).equals(song.data);
        }
    });

    it("lists songs only, not assets of other kinds", () => {
        project.createNewProjectImage(testBitmap(2, 2), "picture");
        project.createNewTile(testBitmap(16, 16), undefined, "grass");
        project.getTransparency(16);
        project.createNewAnimationFromData([testBitmap(2, 2)], 100, "walk");
        project.createNewSong(pxt.assets.music.getEmptySong(2), "tune");
        project.createNewJsonAsset({ level: 1 }, "level.json", "levelData");
        chai.expect(getSongAssets(project).map(s => s.displayName)).deep.equals(["tune"]);
        chai.expect(getSongAssets(project).every(s => s.kind === "song")).equals(true);
    });

    it("lists the project's own songs, not those its extensions supply", () => {
        project.loadAssetsJRes({
            "*": { mimeType: pxt.SONG_MIME_TYPE, dataEncoding: "base64", namespace: pxt.sprite.SONG_NAMESPACE },
            fromExtension: { data: pxt.assets.music.encodeSongToHex(pxt.assets.music.getEmptySong(2)), displayName: "fromExtension" },
        } as any, true);
        project.createNewSong(pxt.assets.music.getEmptySong(2), "own");
        chai.expect(getSongAssets(project).map(s => s.displayName)).deep.equals(["own"]);
    });

    it("keeps a song's id when the song is renamed", () => {
        const song = project.createNewSong(pxt.assets.music.getEmptySong(2), "tune");
        project.updateAsset({ ...song, meta: { ...song.meta, displayName: "melody" } });
        chai.expect(getSongAssets(project).map(s => ({ id: s.id, displayName: s.displayName }))).deep.equals([{ id: "song1", displayName: "melody" }]);
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

    async function send(msg: any, key = SCOPE): Promise<ProjassetsReply> {
        const received: (ProjassetsReply | ProjassetsNotification)[] = [];
        await post(msg, received, key);
        chai.expect(received.length).equals(1);
        return received[0] as ProjassetsReply;
    }

    async function expectError(msg: any, code: ProjassetsErrorCode, key = SCOPE): Promise<ProjassetsErrorReply> {
        const reply = await send(msg, key);
        chai.expect(reply.subtype).equals("error");
        chai.expect((reply as ProjassetsErrorReply).code).equals(code);
        return reply as ProjassetsErrorReply;
    }

    /** Subscribes `frame` of `key` and returns what it receives from then on, the subscription's ack first. */
    async function subscribe(key = SCOPE, frame: ProjassetsFrame = testFrame()): Promise<(ProjassetsReply | ProjassetsNotification)[]> {
        const received: (ProjassetsReply | ProjassetsNotification)[] = [];
        await post({ subtype: "subscribe" }, received, key, frame);
        chai.expect(received.map(r => r.subtype)).deep.equals(["ack"]);
        received.length = 0;
        return received;
    }

    const CHANGED = { type: "projassets", subtype: "changed" };

    it("replies with the request's id", async () => {
        const received: (ProjassetsReply | ProjassetsNotification)[] = [];
        await host.handleMessageAsync(SCOPE, { type: "projassets", id: "abc", subtype: "list", kind: "image" }, r => received.push(r), testFrame());
        chai.expect(received.length).equals(1);
        chai.expect(received[0]).deep.include({ type: "projassets", id: "abc" });
    });

    it("lists the open project's images", async () => {
        project.createNewImage(3, 3);
        const reply = await send({ subtype: "list", kind: "image" }) as ProjassetsAssetsReply;
        chai.expect(reply.subtype).equals("assets");
        chai.expect(reply.kind).equals("image");
        chai.expect(reply.assets).deep.equals(getImageAssets(project));
        chai.expect(reply.assets.length).equals(2);
    });

    it("lists the open project's songs", async () => {
        project.createNewSong(pxt.assets.music.getEmptySong(2), "tune");
        project.createNewSong(pxt.assets.music.getEmptySong(2));
        const reply = await send({ subtype: "list", kind: "song" }) as ProjassetsAssetsReply<"song">;
        chai.expect(reply.subtype).equals("assets");
        chai.expect(reply.kind).equals("song");
        chai.expect(reply.assets).deep.equals(getSongAssets(project));
        chai.expect(reply.assets.length).equals(2);
        const jres = project.getProjectAssetsJRes();
        for (const song of reply.assets) {
            chai.expect(song.data, song.id).to.be.a("string").and.not.equal("");
            chai.expect(song.data, song.id).equals(jres[song.id].data);
        }
    });

    it("lists the open project's tiles by qualified id, the blank tile included", async () => {
        const grass = testBitmap(16, 16);
        project.createNewTile(grass, undefined, "grass");
        project.getTransparency(16);
        const reply = await send({ subtype: "list", kind: "tile" }) as ProjassetsAssetsReply<"tile">;
        chai.expect(reply.subtype).equals("assets");
        chai.expect(reply.kind).equals("tile");
        chai.expect(reply.assets).deep.equals(getTileAssets(project));
        chai.expect(reply.assets.map(t => [t.kind, t.id, t.width, t.height])).to.have.deep.members([
            ["tile", "myTiles.tile1", 16, 16],
            ["tile", "myTiles.transparency16", 16, 16],
        ]);
        chai.expect(reply.assets.find(t => t.id === "myTiles.tile1")).deep.include({ displayName: "grass", data: pxt.sprite.base64EncodeBitmap(grass) });
        chai.expect(reply.assets.find(t => t.id === "myTiles.transparency16")).not.to.have.property("displayName");
        const jres = project.getProjectTilesetJRes();
        for (const tile of reply.assets)
            chai.expect(tile.data, tile.id).equals(jres[tile.id.substr(tile.id.lastIndexOf(".") + 1)].data);
    });

    it("lists the open project's tilemaps, empty ones included, with the data and tileset ids its tileset file stores", async () => {
        project.createNewTilemap("level", 16, 4, 3);
        project.createNewTilemap("castle", 8, 5, 2);
        const reply = await send({ subtype: "list", kind: "tilemap" }) as ProjassetsAssetsReply<"tilemap">;
        chai.expect(reply.subtype).equals("assets");
        chai.expect(reply.kind).equals("tilemap");
        chai.expect(reply.assets).deep.equals(getTilemapAssets(project));
        chai.expect(reply.assets.map(m => [m.kind, m.id, m.tileWidth, m.width, m.height, m.tileset.length])).to.have.deep.members([
            ["tilemap", "level1", 16, 4, 3, 1],
            ["tilemap", "castle1", 8, 5, 2, 1],
        ]);
        const jres = project.getProjectTilesetJRes();
        for (const tilemap of reply.assets) {
            chai.expect(tilemap.displayName, tilemap.id).to.be.a("string").and.not.equal("");
            chai.expect(tilemap.data, tilemap.id).equals(jres[tilemap.id].data);
            chai.expect(tilemap.tileset.map(t => t.id), tilemap.id).deep.equals(jres[tilemap.id].tileset);
        }
    });

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

    it("lists the open project's animations by asset file id, with their frames", async () => {
        const walk = [testBitmap(4, 3), testBitmap(4, 3)];
        project.createNewAnimationFromData(walk, 150, "walk");
        project.createNewAnimation(2, 2);
        const reply = await send({ subtype: "list", kind: "animation" }) as ProjassetsAssetsReply<"animation">;
        chai.expect(reply.subtype).equals("assets");
        chai.expect(reply.kind).equals("animation");
        chai.expect(reply.assets).deep.equals(getAnimationAssets(project));
        chai.expect(reply.assets.map(a => [a.kind, a.id, a.width, a.height, a.interval, a.frames.length])).to.have.deep.members([
            ["animation", "anim1", 4, 3, 150, 2],
            ["animation", "anim2", 2, 2, 500, 1],
        ]);
        const named = reply.assets.find(a => a.id === "anim1");
        chai.expect(named.displayName).equals("walk");
        chai.expect(named.frames).deep.equals(walk.map(frame => pxt.sprite.base64EncodeBitmap(frame)));
        chai.expect(reply.assets.find(a => a.id === "anim2")).not.to.have.property("displayName");
        const jres = project.getProjectAssetsJRes();
        for (const animation of reply.assets)
            chai.expect(jres[animation.id].mimeType, animation.id).equals(pxt.ANIMATION_MIME_TYPE);
    });

    it("lists the open project's JSON assets by asset file id, with their values", async () => {
        project.createNewJsonAsset({ level: 1, names: ["a"] }, "level.json", "levelData");
        project.createNewJsonAsset([1, 2, 3]);
        const reply = await send({ subtype: "list", kind: "json" }) as ProjassetsAssetsReply<"json">;
        chai.expect(reply.subtype).equals("assets");
        chai.expect(reply.kind).equals("json");
        chai.expect(reply.assets).deep.equals(getJsonAssets(project));
        chai.expect(reply.assets).to.have.deep.members([
            { kind: "json", id: "file1", displayName: "levelData", fileName: "level.json", data: { level: 1, names: ["a"] } },
            { kind: "json", id: "file2", data: [1, 2, 3] },
        ]);
    });

    it("carries the project's palette and simulator theme in each list reply", async () => {
        const reply = await send({ subtype: "list", kind: "image" }) as ProjassetsAssetsReply;
        chai.expect(reply.palette).deep.equals(TARGET_PALETTE);
        chai.expect(reply.theme).deep.equals(ACCOUNT_THEME);
        editConfig({ palette: PROJECT_PALETTE, theme: "purple" });
        const edited = await send({ subtype: "list", kind: "image" }) as ProjassetsAssetsReply;
        chai.expect(edited.palette).deep.equals(PROJECT_PALETTE);
        chai.expect(edited.theme).deep.equals(THEME_PRESETS[1].theme);
        editConfig({ theme: { "button-fill": "#010203" } });
        chai.expect((await send({ subtype: "list", kind: "image" }) as ProjassetsAssetsReply).theme)
            .deep.equals({ ...ACCOUNT_THEME, "button-fill": "#010203" });
    });

    it("carries no theme in a list reply when the target offers no simulator themes", async () => {
        pxt.appTarget.simulator = {} as pxt.AppSimulator;
        const reply = await send({ subtype: "list", kind: "image" }) as ProjassetsAssetsReply;
        chai.expect(reply.palette).deep.equals(TARGET_PALETTE);
        chai.expect(reply).not.to.have.property("theme");
    });

    it("carries the project's name in each list reply", async () => {
        const reply = await send({ subtype: "list", kind: "image" }) as ProjassetsAssetsReply;
        chai.expect(reply.name).equals("test");
        editConfig({ name: "renamed" });
        chai.expect((await send({ subtype: "list", kind: "image" }) as ProjassetsAssetsReply).name).equals("renamed");
    });

    it("lists the same assets to every extension", async () => {
        const first = await send({ subtype: "list", kind: "image" }, "owner/repo") as ProjassetsAssetsReply;
        const second = await send({ subtype: "list", kind: "image" }, "other/repo") as ProjassetsAssetsReply;
        chai.expect(second.assets).deep.equals(first.assets);
    });

    it("refuses kinds it does not list with UNSUPPORTED_KIND", async () => {
        for (const kind of ["sprite", "font", "toString", "__proto__"])
            await expectError({ subtype: "list", kind }, "UNSUPPORTED_KIND");
    });

    it("refuses a kind it does not list with UNSUPPORTED_KIND without waiting for a project", async () => {
        open = undefined;
        await expectError({ subtype: "list", kind: "sprite" }, "UNSUPPORTED_KIND");
        open = { loadedAsync: () => new Promise<void>(() => { }) };
        await expectError({ subtype: "list", kind: "sprite" }, "UNSUPPORTED_KIND");
    });

    it("refuses malformed requests with INVALID_REQUEST", async () => {
        await expectError({ subtype: "list" }, "INVALID_REQUEST");
        await expectError({ subtype: "list", kind: 7 }, "INVALID_REQUEST");
        await expectError({ subtype: "write", kind: "image" }, "INVALID_REQUEST");
        for (const msg of ["not a request", null]) {
            const received: (ProjassetsReply | ProjassetsNotification)[] = [];
            await host.handleMessageAsync(SCOPE, msg, r => received.push(r), testFrame());
            chai.expect(received.map(r => (r as ProjassetsErrorReply).code)).deep.equals(["INVALID_REQUEST"]);
        }
    });

    it("refuses requests that arrive when no project is open with PROJECT_CLOSED", async () => {
        open = undefined;
        await expectError({ subtype: "list", kind: "image" }, "PROJECT_CLOSED");
        await expectError({ subtype: "subscribe" }, "PROJECT_CLOSED");
    });

    it(`holds the list requests of one repository beyond ${PROJASSETS_LIST_RATE_LIMIT} within the window, answering them in order once it allows them, and holds no subscription or other repository's list`, async () => {
        for (let i = 0; i < PROJASSETS_LIST_RATE_LIMIT; i++)
            chai.expect((await send({ subtype: "list", kind: "image" }, i % 2 ? SCOPE : `${SCOPE}/sub`)).subtype).equals("assets");
        const received: (ProjassetsReply | ProjassetsNotification)[] = [];
        const held = [post({ subtype: "list", kind: "image" }, received), post({ subtype: "list", kind: "song" }, received)];
        await settle();
        chai.expect(received).deep.equals([]);
        chai.expect((await send({ subtype: "subscribe" })).subtype).equals("ack");
        chai.expect((await send({ subtype: "list", kind: "image" }, "other/repo")).subtype).equals("assets");

        await clock.advance(PROJASSETS_LIST_RATE_WINDOW_MS - 1);
        chai.expect(received).deep.equals([]);
        await clock.advance(1);
        await Promise.all(held);
        chai.expect(received.map(r => (r as ProjassetsAssetsReply).kind)).deep.equals(["image", "song"]);
    });

    it("gives a key in any letter case its repository's list queue and rate window", async () => {
        for (let i = 0; i < PROJASSETS_LIST_RATE_LIMIT; i++)
            chai.expect((await send({ subtype: "list", kind: "image" })).subtype).equals("assets");
        const received: (ProjassetsReply | ProjassetsNotification)[] = [];
        const held = post({ subtype: "list", kind: "image" }, received, "Owner/Repo/Sub");
        await settle();
        chai.expect(received).deep.equals([]);
        await clock.advance(PROJASSETS_LIST_RATE_WINDOW_MS);
        await held;
        chai.expect(received.map(r => r.subtype)).deep.equals(["assets"]);
    });

    it("refuses a list request from a key that names no repository with UNREGISTERED", async () => {
        await expectError({ subtype: "list", kind: "image" }, "UNREGISTERED", "notarepo");
    });

    it("fails a request the project cannot answer and keeps serving", async () => {
        const saved = project;
        project = { getAssets: () => { throw new Error("assets unavailable"); } } as any;
        const reply = await expectError({ subtype: "list", kind: "image" }, "FAILED");
        chai.expect(reply.message).equals("assets unavailable");
        project = saved;
        chai.expect((await send({ subtype: "list", kind: "image" })).subtype).equals("assets");
    });

    describe("subscriptions", () => {
        it("acknowledges a subscription", async () => {
            const reply = await send({ subtype: "subscribe" });
            chai.expect(reply.subtype).equals("ack");
        });

        it("notifies a subscribed extension once after a burst of changes", async () => {
            const received = await subscribe();
            const image = project.getAssets(pxt.AssetType.Image)[0];
            project.updateAsset(withBitmap(image, testBitmap(4, 4)));
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            chai.expect(received).deep.equals([]);
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it(`notifies once, ${PROJASSETS_NOTIFY_DEBOUNCE_MS} ms after the last change of a burst within the window`, async () => {
            const received = await subscribe();
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await clock.advance(PROJASSETS_NOTIFY_DEBOUNCE_MS - 1);
            chai.expect(received).deep.equals([]);
            project.createNewProjectImage(testBitmap(2, 2), "ghost");
            await clock.advance(PROJASSETS_NOTIFY_DEBOUNCE_MS - 1);
            chai.expect(received).deep.equals([]);
            await clock.advance(1);
            chai.expect(received).deep.equals([CHANGED]);
            await clock.advance(PROJASSETS_NOTIFY_MAX_DELAY_MS);
            chai.expect(received).deep.equals([CHANGED]);
        });

        it(`notifies a stream of changes longer than ${PROJASSETS_NOTIFY_MAX_DELAY_MS} ms once at that delay, and once after the stream ends`, async () => {
            const received = await subscribe();
            const step = PROJASSETS_NOTIFY_DEBOUNCE_MS / 2;
            const change = () => project.createNewProjectImage(testBitmap(2, 2));
            change();
            let elapsed = 0;
            while (elapsed + step < PROJASSETS_NOTIFY_MAX_DELAY_MS) {
                await clock.advance(step);
                elapsed += step;
                change();
                chai.expect(received).deep.equals([]);
            }
            await clock.advance(PROJASSETS_NOTIFY_MAX_DELAY_MS - elapsed - 1);
            chai.expect(received).deep.equals([]);
            await clock.advance(1);
            chai.expect(received).deep.equals([CHANGED]);
            for (let i = 0; i < 4; i++) {
                change();
                await clock.advance(step);
            }
            chai.expect(received).deep.equals([CHANGED]);
            await clock.advance(PROJASSETS_NOTIFY_DEBOUNCE_MS - step - 1);
            chai.expect(received).deep.equals([CHANGED]);
            await clock.advance(1);
            chai.expect(received).deep.equals([CHANGED, CHANGED]);
        });

        it("drops a notification pending when the project closes, sending it to no frame of the next project", async () => {
            const received = await subscribe();
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            editConfig({ palette: PROJECT_PALETTE });
            host.close();
            project = new pxt.TilemapProject();
            open = loadedProject();
            config = createProjassetsConfig(testMainPackage({ [pxt.CONFIG_NAME]: testPxtJson() }), accountTheme);
            const next = await subscribe();
            accountTheme.change(ACCOUNT_THEME);
            await clock.advance(PROJASSETS_NOTIFY_MAX_DELAY_MS);
            chai.expect(received).deep.equals([]);
            chai.expect(next).deep.equals([]);
        });

        it("notifies once the change has applied", async () => {
            const seen: string[][] = [];
            await host.handleMessageAsync(SCOPE, { type: "projassets", id: "s", subtype: "subscribe" }, r => {
                if (r.subtype === "changed") seen.push(getImageAssets(project).map(i => i.displayName));
            }, testFrame());
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await passNotifyWindow();
            chai.expect(seen).deep.equals([["hero", "villain"]]);
        });

        it("notifies of undo and redo", async () => {
            const received = await subscribe();
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            project.pushUndo();
            await passNotifyWindow();
            received.length = 0;
            project.undo();
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
            project.redo();
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED, CHANGED]);
        });

        it("notifies each subscribed extension, and no other", async () => {
            const first = await subscribe("owner/repo");
            const second = await subscribe("other/repo");
            const unsubscribed: (ProjassetsReply | ProjassetsNotification)[] = [];
            await post({ subtype: "list", kind: "image" }, unsubscribed, "third/repo");
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await passNotifyWindow();
            chai.expect(first).deep.equals([CHANGED]);
            chai.expect(second).deep.equals([CHANGED]);
            chai.expect(unsubscribed.map(r => r.subtype)).deep.equals(["assets"]);
        });

        it("notifies once after the project's palette changes", async () => {
            const received = await subscribe();
            editConfig({ palette: PROJECT_PALETTE });
            chai.expect(received).deep.equals([]);
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it("notifies once after the project's simulator theme changes, in either declaration form", async () => {
            const received = await subscribe();
            editConfig({ theme: "purple" });
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
            editConfig({ theme: { "dpad-fill": "#0a0b0c" } });
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED, CHANGED]);
        });

        it("notifies once after the project is renamed", async () => {
            const received = await subscribe();
            editConfig({ name: "renamed" });
            chai.expect(received).deep.equals([]);
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it("sends no notification for a config change that leaves the name, palette and theme as they were", async () => {
            const received = await subscribe();
            editConfig({ description: "a new description" });
            editConfig({ description: "a new description", palette: TARGET_PALETTE.slice() });
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
            editConfig({ palette: PROJECT_PALETTE });
            await passNotifyWindow();
            received.length = 0;
            editConfig({ palette: PROJECT_PALETTE, description: "another description" });
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
        });

        it("notifies once for asset and palette changes made together", async () => {
            const received = await subscribe();
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            editConfig({ palette: PROJECT_PALETTE });
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it("notifies of a palette change only in the project its subscriptions were made in", async () => {
            const received = await subscribe();
            const firstPkg = mainPkg;
            const firstFiles = configFiles;
            project = new pxt.TilemapProject();
            open = loadedProject();
            configFiles = { [pxt.CONFIG_NAME]: testPxtJson() };
            mainPkg = testMainPackage(configFiles);
            config = createProjassetsConfig(mainPkg, accountTheme);
            firstFiles[pxt.CONFIG_NAME] = testPxtJson({ palette: PROJECT_PALETTE });
            firstPkg.loadConfig(true);
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
            editConfig({ palette: PROJECT_PALETTE });
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
        });

        it("sends no notification when nothing changes", async () => {
            const received = await subscribe();
            await send({ subtype: "list", kind: "image" });
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
        });

        it("notifies a frame once however often it subscribes", async () => {
            const received: (ProjassetsReply | ProjassetsNotification)[] = [];
            const frame = testFrame();
            await post({ subtype: "subscribe" }, received, SCOPE, frame);
            await post({ subtype: "subscribe" }, received, SCOPE, frame);
            chai.expect(received.map(r => r.subtype)).deep.equals(["ack", "ack"]);
            received.length = 0;
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it("notifies once after the user's simulator theme preference changes, and not after a change that leaves it as it was", async () => {
            const received = await subscribe();
            accountTheme.change({ ...ACCOUNT_THEME, "background-color": "#00aa00" });
            chai.expect(received).deep.equals([]);
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
            accountTheme.change({ ...ACCOUNT_THEME, "background-color": "#00aa00" });
            await passNotifyWindow();
            chai.expect(received).deep.equals([CHANGED]);
        });

        /** A host whose subscribers a test can count. */
        class CountingHost extends ProjassetsHost {
            subscriberCount() {
                return this.subscribers.length;
            }
        }

        it("drops a subscriber whose frame has been removed when it next notifies", async () => {
            const counting = new CountingHost(() => open, () => project, () => config, clock.now, clock.delay);
            host = counting;
            const removedFrame = testFrame();
            const removed = await subscribe(SCOPE, removedFrame);
            const kept = await subscribe();
            removedFrame.isConnected = false;
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await passNotifyWindow();
            chai.expect(removed).deep.equals([]);
            chai.expect(kept).deep.equals([CHANGED]);
            chai.expect(counting.subscriberCount()).equals(1);
        });

        it("drops subscribers whose frames have been removed when another frame subscribes", async () => {
            const counting = new CountingHost(() => open, () => project, () => config, clock.now, clock.delay);
            host = counting;
            const removedFrames = [testFrame(), testFrame()];
            for (const frame of removedFrames) await subscribe(SCOPE, frame);
            removedFrames.forEach(frame => frame.isConnected = false);
            await subscribe();
            chai.expect(counting.subscriberCount()).equals(1);
        });

        it("lets go of the project its subscriptions were made in when it closes, and ends them", async () => {
            const listeners = trackListeners(project);
            const configListeners = trackConfigListeners(config);
            const received = await subscribe();
            chai.expect(listeners.size).equals(1);
            chai.expect(configListeners.size).equals(1);
            chai.expect(accountTheme.listeners.size).equals(1);
            host.close();
            chai.expect(listeners.size).equals(0);
            chai.expect(configListeners.size).equals(0);
            chai.expect(accountTheme.listeners.size).equals(0);
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
        });

        it("notifies each subscribed frame of one extension", async () => {
            const simulatorFrame = await subscribe();
            const tabFrame = await subscribe();
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await passNotifyWindow();
            chai.expect(simulatorFrame).deep.equals([CHANGED]);
            chai.expect(tabFrame).deep.equals([CHANGED]);
        });

        /** Tracks the change listeners `tracked` holds. */
        function trackListeners(tracked: pxt.TilemapProject): Set<() => void> {
            const listeners = new Set<() => void>();
            const add = tracked.addProjectChangeListener.bind(tracked);
            const remove = tracked.removeProjectChangeListener.bind(tracked);
            tracked.addProjectChangeListener = (l: () => void) => { listeners.add(l); add(l); };
            tracked.removeProjectChangeListener = (l: () => void) => { listeners.delete(l); remove(l); };
            return listeners;
        }

        it("ends a subscription when its project closes", async () => {
            const first = project;
            const received = await subscribe();
            project = new pxt.TilemapProject();
            open = loadedProject();
            first.createNewProjectImage(testBitmap(2, 2), "late");
            project.createNewProjectImage(testBitmap(2, 2), "other");
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
        });

        it("follows the project a new subscription is made in, and stops listening to the closed one", async () => {
            const first = project;
            const firstListeners = trackListeners(first);
            const old = await subscribe();
            chai.expect(firstListeners.size).equals(1);
            project = new pxt.TilemapProject();
            open = loadedProject();
            const secondListeners = trackListeners(project);
            const current = await subscribe();
            chai.expect(firstListeners.size).equals(0);
            chai.expect(secondListeners.size).equals(1);
            first.createNewProjectImage(testBitmap(2, 2), "late");
            await passNotifyWindow();
            chai.expect(current).deep.equals([]);
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await passNotifyWindow();
            chai.expect(old).deep.equals([]);
            chai.expect(current).deep.equals([CHANGED]);
        });

        it("stops listening to a project once it has closed and changed", async () => {
            const first = project;
            const listeners = trackListeners(first);
            await subscribe();
            open = undefined;
            first.createNewProjectImage(testBitmap(2, 2), "late");
            await passNotifyWindow();
            chai.expect(listeners.size).equals(0);
        });

        it("listens to a project once, however many extensions subscribe", async () => {
            const listeners = trackListeners(project);
            await subscribe("owner/repo");
            await subscribe("other/repo");
            await subscribe("owner/repo");
            chai.expect(listeners.size).equals(1);
        });

        /** Tracks the config load listeners `tracked` holds. */
        function trackConfigListeners(tracked: ProjassetsConfig): Set<() => void> {
            const listeners = new Set<() => void>();
            const add = tracked.addChangeListener;
            const remove = tracked.removeChangeListener;
            tracked.addChangeListener = l => { listeners.add(l); add(l); };
            tracked.removeChangeListener = l => { listeners.delete(l); remove(l); };
            return listeners;
        }

        it("listens to a project's config once while subscribed, and stops once the project has closed", async () => {
            const listeners = trackConfigListeners(config);
            await subscribe("owner/repo");
            await subscribe("other/repo");
            chai.expect(listeners.size).equals(1);
            open = undefined;
            editConfig({ palette: PROJECT_PALETTE });
            await passNotifyWindow();
            chai.expect(listeners.size).equals(0);
        });

        it("ends its subscriptions, and lets nothing escape, when the configuration cannot be read for a notification", async () => {
            const listeners = trackListeners(project);
            const configListeners = trackConfigListeners(config);
            const received = await subscribe();
            config.getVisualConfig = () => { throw new Error("configuration unavailable"); };
            const reported: unknown[] = [];
            const report = pxt.reportException;
            pxt.reportException = e => { reported.push(e); };
            try {
                project.createNewProjectImage(testBitmap(2, 2), "villain");
                await passNotifyWindow();
            } finally {
                pxt.reportException = report;
            }
            chai.expect(reported.length).equals(1);
            chai.expect(listeners.size).equals(0);
            chai.expect(configListeners.size).equals(0);
            chai.expect(received).deep.equals([]);
        });
    });

    // The editor reloads a project by replacing its main package and editor
    // package, then loading the new package's files and dependencies; the
    // editor package's asset project is built from the main package on its
    // first use and kept. These tests drive the host through that load.
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
        function beginLoad(header: string): { finish: () => void, fail: () => void } {
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
                fail: () => loaded.reject(new Error("load failed")),
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
            stored = { first: projectFiles(["hero", "villain"]), second: projectFiles(["ghost"]) };
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

        it("answers requests that arrive while the project loads once it has loaded", async () => {
            const load = beginLoad("first");
            const listing = sendReload({ subtype: "list", kind: "image" });
            const received: (ProjassetsReply | ProjassetsNotification)[] = [];
            const subscribed = reloadHost.handleMessageAsync(SCOPE, { type: "projassets", id: "s", subtype: "subscribe" }, r => received.push(r), testFrame());
            await passNotifyWindow();
            chai.expect(received).deep.equals([]);
            chai.expect(current.tilemapProject).equals(undefined);
            load.finish();
            const listed = await listing as ProjassetsAssetsReply;
            chai.expect(listed.subtype).equals("assets");
            chai.expect(listed.assets.map(a => a.displayName)).deep.equals(["hero", "villain"]);
            await subscribed;
            chai.expect(received.map(r => r.subtype)).deep.equals(["ack"]);
            chai.expect(builtImageNames()).deep.equals(["hero", "villain"]);

            applyPalette(current, "first");
            await passNotifyWindow();
            chai.expect(received.map(r => r.subtype)).deep.equals(["ack", "changed"]);
        });

        it("refuses with PROJECT_CLOSED a request whose project is replaced while it waits", async () => {
            const replaced = beginLoad("first");
            const listing = sendReload({ subtype: "list", kind: "image" });
            const load = beginLoad("second");
            replaced.finish();
            chai.expect((await listing as ProjassetsErrorReply).code).equals("PROJECT_CLOSED");
            chai.expect(current.tilemapProject).equals(undefined);
            load.finish();
            chai.expect(builtImageNames()).deep.equals(["ghost"]);
        });

        it("refuses with PROJECT_CLOSED a request whose project fails to load", async () => {
            const load = beginLoad("first");
            const listing = sendReload({ subtype: "list", kind: "image" });
            load.fail();
            chai.expect((await listing as ProjassetsErrorReply).code).equals("PROJECT_CLOSED");
            chai.expect(current.tilemapProject).equals(undefined);
        });

        it("keeps the images of another project opened while a notification is pending", async () => {
            const edited = current;
            const load = beginLoad("second");
            applyPalette(edited, "first");
            await passNotifyWindow();
            chai.expect(current.tilemapProject).equals(undefined);
            load.finish();
            chai.expect(builtImageNames()).deep.equals(["ghost"]);
        });
    });
});

describe("projassets client", () => {
    class FakeParent {
        requests: ProjassetsRequest[] = [];
        origins: string[] = [];

        postMessage(msg: ProjassetsRequest, targetOrigin: string) {
            this.requests.push(msg);
            this.origins.push(targetOrigin);
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

        deliver(source: unknown, data: unknown, origin = EDITOR_ORIGIN) {
            this.listeners.forEach(l => l({ source, data, origin } as MessageEvent));
        }
    }

    const IMAGE: ProjassetsImage = { kind: "image", id: "image1", displayName: "hero", width: 2, height: 2, data: "AAAA" };
    const NAME = "My Platformer";
    const PALETTE = ["#000000", "#ffffff"];
    const THEME = { "background-color": "#123456", layout: "default" };
    const CHANGED = { type: "projassets", subtype: "changed" };

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

    it("posts list requests for a kind to the editor with unique ids, and resolves with the assets, the project's name and its visual configuration", async () => {
        const first = client.list("image");
        const second = client.list("image");
        chai.expect(parent.requests.map(r => ({ type: r.type, subtype: r.subtype, kind: (r as any).kind })))
            .deep.equals([{ type: "projassets", subtype: "list", kind: "image" }, { type: "projassets", subtype: "list", kind: "image" }]);
        chai.expect(parent.requests[0].id).not.equals(parent.requests[1].id);
        chai.expect(parent.origins).deep.equals(["*", "*"]);
        replyTo(parent.requests[1], { subtype: "assets", kind: "image", assets: [], name: NAME, palette: PALETTE });
        replyTo(parent.requests[0], { subtype: "assets", kind: "image", assets: [IMAGE], name: NAME, palette: PALETTE, theme: THEME });
        chai.expect(await first).deep.equals({ assets: [IMAGE], name: NAME, palette: PALETTE, theme: THEME });
        chai.expect(await second).deep.equals({ assets: [], name: NAME, palette: PALETTE });
    });

    it("lists each kind the editor lists, resolving with the reply's entries", async () => {
        const entries: { [K in ProjassetsKind]: ProjassetsAssetOfKind[K] } = {
            image: IMAGE,
            tile: { kind: "tile", id: "myTiles.tile1", width: 16, height: 16, data: "AAAA" },
            tilemap: {
                kind: "tilemap", id: "level1", displayName: "level", tileWidth: 16, width: 2, height: 2, data: "AAAA",
                tileset: [{ id: "myTiles.transparency16", width: 16, height: 16, data: "AAAA" }, { id: "castle.stone" }],
            },
            animation: { kind: "animation", id: "anim1", width: 2, height: 2, interval: 100, frames: ["AAAA", "AAAA"] },
            song: { kind: "song", id: "song1", data: "00" },
            json: { kind: "json", id: "file1", fileName: "level.json", data: { level: 1 } },
        };
        for (const kind of Object.keys(entries) as ProjassetsKind[]) {
            const listed = client.list(kind);
            chai.expect(lastRequest()).deep.include({ type: "projassets", subtype: "list", kind });
            replyTo(lastRequest(), { subtype: "assets", kind, assets: [entries[kind]], name: NAME, palette: PALETTE });
            chai.expect((await listed).assets, kind).deep.equals([entries[kind]]);
        }
    });

    it("rejects with the editor's error code", async () => {
        const listed = client.list("image");
        replyTo(lastRequest(), { subtype: "error", code: "PERMISSION_DENIED", message: "not granted" });
        const error = await listed.then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjassetsError);
        chai.expect(error.code).equals("PERMISSION_DENIED");
        chai.expect(error.message).equals("not granted");
    });

    it("rejects an unexpected reply with FAILED", async () => {
        const listed = client.list("image");
        replyTo(lastRequest(), { subtype: "ack" });
        const error = await listed.then(() => undefined, e => e);
        chai.expect(error.code).equals("FAILED");
    });

    it("ignores replies from other windows and to unknown requests", async () => {
        const listed = client.list("image");
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [{ ...IMAGE, id: "forged" }], name: NAME, palette: PALETTE }, {});
        self.deliver(parent, { type: "projassets", id: "unknown", subtype: "assets", kind: "image", assets: [], name: NAME, palette: PALETTE });
        self.deliver(parent, { type: "projfs", id: lastRequest().id, subtype: "files", files: [] });
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [IMAGE], name: NAME, palette: PALETTE });
        chai.expect(await listed).deep.equals({ assets: [IMAGE], name: NAME, palette: PALETTE });
    });

    it("subscribes once the editor acknowledges, then calls the listener on each change", async () => {
        let changes = 0;
        const subscribed = client.subscribe(() => changes++);
        chai.expect(lastRequest()).deep.include({ type: "projassets", subtype: "subscribe" });
        self.deliver(parent, CHANGED);
        chai.expect(changes).equals(0);
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        self.deliver(parent, CHANGED);
        self.deliver(parent, CHANGED);
        chai.expect(changes).equals(2);
    });

    it("ignores change notifications from other windows", async () => {
        let changes = 0;
        const subscribed = client.subscribe(() => changes++);
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        self.deliver({}, CHANGED);
        self.deliver(parent, { type: "other", subtype: "changed" });
        chai.expect(changes).equals(0);
    });

    it("rejects a refused subscription and never calls its listener", async () => {
        let changes = 0;
        const subscribed = client.subscribe(() => changes++);
        replyTo(lastRequest(), { subtype: "error", code: "PROJECT_CLOSED", message: "closed" });
        const error = await subscribed.then(() => undefined, e => e);
        chai.expect(error.code).equals("PROJECT_CLOSED");
        self.deliver(parent, CHANGED);
        chai.expect(changes).equals(0);
    });

    it("reports a request still waiting after slowReplyMs once, and keeps waiting", async () => {
        client.dispose();
        const slow: ProjassetsRequest[] = [];
        client = new ProjassetsClient({ target: parent, listener: self, search: "", slowReplyMs: 5, onSlowReply: r => slow.push(r) });
        const listed = client.list("image");
        await new Promise(resolve => setTimeout(resolve, 30));
        chai.expect(slow).deep.equals([lastRequest()]);
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [IMAGE], name: NAME, palette: PALETTE });
        chai.expect(await listed).deep.equals({ assets: [IMAGE], name: NAME, palette: PALETTE });
    });

    it("fails pending requests with DISPOSED when disposed, and stops calling listeners", async () => {
        let changes = 0;
        const subscribed = client.subscribe(() => changes++);
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        const listed = client.list("image");
        client.dispose();
        const error = await listed.then(() => undefined, e => e);
        chai.expect(error.code).equals("DISPOSED");
        chai.expect(self.listeners).deep.equals([]);
        self.deliver(parent, CHANGED);
        chai.expect(changes).equals(0);
    });

    it("subscribes once however often subscribe is called, and calls each listener once per change", async () => {
        const calls: string[] = [];
        const first = () => calls.push("first");
        const second = () => calls.push("second");
        const subscribed = [client.subscribe(first), client.subscribe(second)];
        chai.expect(parent.requests.length).equals(1);
        replyTo(lastRequest(), { subtype: "ack" });
        await Promise.all(subscribed);
        await client.subscribe(first);
        chai.expect(parent.requests.length).equals(1);
        self.deliver(parent, CHANGED);
        chai.expect(calls).deep.equals(["first", "second"]);
    });

    it("fails a subscribe after dispose with DISPOSED, without posting it, even once a subscription was acknowledged", async () => {
        const subscribed = client.subscribe(() => { });
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        client.dispose();
        let changes = 0;
        const error = await client.subscribe(() => changes++).then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjassetsError);
        chai.expect(error.code).equals("DISPOSED");
        chai.expect(parent.requests.map(r => r.subtype)).deep.equals(["subscribe"]);
        self.deliver(parent, CHANGED);
        chai.expect(changes).equals(0);
    });

    it("sends a new subscription request after a refused one", async () => {
        const refused = client.subscribe(() => { });
        replyTo(lastRequest(), { subtype: "error", code: "PROJECT_CLOSED", message: "closed" });
        chai.expect((await refused.then(() => undefined, e => e)).code).equals("PROJECT_CLOSED");
        let changes = 0;
        const subscribed = client.subscribe(() => changes++);
        chai.expect(parent.requests.map(r => r.subtype)).deep.equals(["subscribe", "subscribe"]);
        replyTo(lastRequest(), { subtype: "ack" });
        await subscribed;
        self.deliver(parent, CHANGED);
        chai.expect(changes).equals(1);
    });

    it("fails a request made after dispose with DISPOSED at once, without posting it", async () => {
        client.dispose();
        for (const request of [client.list("image"), client.subscribe(() => { })]) {
            const error = await (request as Promise<unknown>).then(() => undefined, e => e);
            chai.expect(error).instanceOf(ProjassetsError);
            chai.expect(error.code).equals("DISPOSED");
        }
        chai.expect(parent.requests).deep.equals([]);
    });

    it("fails a request it cannot post with FAILED, and never reports it as slow", async () => {
        client.dispose();
        const slow: ProjassetsRequest[] = [];
        parent.postMessage = () => { throw new Error("could not be cloned"); };
        client = new ProjassetsClient({ target: parent, listener: self, search: "", slowReplyMs: 5, onSlowReply: r => slow.push(r) });
        const error = await client.list("image").then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjassetsError);
        chai.expect(error.code).equals("FAILED");
        await new Promise(resolve => setTimeout(resolve, 30));
        chai.expect(slow).deep.equals([]);
    });

    it("reports a slow reply at once when slowReplyMs is 0", async () => {
        client.dispose();
        const slow: ProjassetsRequest[] = [];
        client = new ProjassetsClient({ target: parent, listener: self, search: "", slowReplyMs: 0, onSlowReply: r => slow.push(r) });
        const listed = client.list("image");
        await new Promise(resolve => setTimeout(resolve, 20));
        chai.expect(slow).deep.equals([lastRequest()]);
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [], name: NAME, palette: PALETTE });
        await listed;
    });

    it("posts requests to the editor's origin from the frame URL by default, or to the origin it is given", async () => {
        client.dispose();
        client = new ProjassetsClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example" });
        const listed = client.list("image");
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [], name: NAME, palette: PALETTE });
        await listed;
        client.dispose();
        client = new ProjassetsClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example", targetOrigin: "https://other.example" });
        const again = client.list("image");
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [], name: NAME, palette: PALETTE }, parent, "https://other.example");
        await again;
        chai.expect(parent.origins).deep.equals(["https://editor.example", "https://other.example"]);
    });

    it("ignores replies from another origin while it posts to the editor's origin", async () => {
        client.dispose();
        client = new ProjassetsClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example" });
        const listed = client.list("image");
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [{ ...IMAGE, id: "forged" }], name: NAME, palette: PALETTE }, parent, "https://elsewhere.example");
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [IMAGE], name: NAME, palette: PALETTE });
        chai.expect((await listed).assets).deep.equals([IMAGE]);
    });

    it("accepts replies from any origin while it posts to any origin", async () => {
        const listed = client.list("image");
        replyTo(lastRequest(), { subtype: "assets", kind: "image", assets: [IMAGE], name: NAME, palette: PALETTE }, parent, "https://elsewhere.example");
        chai.expect((await listed).assets).deep.equals([IMAGE]);
    });

    it("reads the editor's API level from the frame URL, or 0 when it is absent or malformed", () => {
        expectApiLevelReader(getProjassetsApiLevel);
    });

    it("reads the editor's origin from the frame URL", () => {
        expectParentOriginReader(getProjassetsParentOrigin);
    });

    describe("through the host", () => {
        withTargetVisuals(TARGET_PALETTE, THEME_PRESETS);

        it("lists a project's images, name and visual configuration, and hears their changes", async () => {
            const project = new pxt.TilemapProject();
            const bitmap = testBitmap(3, 2);
            const image = project.createNewProjectImage(bitmap, "hero");
            const files = { [pxt.CONFIG_NAME]: testPxtJson() };
            const mainPkg = testMainPackage(files);
            const open: ProjassetsOpenProject = { loadedAsync: () => Promise.resolve() };
            const clock = new FakeClock();
            const host = new ProjassetsHost(() => open, () => project, () => createProjassetsConfig(mainPkg, new FakeAccountTheme()), clock.now, clock.delay);
            const frame = testFrame();
            // the editor posts each reply and notification back to the frame's window
            parent.postMessage = (msg: ProjassetsRequest) => {
                host.handleMessageAsync("owner/repo", msg, reply => self.deliver(parent, reply), frame);
            };
            const listing: ProjassetsListing = await client.list("image");
            chai.expect(listing).deep.equals({
                assets: [{
                    kind: "image", id: "image1", displayName: "hero", width: 3, height: 2, data: pxt.sprite.base64EncodeBitmap(bitmap),
                }],
                name: "test",
                palette: TARGET_PALETTE,
                theme: ACCOUNT_THEME,
            });
            let changes = 0;
            await client.subscribe(() => changes++);
            const edited = testBitmap(5, 5);
            project.updateAsset(withBitmap(image, edited));
            await clock.advance(PROJASSETS_NOTIFY_DEBOUNCE_MS);
            chai.expect(changes).equals(1);
            // list types its assets by the kind it lists: this fails to compile otherwise
            const images: ProjassetsImage[] = (await client.list("image")).assets;
            chai.expect(images.map(i => [i.width, i.height, i.data]))
                .deep.equals([[5, 5, pxt.sprite.base64EncodeBitmap(edited)]]);
            files[pxt.CONFIG_NAME] = testPxtJson({ palette: PROJECT_PALETTE });
            mainPkg.loadConfig(true);
            await clock.advance(PROJASSETS_NOTIFY_DEBOUNCE_MS);
            chai.expect(changes).equals(2);
            chai.expect((await client.list("image")).palette).deep.equals(PROJECT_PALETTE);
            files[pxt.CONFIG_NAME] = testPxtJson({ palette: PROJECT_PALETTE, name: "renamed" });
            mainPkg.loadConfig(true);
            await clock.advance(PROJASSETS_NOTIFY_DEBOUNCE_MS);
            chai.expect(changes).equals(3);
            chai.expect((await client.list("image")).name).equals("renamed");
        });
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

    it("calls the compile function once per request with nothing, and reads the open project only to wait for its load", async () => {
        const read: PropertyKey[] = [];
        const project = loadedProject();
        open = new Proxy(project, {
            get: (target, property) => {
                read.push(property);
                return (target as any)[property];
            },
        });
        await send({ subtype: "compile" });
        await send({ subtype: "compile" });
        chai.expect(compileCalls).deep.equals([[], []]);
        // awaiting an async function's result looks up its `then`
        chai.expect(read.filter(p => p !== "loadedAsync" && p !== "then")).deep.equals([]);
        chai.expect(read.filter(p => p === "loadedAsync").length).equals(2);
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

    it("refuses an unknown or malformed request with INVALID_REQUEST without compiling", async () => {
        await expectError({ subtype: "run" }, "INVALID_REQUEST");
        await expectError({}, "INVALID_REQUEST");
        for (const msg of ["not a request", null]) {
            const received: ProjprogramReply[] = [];
            await host.handleMessageAsync(SCOPE, msg, r => received.push(r));
            chai.expect(outcomes(received)).deep.equals(["INVALID_REQUEST"]);
        }
        chai.expect(compileCalls).deep.equals([]);
    });

    it("refuses a request from a key that names no repository with UNREGISTERED", async () => {
        await expectError({ subtype: "compile" }, "UNREGISTERED", "notarepo");
        chai.expect(compileCalls).deep.equals([]);
    });

    it("fails a request whose compile throws, and keeps serving", async () => {
        compileImpl = call => call === 0 ? Promise.reject(new Error("worker gone")) : Promise.resolve(testProgram(call));
        await expectError({ subtype: "compile" }, "FAILED");
        chai.expect((await send({ subtype: "compile" })).subtype).equals("program");
    });

    it("compiles one request at a time, answering each repository's requests in order, each with a compile of its own", async () => {
        const pending: Deferred<ProjprogramCompileOutcome>[] = [];
        compileImpl = () => {
            const d = deferred<ProjprogramCompileOutcome>();
            pending.push(d);
            return d.promise;
        };
        const received: ProjprogramReply[] = [];
        const other: ProjprogramReply[] = [];
        const requests = [
            post({ subtype: "compile" }, received),
            post({ subtype: "compile" }, received, `${SCOPE}/sub`),
            post({ subtype: "compile" }, other, "other/repo"),
        ];
        await settle();
        chai.expect(compileCalls.length).equals(1);
        chai.expect(received.concat(other)).deep.equals([]);

        pending[0].resolve(testProgram(10));
        await settle();
        chai.expect((received as ProjprogramProgramReply[]).map(r => r.code)).deep.equals([testProgram(10).code]);
        chai.expect(compileCalls.length).equals(2);

        pending[1].resolve(testProgram(11));
        await settle();
        chai.expect((other as ProjprogramProgramReply[]).map(r => r.code)).deep.equals([testProgram(11).code]);
        chai.expect(compileCalls.length).equals(3);

        pending[2].resolve(testProgram(12));
        await Promise.all(requests);
        chai.expect((received as ProjprogramProgramReply[]).map(r => r.code)).deep.equals([testProgram(10).code, testProgram(12).code]);
    });

    it(`holds the compiles of one repository beyond ${PROJPROGRAM_RATE_LIMIT} within the window, answering them in order once it allows them, and holds no other repository's`, async () => {
        for (let i = 0; i < PROJPROGRAM_RATE_LIMIT; i++)
            chai.expect((await send({ subtype: "compile" }, i % 2 ? SCOPE : `${SCOPE}/sub`)).subtype).equals("program");
        const received: ProjprogramReply[] = [];
        const held = [post({ subtype: "compile" }, received), post({ subtype: "compile" }, received, "Owner/Repo")];
        await settle();
        chai.expect(received).deep.equals([]);
        chai.expect((await send({ subtype: "compile" }, "other/repo")).subtype).equals("program");

        await clock.advance(PROJPROGRAM_RATE_WINDOW_MS - 1);
        chai.expect(received).deep.equals([]);
        await clock.advance(1);
        await Promise.all(held);
        chai.expect(outcomes(received)).deep.equals(["program", "program"]);
        chai.expect(compileCalls.length).equals(PROJPROGRAM_RATE_LIMIT + 3);
    });

    describe("project switches", () => {
        it("refuses a request that arrives when no project is open with PROJECT_CLOSED, without compiling", async () => {
            open = undefined;
            await expectError({ subtype: "compile" }, "PROJECT_CLOSED");
            chai.expect(compileCalls).deep.equals([]);
        });

        it("refuses a request whose project fails to load with PROJECT_CLOSED, without compiling", async () => {
            open = { loadedAsync: () => Promise.reject(new Error("load failed")) };
            await expectError({ subtype: "compile" }, "PROJECT_CLOSED");
            chai.expect(compileCalls).deep.equals([]);
        });

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

        it("refuses a request waiting for another repository's compile when its project switches, without compiling, and keeps serving", async () => {
            const compile = deferred<ProjprogramCompileOutcome>();
            compileImpl = call => call === 0 ? compile.promise : Promise.resolve(testProgram(call));
            const received: ProjprogramReply[] = [];
            const other: ProjprogramReply[] = [];
            const compiling = post({ subtype: "compile" }, received);
            const waiting = post({ subtype: "compile" }, other, "other/repo");
            await settle();
            open = loadedProject();
            compile.resolve(testProgram(0));
            await Promise.all([compiling, waiting]);
            chai.expect(outcomes(received)).deep.equals(["PROJECT_CLOSED"]);
            chai.expect(outcomes(other)).deep.equals(["PROJECT_CLOSED"]);
            chai.expect(compileCalls.length).equals(1);
            chai.expect((await send({ subtype: "compile" }, "other/repo")).subtype).equals("program");
        });

        it("refuses a request whose compile fails after its project closed with PROJECT_CLOSED", async () => {
            const compile = deferred<ProjprogramCompileOutcome>();
            compileImpl = () => compile.promise;
            const received: ProjprogramReply[] = [];
            const compiling = post({ subtype: "compile" }, received);
            await settle();
            open = undefined;
            compile.reject(new Error("no project"));
            await compiling;
            chai.expect(outcomes(received)).deep.equals(["PROJECT_CLOSED"]);
        });

        it("refuses a request held by the rate limit past its project's switch with PROJECT_CLOSED, without compiling", async () => {
            for (let i = 0; i < PROJPROGRAM_RATE_LIMIT; i++)
                await send({ subtype: "compile" });
            const received: ProjprogramReply[] = [];
            const held = post({ subtype: "compile" }, received);
            await settle();
            open = loadedProject();
            await clock.advance(PROJPROGRAM_RATE_WINDOW_MS);
            await held;
            chai.expect(outcomes(received)).deep.equals(["PROJECT_CLOSED"]);
            chai.expect(compileCalls.length).equals(PROJPROGRAM_RATE_LIMIT);
        });

        it("compiles a request that arrives after a switch in the project open then", async () => {
            open = loadedProject();
            chai.expect((await send({ subtype: "compile" })).subtype).equals("program");
        });
    });
});

describe("projprogram client", () => {
    class FakeParent {
        requests: ProjprogramRequest[] = [];
        origins: string[] = [];

        postMessage(msg: ProjprogramRequest, targetOrigin: string) {
            this.requests.push(msg);
            this.origins.push(targetOrigin);
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

        deliver(source: unknown, data: unknown, origin = EDITOR_ORIGIN) {
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

    it("posts compile requests to the editor with unique ids, and resolves each with its own reply", async () => {
        const first = client.compile();
        const second = client.compile();
        chai.expect(parent.requests.map(r => ({ type: r.type, subtype: r.subtype })))
            .deep.equals([{ type: "projprogram", subtype: "compile" }, { type: "projprogram", subtype: "compile" }]);
        chai.expect(parent.requests[0].id).not.equals(parent.requests[1].id);
        chai.expect(parent.origins).deep.equals(["*", "*"]);
        replyTo(parent.requests[1], { subtype: "program", code: "second", options: {} });
        replyTo(parent.requests[0], { subtype: "program", ...PROGRAM });
        chai.expect(await first).deep.equals(PROGRAM);
        chai.expect(await second).deep.equals({ code: "second", options: {} });
    });

    it("rejects with the editor's error code", async () => {
        const compiled = client.compile();
        replyTo(lastRequest(), { subtype: "error", code: "PERMISSION_DENIED", message: "not granted" });
        const error = await compiled.then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjprogramError);
        chai.expect(error.code).equals("PERMISSION_DENIED");
        chai.expect(error.diagnostics).deep.equals([]);
    });

    it("rejects with COMPILE_FAILED carrying the reply's diagnostics", async () => {
        const diagnostics: ProjprogramDiagnostic[] = [
            { fileName: "main.ts", line: 2, column: 4, code: 2304, category: "error", message: "m" },
            { code: 9200, category: "warning", message: "w" },
        ];
        const compiled = client.compile();
        replyTo(lastRequest(), { subtype: "error", code: "COMPILE_FAILED", message: "failed", diagnostics });
        const error = await compiled.then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjprogramError);
        chai.expect(error.code).equals("COMPILE_FAILED");
        chai.expect(error.diagnostics).deep.equals(diagnostics);
    });

    it("rejects an unexpected reply with FAILED", async () => {
        const compiled = client.compile();
        replyTo(lastRequest(), { subtype: "ack" });
        const error = await compiled.then(() => undefined, e => e);
        chai.expect(error.code).equals("FAILED");
    });

    it("ignores replies from other windows, to unknown requests and of other families", async () => {
        const compiled = client.compile();
        replyTo(lastRequest(), { subtype: "program", code: "forged", options: {} }, {});
        self.deliver(parent, { type: "projprogram", id: "unknown", subtype: "program", code: "unknown", options: {} });
        self.deliver(parent, { type: "projfs", id: lastRequest().id, subtype: "files", files: [] });
        replyTo(lastRequest(), { subtype: "program", ...PROGRAM });
        chai.expect(await compiled).deep.equals(PROGRAM);
    });

    it("reports a request still waiting after slowReplyMs once, and keeps waiting", async () => {
        client.dispose();
        const slow: ProjprogramRequest[] = [];
        client = new ProjprogramClient({ target: parent, listener: self, search: "", slowReplyMs: 5, onSlowReply: r => slow.push(r) });
        const compiled = client.compile();
        await new Promise(resolve => setTimeout(resolve, 30));
        chai.expect(slow).deep.equals([lastRequest()]);
        replyTo(lastRequest(), { subtype: "program", ...PROGRAM });
        chai.expect(await compiled).deep.equals(PROGRAM);
    });

    it("reports a slow reply at once when slowReplyMs is 0", async () => {
        client.dispose();
        const slow: ProjprogramRequest[] = [];
        client = new ProjprogramClient({ target: parent, listener: self, search: "", slowReplyMs: 0, onSlowReply: r => slow.push(r) });
        const compiled = client.compile();
        await new Promise(resolve => setTimeout(resolve, 20));
        chai.expect(slow).deep.equals([lastRequest()]);
        replyTo(lastRequest(), { subtype: "program", ...PROGRAM });
        await compiled;
    });

    it("fails pending requests with DISPOSED when disposed, and stops listening", async () => {
        const compiled = client.compile();
        client.dispose();
        const error = await compiled.then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjprogramError);
        chai.expect(error.code).equals("DISPOSED");
        chai.expect(self.listeners).deep.equals([]);
    });

    it("fails a request made after dispose with DISPOSED at once, without posting it", async () => {
        client.dispose();
        const error = await client.compile().then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjprogramError);
        chai.expect(error.code).equals("DISPOSED");
        chai.expect(parent.requests).deep.equals([]);
    });

    it("fails a request it cannot post with FAILED, and never reports it as slow", async () => {
        client.dispose();
        const slow: ProjprogramRequest[] = [];
        parent.postMessage = () => { throw new Error("could not be cloned"); };
        client = new ProjprogramClient({ target: parent, listener: self, search: "", slowReplyMs: 5, onSlowReply: r => slow.push(r) });
        const error = await client.compile().then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjprogramError);
        chai.expect(error.code).equals("FAILED");
        await new Promise(resolve => setTimeout(resolve, 30));
        chai.expect(slow).deep.equals([]);
    });

    it("posts requests to the editor's origin from the frame URL by default, or to the origin it is given", async () => {
        client.dispose();
        client = new ProjprogramClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example" });
        const compiled = client.compile();
        replyTo(lastRequest(), { subtype: "program", ...PROGRAM });
        await compiled;
        client.dispose();
        client = new ProjprogramClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example", targetOrigin: "https://other.example" });
        const again = client.compile();
        replyTo(lastRequest(), { subtype: "program", ...PROGRAM }, parent, "https://other.example");
        await again;
        chai.expect(parent.origins).deep.equals(["https://editor.example", "https://other.example"]);
    });

    it("ignores replies from another origin while it posts to the editor's origin", async () => {
        client.dispose();
        client = new ProjprogramClient({ target: parent, listener: self, search: "?parentOrigin=https%3A%2F%2Feditor.example" });
        const compiled = client.compile();
        replyTo(lastRequest(), { subtype: "program", code: "forged", options: {} }, parent, "https://elsewhere.example");
        replyTo(lastRequest(), { subtype: "program", ...PROGRAM });
        chai.expect(await compiled).deep.equals(PROGRAM);
    });

    it("accepts replies from any origin while it posts to any origin", async () => {
        const compiled = client.compile();
        replyTo(lastRequest(), { subtype: "program", ...PROGRAM }, parent, "https://elsewhere.example");
        chai.expect(await compiled).deep.equals(PROGRAM);
    });

    it("reads the editor's API level from the frame URL, or 0 when it is absent or malformed", () => {
        expectApiLevelReader(getProjprogramApiLevel);
    });

    it("reads the editor's origin from the frame URL", () => {
        expectParentOriginReader(getProjprogramParentOrigin);
    });

    it("receives the program the host's compile function returns, and a compile failure's diagnostics, through the host", async () => {
        const failed = failedCompile();
        let outcome: ProjprogramCompileOutcome = testProgram(3);
        const open: ProjprogramOpenProject = { loadedAsync: () => Promise.resolve() };
        const clock = new FakeClock();
        const host = new ProjprogramHost(() => open, () => Promise.resolve(outcome), clock.now, clock.delay);
        // the editor posts each reply back to the frame's window
        parent.postMessage = (msg: ProjprogramRequest) => {
            host.handleMessageAsync("owner/repo", msg, reply => self.deliver(parent, reply));
        };
        chai.expect(await client.compile()).deep.equals({ code: testProgram(3).code, options: testProgram(3).options });
        outcome = { failed };
        const error = await client.compile().then(() => undefined, e => e);
        chai.expect(error.code).equals("COMPILE_FAILED");
        chai.expect(error.diagnostics).deep.equals(getProgramDiagnostics(failed));
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
describe("simulator extension editor tab labels", () => {
    const resolve = resolveSimxEditorLabel;

    it("passes a text label through, in any language", () => {
        chai.expect(resolve("Ext", "fr")).equals("Ext");
        chai.expect(resolve("Ext", undefined)).equals("Ext");
    });

    it("resolves a map under the exact code, then the base language, then the lower-case code, then en, then the first entry", () => {
        const label = { "de": "de", "en": "en", "pt": "pt", "pt-BR": "pt-BR", "zh-cn": "zh-cn" };
        chai.expect(resolve(label, "pt-BR")).equals("pt-BR");
        chai.expect(resolve(label, "pt-PT")).equals("pt");
        chai.expect(resolve(label, "zh-CN")).equals("zh-cn");
        chai.expect(resolve(label, "fr")).equals("en");
        chai.expect(resolve(label, undefined)).equals("en");
        chai.expect(resolve({ "de": "de", "es": "es" }, "fr")).equals("de");
    });

    it("skips empty values at every step", () => {
        chai.expect(resolve({ "fr": "", "en": "en" }, "fr")).equals("en");
        chai.expect(resolve({ "de": "", "en": "", "es": "es" }, "fr")).equals("es");
    });

    it("resolves nothing from an empty text, an empty map, a map of empty values, or no label", () => {
        for (const label of ["", {}, { "fr": "", "en": "" }, undefined])
            chai.expect(resolve(label, "fr")).equals(undefined);
    });
});

describe("simulator extension editor tab registrations", () => {
    const EXT = "someorg/pxt-ext";
    const OTHER = "otherorg/pxt-other";

    // a registration as the driver resolves one that declares and enables a tab
    function resolved(key: string, extra: object = {}) {
        return {
            editor: { index: "index.html", label: key + " label" },
            editorUrl: `https://sim.example/simx/${key}/-/index.html`,
            ...extra,
        };
    }

    it("offers the registrations the driver resolved a tab for, in registration order", () => {
        const registrations = getSimxEditorRegistrations({
            [OTHER]: resolved(OTHER, { allowPopups: true }),
            "plainorg/pxt-plain": {},
            "declaredorg/pxt-declared": { editor: { label: "unresolved" } },
            [EXT]: resolved(EXT, { allowClipboard: true, allowDownloads: true }),
        });
        chai.expect(registrations.map(r => r.key)).deep.equals([OTHER, EXT]);
        chai.expect(registrations[0]).deep.include({ url: `https://sim.example/simx/${OTHER}/-/index.html`, allowPopups: true });
        chai.expect(registrations[1]).deep.include({ allowClipboard: true, allowDownloads: true });
        chai.expect(getSimxEditorRegistrations(undefined)).deep.equals([]);
    });

    it("names a tab by its text label, or by its map label in the user's language", () => {
        const language = pxt.Util.userLanguage();
        try {
            for (const [userLanguage, expected] of [["fr", "fr"], ["pt-BR", "pt"], ["de", "en"]]) {
                pxt.Util.setUserLanguage(userLanguage);
                const [text, map] = getSimxEditorRegistrations({
                    [EXT]: resolved(EXT),
                    [OTHER]: resolved(OTHER, { editor: { index: "index.html", label: { "en": "en", "fr": "fr", "pt": "pt" } } }),
                });
                chai.expect([text.label, map.label], userLanguage).deep.equals([EXT + " label", expected]);
            }
        } finally {
            pxt.Util.setUserLanguage(language);
        }
    });

    it("names a tab by its key when its label names nothing, logging each such key once", () => {
        const unnamed: pxt.Map<object> = {
            "nolabelorg/pxt-ext": { index: "index.html" },
            "emptytextorg/pxt-ext": { index: "index.html", label: "" },
            "emptymaporg/pxt-ext": { index: "index.html", label: {} },
            "emptyvaluesorg/pxt-ext": { index: "index.html", label: { "en": "", "fr": "" } },
        };
        const keys = Object.keys(unnamed);
        const warnings: unknown[][] = [];
        class RecordingLogger extends pxt.ConsoleLogger {
            warn(...args: unknown[]) { warnings.push(args); }
        }
        pxt.setLogger(new RecordingLogger());
        try {
            for (let i = 0; i < 2; i++) {
                const registrations = getSimxEditorRegistrations({
                    ...pxt.Util.mapMap(unnamed, (key, editor) => resolved(key, { editor })),
                    [EXT]: resolved(EXT),
                });
                chai.expect(registrations.map(r => [r.key, r.label])).deep.equals([...keys.map(key => [key, key]), [EXT, EXT + " label"]]);
            }
        } finally {
            pxt.setLogger(new pxt.ConsoleLogger());
        }
        chai.expect(warnings.length).equals(keys.length);
        chai.expect(keys.map(key => warnings.filter(w => w.join(" ").indexOf(key) >= 0).length)).deep.equals(keys.map(() => 1));
    });

    it("carries a tab's icon as class names, or as the URL the driver resolved for an SVG path, never both", () => {
        const [classIcon, svgIcon, noIcon] = getSimxEditorRegistrations({
            [EXT]: resolved(EXT, { editor: { index: "index.html", label: "Ext", icon: "xicon js" } }),
            [OTHER]: resolved(OTHER, { editor: { index: "index.html", label: "Other", icon: "brand/icon.svg" }, iconUrl: `https://sim.example/simx/${OTHER}/-/brand/icon.svg` }),
            "plainorg/pxt-plain": resolved("plainorg/pxt-plain"),
        });
        chai.expect(classIcon).deep.include({ icon: "xicon js", iconUrl: undefined });
        chai.expect(svgIcon).deep.include({ icon: undefined, iconUrl: `https://sim.example/simx/${OTHER}/-/brand/icon.svg` });
        chai.expect(noIcon).deep.include({ icon: undefined, iconUrl: undefined });
    });

    it("carries the types a tab creates, as the driver resolved them", () => {
        const [creating, plain] = getSimxEditorRegistrations({
            [EXT]: resolved(EXT, { creates: ["ext.Thing", "ext.Other"] }),
            [OTHER]: resolved(OTHER),
        });
        chai.expect(creating.creates).deep.equals(["ext.Thing", "ext.Other"]);
        chai.expect(plain.creates).equals(undefined);
    });

    it("offers a project the tabs of the extensions it includes, matching the repository in any case and at any depth", () => {
        const registrations = getSimxEditorRegistrations({ [EXT]: resolved(EXT), [OTHER]: resolved(OTHER) });
        const keys = (deps: string[]) => getProjectSimxEditors(registrations, deps).map(r => r.key);
        chai.expect(keys(["*", "github:SomeOrg/PXT-Ext/makecode/extensions/arcade#v1.0.0"])).deep.equals([EXT]);
        chai.expect(keys(["github:otherorg/pxt-other#abc", "github:someorg/pxt-ext"])).deep.equals([EXT, OTHER]);
        chai.expect(keys(["*", "file:../pxt-ext", "github:someorg/pxt-extended"])).deep.equals([]);
    });

    it("tells whether a project includes an extension by the GitHub repositories of its dependencies", () => {
        chai.expect(isSimxInProject(EXT, ["*", "github:SomeOrg/PXT-Ext/makecode/extensions/arcade#v1.0.0"])).equals(true);
        chai.expect(isSimxInProject(EXT, ["*", "file:../pxt-ext", "github:someorg/pxt-extended", undefined])).equals(false);
        chai.expect(isSimxInProject(EXT, [])).equals(false);
    });

    it("includes every registration of a repository the project depends on, whatever subfolder its key names", () => {
        const deps = ["*", "github:owner/repo/some/path#v1.0.0"];
        chai.expect(isSimxInProject("owner/repo/sub", deps)).equals(true);
        chai.expect(isSimxInProject("Owner/Repo/other/sub", deps)).equals(true);
        chai.expect(isSimxInProject("owner/repo", deps)).equals(true);
        chai.expect(isSimxInProject("owner/repo2/sub", deps)).equals(false);
        chai.expect(isSimxInProject("other/repo/sub", deps)).equals(false);
        const registrations = getSimxEditorRegistrations({ "owner/repo/sub": resolved("owner/repo/sub"), [OTHER]: resolved(OTHER) });
        chai.expect(getProjectSimxEditors(registrations, deps).map(r => r.key)).deep.equals(["owner/repo/sub"]);
    });

    it("never includes a registration whose key names no repository", () => {
        for (const key of ["", "owner", "owner/"])
            chai.expect(isSimxInProject(key, ["github:owner/repo"]), key).equals(false);
    });

    it("names one marker file per tab and finds the tab from it", () => {
        const registrations = getSimxEditorRegistrations({ [EXT]: resolved(EXT), [OTHER]: resolved(OTHER) });
        const names = [EXT, OTHER].map(getSimxEditorMarkerName);
        chai.expect(names[0]).not.equals(names[1]);
        chai.expect(names.every(n => n.indexOf("/") < 0)).equals(true);
        chai.expect(names.map(n => getSimxEditorKeyOfMarker(n, registrations))).deep.equals([EXT, OTHER]);
        chai.expect(getSimxEditorKeyOfMarker(pxt.ASSETS_FILE, registrations)).equals(undefined);
        chai.expect(getSimxEditorKeyOfMarker(getSimxEditorMarkerName("thirdorg/pxt-third"), registrations)).equals(undefined);
    });

    it("names marker files that are session-only", () => {
        const names = [EXT, OTHER, "thirdorg/pxt-third"].map(getSimxEditorMarkerName);
        chai.expect(names.map(pxt.isSessionOnlyFile)).deep.equals([true, true, true]);
    });

    it("tells a simulator frame whether the editor offers its tab", () => {
        chai.expect(hasEditorTab("?channel=someorg%2Fpxt-ext&editor=1")).equals(true);
        chai.expect(hasEditorTab("?channel=someorg%2Fpxt-ext")).equals(false);
    });

    it("reads the editor's API level from the frame URL, or 0 when it is absent or malformed", () => {
        expectApiLevelReader(getSimxEditorApiLevel);
    });

    it("reads the editor's origin from the frame URL", () => {
        expectParentOriginReader(getSimxEditorParentOrigin);
    });
});

describe("simulator extension instance creators", () => {
    const TYPE = "ext.Thing";

    function registrations(map: pxt.Map<string[] | undefined>): SimxEditorRegistration[] {
        return getSimxEditorRegistrations(pxt.Util.mapMap(map, (key, creates) => ({
            editor: { index: "index.html", label: key },
            editorUrl: `https://sim.example/simx/${key}/-/index.html`,
            creates,
        })));
    }

    function find(regs: SimxEditorRegistration[], deps: string[], typeRepository: string | undefined, type = TYPE) {
        const { creator, ignored } = findSimxInstanceCreator(getProjectSimxEditors(regs, deps), type, typeRepository);
        return { creator: creator?.key, ignored };
    }

    it("is the registration claiming the type that the project includes, of the repository declaring the type", () => {
        const regs = registrations({ "someorg/pxt-ext/sub": [TYPE], "otherorg/pxt-other": [TYPE] });
        chai.expect(find(regs, ["github:SomeOrg/PXT-Ext/makecode/vm#v1"], "someorg/pxt-ext")).deep.equals({ creator: "someorg/pxt-ext/sub", ignored: [] });
        chai.expect(find(regs, ["github:someorg/pxt-ext"], "SomeOrg/PXT-Ext").creator).equals("someorg/pxt-ext/sub");
    });

    it("is none for a type no included registration claims", () => {
        const regs = registrations({ "someorg/pxt-ext": ["ext.Other"], "thirdorg/pxt-third": undefined });
        chai.expect(find(regs, ["github:someorg/pxt-ext", "github:thirdorg/pxt-third"], "someorg/pxt-ext")).deep.equals({ creator: undefined, ignored: [] });
        chai.expect(find(registrations({ "someorg/pxt-ext": [TYPE] }), ["github:otherorg/pxt-other"], "someorg/pxt-ext").creator).equals(undefined);
    });

    it("ignores a claim on a type another repository, or the project's own code, declares", () => {
        const regs = registrations({ "otherorg/pxt-other": [TYPE], "someorg/pxt-ext": [TYPE] });
        const deps = ["github:otherorg/pxt-other", "github:someorg/pxt-ext"];
        chai.expect(find(regs, deps, "someorg/pxt-ext")).deep.equals({
            creator: "someorg/pxt-ext",
            ignored: [{ key: "otherorg/pxt-other", reason: "OTHER_REPOSITORY" }],
        });
        chai.expect(find(regs, deps, undefined)).deep.equals({
            creator: undefined,
            ignored: [{ key: "otherorg/pxt-other", reason: "OTHER_REPOSITORY" }, { key: "someorg/pxt-ext", reason: "OTHER_REPOSITORY" }],
        });
    });

    it("is the first in registration order of two registrations claiming one type, the other ignored", () => {
        const regs = registrations({ "someorg/pxt-ext/b": [TYPE], "someorg/pxt-ext/a": ["ext.Other", TYPE] });
        chai.expect(find(regs, ["github:someorg/pxt-ext"], "someorg/pxt-ext")).deep.equals({
            creator: "someorg/pxt-ext/b",
            ignored: [{ key: "someorg/pxt-ext/a", reason: "CLAIMED_EARLIER" }],
        });
        chai.expect(find(regs, ["github:someorg/pxt-ext"], "someorg/pxt-ext", "ext.Other").creator).equals("someorg/pxt-ext/a");
    });

    it("reads the repository of a dependency from its GitHub version spec only", () => {
        chai.expect(getDependencyRepository("github:SomeOrg/pxt-ext/makecode/vm#v1.0.0")).equals("SomeOrg/pxt-ext");
        for (const spec of ["*", "file:../pxt-ext", "workspace:abc", "", undefined])
            chai.expect(getDependencyRepository(spec), spec).equals(undefined);
    });
});

describe("fixed-instance dropdown options", () => {
    const instances: [string, string][] = [["a", "ns.a"], ["b", "ns.b"]];

    // the values of `options`, a separator standing as "separator"
    function values(options: ReturnType<typeof getInstanceDropdownOptions>) {
        return options.map(o => o === "separator" ? o : o[1]);
    }

    it("appends a separator and one trailing create entry, with the reserved value, when only the create entry is offered", () => {
        const options = getInstanceDropdownOptions(instances, undefined, "create", "empty");
        chai.expect(options.slice(0, instances.length)).deep.equals(instances);
        chai.expect(values(options)).deep.equals(["ns.a", "ns.b", "separator", CREATE_INSTANCE_OPTION_VALUE]);
    });

    it("appends a separator and one trailing edit entry, with the reserved value, when only the edit entry is offered", () => {
        const options = getInstanceDropdownOptions(instances, "edit", undefined, "empty");
        chai.expect(options.slice(0, instances.length)).deep.equals(instances);
        chai.expect(values(options)).deep.equals(["ns.a", "ns.b", "separator", OPEN_INSTANCE_OPTION_VALUE]);
    });

    it("places the edit entry before the create entry, after one separator, when both are offered", () => {
        const options = getInstanceDropdownOptions(instances, "edit", "create", "empty");
        chai.expect(options.slice(0, instances.length)).deep.equals(instances);
        chai.expect(values(options)).deep.equals(["ns.a", "ns.b", "separator", OPEN_INSTANCE_OPTION_VALUE, CREATE_INSTANCE_OPTION_VALUE]);
    });

    it("lists the instances alone, with no separator, when neither entry is offered", () => {
        chai.expect(getInstanceDropdownOptions(instances, undefined, undefined, "empty")).deep.equals(instances);
    });

    it("lists the command entries alone, with no separator, when there are no instances", () => {
        chai.expect(values(getInstanceDropdownOptions([], undefined, "create", "empty"))).deep.equals([CREATE_INSTANCE_OPTION_VALUE]);
        chai.expect(values(getInstanceDropdownOptions([], "edit", "create", "empty"))).deep.equals([OPEN_INSTANCE_OPTION_VALUE, CREATE_INSTANCE_OPTION_VALUE]);
    });

    it("tells the reserved values from instance values", () => {
        for (const value of [CREATE_INSTANCE_OPTION_VALUE, OPEN_INSTANCE_OPTION_VALUE, NO_INSTANCE_OPTION_VALUE])
            chai.expect(isReservedInstanceValue(value), value).equals(true);
        for (const value of ["ns.a", "a", "", "@other@"])
            chai.expect(isReservedInstanceValue(value), value).equals(false);
    });

    it("lists one entry, with the reserved value, when there are no instances and neither entry is offered", () => {
        chai.expect(values(getInstanceDropdownOptions([], undefined, undefined, "empty"))).deep.equals([NO_INSTANCE_OPTION_VALUE]);
    });

    it("never lists the entry saying there are no instances beside an instance or a command entry", () => {
        for (const listed of [instances, []])
            for (const editText of ["edit", undefined])
                for (const createText of ["create", undefined]) {
                    if (!listed.length && editText === undefined && createText === undefined) continue;
                    chai.expect(values(getInstanceDropdownOptions(listed, editText, createText, "empty"))).to.not.include(NO_INSTANCE_OPTION_VALUE);
                }
    });

    it("never changes the list it was given", () => {
        getInstanceDropdownOptions(instances, "edit", "create", "empty");
        chai.expect(instances.length).equals(2);
    });

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

    // an image converter returning `converted:` and the jres image it converts
    class StubImageConverter extends pxt.ImageConverter {
        convert(jresURL: string) {
            return `converted:${jresURL}`;
        }
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

    it("holds the entry saying there are no instances when the type has none and neither entry is offered", () => {
        chai.expect(instanceField({ data: [], getBlocksInfo: () => thingBlocksInfo([]) }).getValue()).equals(NO_INSTANCE_OPTION_VALUE);
    });

    // a `FieldInstanceDropdown` whose dropdown a test can pick an entry of
    class PickableInstanceField extends FieldInstanceDropdown {
        pick(value: string) {
            this.onItemSelected_(undefined, new MenuItem("", value));
        }
    }

    it("keeps the field's value and asks the editor nothing when the entry saying there are no instances is picked", () => {
        let blocksInfo = thingBlocksInfo([instanceSymbol("a", "ns.Thing")]);
        const field = new PickableInstanceField("", { type: "ns.Thing", blocksInfo: undefined, getBlocksInfo: () => blocksInfo });
        chai.expect(field.getValue()).equals("ns.a");
        blocksInfo = thingBlocksInfo([]);
        chai.expect(values(field.getOptions(false))).deep.equals([NO_INSTANCE_OPTION_VALUE]);
        const asked: string[] = [];
        const { createInstance, openInstance } = pxt.react;
        pxt.react.createInstance = typeQName => asked.push(typeQName);
        pxt.react.openInstance = instanceQName => asked.push(instanceQName);
        try {
            field.pick(NO_INSTANCE_OPTION_VALUE);
        } finally {
            pxt.react.createInstance = createInstance;
            pxt.react.openInstance = openInstance;
        }
        chai.expect(field.getValue()).equals("ns.a");
        chai.expect(asked).deep.equals([]);
    });

    it("lists the options captured when the field was built while the live API info is undefined", () => {
        chai.expect(openedValues({ data: [["old", "ns.old"]], getBlocksInfo: () => undefined })).deep.equals(["ns.old"]);
    });

    it("keeps the field's value when the live API info no longer declares it", () => {
        let blocksInfo: pxtc.BlocksInfo | undefined;
        const field = instanceField({ data: [["old", "ns.old"]], getBlocksInfo: () => blocksInfo });
        chai.expect(field.getValue()).equals("ns.old");
        blocksInfo = thingBlocksInfo([instanceSymbol("new", "ns.Thing")]);
        chai.expect(values(field.getOptions(false))).deep.equals(["ns.new"]);
        chai.expect(field.getValue()).equals("ns.old");
    });

    it("builds an instance holding a jres image as an image option named by the instance, its icon converted", () => {
        const jresURL = "data:image/x-mkcd-f4;base64,AAAA";
        const blocksInfo = thingBlocksInfo([instanceSymbol("hero", "ns.Thing", { jresURL } as pxtc.CommentAttrs)]);
        const [option] = getFixedInstanceDropdownOptions(blocksInfo, "ns.Thing", undefined, new StubImageConverter());
        chai.expect(option[1]).equals("ns.hero");
        chai.expect(option[0]).deep.include({ src: `converted:${jresURL}`, alt: "hero", value: "hero" });
    });

    it("lists the default value's instance first", () => {
        const blocksInfo = thingBlocksInfo([
            instanceSymbol("a", "ns.Thing", { weight: 60 } as pxtc.CommentAttrs),
            instanceSymbol("b", "ns.Thing", { weight: 40 } as pxtc.CommentAttrs),
        ]);
        chai.expect(values(getFixedInstanceDropdownOptions(blocksInfo, "ns.Thing", undefined, new StubImageConverter()))).deep.equals(["ns.a", "ns.b"]);
        chai.expect(values(getFixedInstanceDropdownOptions(blocksInfo, "ns.Thing", "ns.b", new StubImageConverter()))).deep.equals(["ns.b", "ns.a"]);
    });

    it("lists the instances of a subtype of the type and no symbol that is not a fixed instance", () => {
        const blocksInfo = thingBlocksInfo([
            typeSymbol("Special", ["ns.Thing"]),
            instanceSymbol("special", "ns.Special"),
            { ...instanceSymbol("plain", "ns.Thing"), attributes: {} as pxtc.CommentAttrs },
        ]);
        chai.expect(values(getFixedInstanceDropdownOptions(blocksInfo, "ns.Thing", undefined, new StubImageConverter()))).deep.equals(["ns.special"]);
    });
});

describe("session-only files", () => {
    it("are the serial editor's file and the simulator extension editor tab markers", () => {
        chai.expect(pxt.isSessionOnlyFile(pxt.SERIAL_EDITOR_FILE)).equals(true);
        chai.expect(pxt.isSessionOnlyFile("someorg~pxt-ext" + pxt.SIMX_EDITOR_MARKER_SUFFIX)).equals(true);
    });

    it("are no other project file, even one whose name merely contains the marker suffix", () => {
        const names = [
            pxt.CONFIG_NAME,
            pxt.MAIN_TS,
            pxt.MAIN_BLOCKS,
            pxt.ASSETS_FILE,
            pxt.SIMSTATE_JSON,
            pxt.README_FILE,
            "serial.txt.bak",
            "notes" + pxt.SIMX_EDITOR_MARKER_SUFFIX + ".md",
            pxt.SIMX_EDITOR_MARKER_SUFFIX.slice(1),
        ];
        chai.expect(names.filter(pxt.isSessionOnlyFile)).deep.equals([]);
    });

    it("are never a nested name ending in the marker suffix", () => {
        const names = ["owner/repo/x" + pxt.SIMX_EDITOR_MARKER_SUFFIX, "a/someorg~pxt-ext" + pxt.SIMX_EDITOR_MARKER_SUFFIX];
        chai.expect(names.filter(pxt.isSessionOnlyFile)).deep.equals([]);
    });
});

describe("simulator extension editor tab open requests", () => {
    it("shows the tab and acknowledges the request", () => {
        const opened: string[] = [];
        chai.expect(answerSimxEditorRequest("someorg/pxt-ext", { type: "simxeditor", subtype: "open", id: "4" }, key => { opened.push(key); return true; }))
            .deep.equals({ type: "simxeditor", id: "4", subtype: "ack" });
        chai.expect(opened).deep.equals(["someorg/pxt-ext"]);
    });

    it("refuses with UNAVAILABLE when the editor offers no such tab here", () => {
        const reply = answerSimxEditorRequest("someorg/pxt-ext", { type: "simxeditor", subtype: "open", id: "4" }, () => false);
        chai.expect(reply).deep.include({ type: "simxeditor", id: "4", subtype: "error", code: "UNAVAILABLE" });
    });

    it("refuses an unknown request with INVALID_REQUEST, showing nothing", () => {
        const reply = answerSimxEditorRequest("someorg/pxt-ext", { type: "simxeditor", subtype: "close", id: 5 }, () => { throw new Error("opened"); });
        chai.expect(reply).deep.include({ type: "simxeditor", id: undefined, subtype: "error", code: "INVALID_REQUEST" });
    });
});

describe("editor toggle layout", () => {
    const EXT = "someorg/pxt-ext";
    const OTHER = "otherorg/pxt-other";

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

    it("lists the offered tabs in the language dropdown after the text languages, under a separator", () => {
        chai.expect(layout({ extensionEditors: [EXT, OTHER] })).deep.equals({
            trigger: { language: "javascript" }, second: undefined, showDropdown: true, dropdownActive: false,
            dropdownLanguages: ["javascript", "python"], dropdownSeparator: true, dropdownExtensions: [EXT, OTHER],
        });
    });

    it("shows the dropdown while a tab is offered on a toggle that shows none, without adding a bar item", () => {
        const peers = layout({ showBlocks: false });
        const withTab = layout({ showBlocks: false, extensionEditors: [EXT] });
        expectLayout(withTab, { showDropdown: true, second: undefined, dropdownLanguages: ["javascript", "python"], dropdownExtensions: [EXT] });
        chai.expect([withTab.trigger, withTab.second].filter(i => !!i).length).lessThan([peers.trigger, peers.second].filter(i => !!i).length);

        const jsOnly = layout({ python: false, showPython: false, extensionEditors: [EXT] });
        expectLayout(jsOnly, { trigger: { language: "javascript" }, showDropdown: true, dropdownLanguages: ["javascript"], dropdownSeparator: true });

        const noText = layout({ showJavaScript: false, showPython: false, extensionEditors: [EXT, OTHER] });
        expectLayout(noText, { trigger: { extension: EXT }, dropdownLanguages: [], dropdownSeparator: false, dropdownExtensions: [EXT, OTHER] });
    });

    it("shows the active tab as the dropdown's trigger, attached to the dropdown", () => {
        expectLayout(layout({ extensionEditors: [EXT, OTHER], activeExtensionEditor: OTHER }), { trigger: { extension: OTHER }, dropdownActive: true });
        expectLayout(layout({ extensionEditors: [EXT], isJavaScriptActive: true }), { trigger: { language: "javascript" }, dropdownActive: true });
    });

    it("keeps showing the tab shown last while Blocks is active, as it keeps showing Python, the language chosen last", () => {
        // Blocks active, the tab shown last: the tab, unattached, with every entry still in the dropdown
        expectLayout(layout({ extensionEditors: [EXT, OTHER], lastExtensionEditor: OTHER }), {
            trigger: { extension: OTHER }, dropdownActive: false,
            dropdownLanguages: ["javascript", "python"], dropdownSeparator: true, dropdownExtensions: [EXT, OTHER],
        });
        // over the Python preference, which the tab shown after it replaces
        expectLayout(layout({ extensionEditors: [EXT], lastExtensionEditor: EXT, pythonIsActive: true }), { trigger: { extension: EXT } });
        // the active tab wins over the tab shown last
        expectLayout(layout({ extensionEditors: [EXT, OTHER], lastExtensionEditor: EXT, activeExtensionEditor: OTHER }), { trigger: { extension: OTHER }, dropdownActive: true });
    });

    it("shows the active text language, or the language preference, over a tab it no longer remembers or offers", () => {
        expectLayout(layout({ extensionEditors: [EXT], lastExtensionEditor: EXT, isJavaScriptActive: true }), { trigger: { language: "javascript" }, dropdownActive: true });
        expectLayout(layout({ extensionEditors: [EXT], lastExtensionEditor: EXT, pythonIsActive: true, isPythonActive: true }), { trigger: { language: "python" }, dropdownActive: true });
        expectLayout(layout({ extensionEditors: [EXT], lastExtensionEditor: undefined, pythonIsActive: true }), { trigger: { language: "python" } });
        expectLayout(layout({ extensionEditors: [EXT], lastExtensionEditor: OTHER }), { trigger: { language: "javascript" } });
        // with no tab offered the toggle is its own, whatever the memory
        chai.expect(layout({ lastExtensionEditor: EXT })).deep.equals(layout());
    });

    it("shows a tab's label as text, after its font icon or its SVG icon, with the label as its accessible name", () => {
        const fontIcon = getSimxEditorMenuItemContent({ key: EXT, label: "Ext", icon: "xicon js" });
        chai.expect(fontIcon).deep.equals({ text: "Ext", ariaLabel: "Ext", icon: "xicon js", iconUrl: undefined });
        const svgIcon = getSimxEditorMenuItemContent({ key: EXT, label: "Ext", iconUrl: "https://sim.example/icon.svg" });
        chai.expect(svgIcon).deep.equals({ text: "Ext", ariaLabel: "Ext", icon: undefined, iconUrl: "https://sim.example/icon.svg" });
        const noIcon = getSimxEditorMenuItemContent({ key: EXT, label: "Ext" });
        chai.expect(noIcon).deep.equals({ text: "Ext", ariaLabel: "Ext", icon: undefined, iconUrl: undefined });
    });

    it("masks an SVG icon's element with the SVG, with and without the -webkit- prefix", () => {
        chai.expect(getSimxEditorIconMaskStyle("https://sim.example/simx/a/-/icon.svg")).deep.equals({
            maskImage: 'url("https://sim.example/simx/a/-/icon.svg")',
            WebkitMaskImage: 'url("https://sim.example/simx/a/-/icon.svg")',
        });
        chai.expect(getSimxEditorIconMaskStyle('https://sim.example/a"b\\c.svg').maskImage).equals('url("https://sim.example/a\\"b\\\\c.svg")');
    });

    it("lists extension tabs only in a view that shows the editor toggle", () => {
        const editorView: SimxEditorTabsShownInput = {
            sandbox: false, readOnly: false, tutorial: false, debugging: false, hideMenuBar: false, blocksOnly: false,
        };
        chai.expect(showsSimxEditorTabs(editorView)).equals(true);
        for (const field of Object.keys(editorView) as (keyof SimxEditorTabsShownInput)[])
            chai.expect(showsSimxEditorTabs({ ...editorView, [field]: true }), field).equals(false);
    });
});

describe("editor toolbar editing controls", () => {
    function controls(extra: Partial<EditorToolbarControlsInput> = {}) {
        return getEditorToolbarControls({
            readOnly: false,
            debugging: false,
            hideZoomAndUndo: false,
            hideToolbox: false,
            editorHasEditingControls: true,
            ...extra,
        });
    }

    it("shows undo, redo and zoom for an editor that has them", () => {
        chai.expect(controls()).deep.equals({ showUndoRedo: true, showZoomControls: true });
    });

    it("leaves out undo, redo and zoom for an editor that has none, whatever else holds", () => {
        const none = { showUndoRedo: false, showZoomControls: false };
        chai.expect(controls({ editorHasEditingControls: false })).deep.equals(none);
        chai.expect(controls({ editorHasEditingControls: false, readOnly: true, debugging: true })).deep.equals(none);
    });

    it("keeps the toolbar's own rules for an editor that has them", () => {
        chai.expect(controls({ readOnly: true })).deep.equals({ showUndoRedo: false, showZoomControls: true });
        chai.expect(controls({ debugging: true })).deep.equals({ showUndoRedo: false, showZoomControls: true });
        chai.expect(controls({ hideZoomAndUndo: true })).deep.equals({ showUndoRedo: false, showZoomControls: false });
        chai.expect(controls({ hideToolbox: true })).deep.equals({ showUndoRedo: false, showZoomControls: false });
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
        // the number of times focus was moved to the element
        focused = 0;
        className = "";
        title = "";
        src = "";
        textContent = "";
        allowFullscreen = false;
        get isConnected() { return !!this.parentElement; }
        setAttribute(name: string, value: string) { this.attributes[name] = value; }
        focus() { this.focused++; }
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
    let started: string[];
    // the tab frames the host has recorded with the driver and not yet forgotten, by key
    let recorded: Map<FakeElement, string>;
    let channels: FakeChannel[];
    // the loaders the host has created, in creation order, each holding the label it was created for
    let loaders: FakeElement[];
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
        started = [];
        recorded = new Map();
        channels = [];
        loaders = [];
        state = "Running";
        let nextPort = 0;
        host = new SimxEditorHost({
            createFrame: () => new FakeElement() as unknown as HTMLIFrameElement,
            createLoader: label => {
                const loader = new FakeElement();
                loader.textContent = label;
                loaders.push(loader);
                return loader as unknown as HTMLElement;
            },
            // as the editor wires it
            framePermissions: grants => pxsim.simulatorFramePermissions(grants),
            startSimulatorExtension: key => {
                started.push(key);
                return simulatorFrames[key] as unknown as HTMLIFrameElement;
            },
            addTabFrame: (key, frame) => recorded.set(frame as unknown as FakeElement, key),
            removeTabFrame: frame => recorded.delete(frame as unknown as FakeElement),
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

        it("delegates the camera to the tab frame of a registration resolved with allowCamera", () => {
            const [resolved] = getSimxEditorRegistrations({
                [EXT]: { editor: { label: "Ext" }, editorUrl: `${ORIGIN}/simx/${EXT}/-/index.html`, allowCamera: true },
            });
            host.show(resolved, container as unknown as HTMLElement, params);
            chai.expect(tab(EXT).attributes).deep.equals({
                sandbox: "allow-same-origin allow-scripts",
                allow: "autoplay;microphone;camera",
            });
        });

        it("applies every grant to the tab frame of a registration resolved with all of them", () => {
            const [resolved] = getSimxEditorRegistrations({
                [EXT]: {
                    editor: { label: "Ext" }, editorUrl: `${ORIGIN}/simx/${EXT}/-/index.html`,
                    allowPopups: true, allowClipboard: true, allowCamera: true, allowMidi: true, allowUsb: true,
                    allowSerial: true, allowBluetooth: true, allowHid: true, allowMotionSensors: true, allowDisplayCapture: true, allowGamepad: true,
                    allowDownloads: true, allowPointerLock: true,
                },
            });
            host.show(resolved, container as unknown as HTMLElement, params);
            chai.expect(tab(EXT).attributes).deep.equals({
                sandbox: "allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock",
                allow: "autoplay;microphone;clipboard-read;clipboard-write;camera;midi;usb;serial;bluetooth;hid;accelerometer;gyroscope;magnetometer;display-capture;gamepad",
            });
        });

        it("starts the simulator frame of its key each time the tab is shown, so a removed one is started again", () => {
            show(EXT);
            loadSimulatorFrame(EXT);
            host.hide();
            simulatorColumn.removeChild(simulatorFrames[EXT]);
            delete simulatorFrames[EXT];
            show(EXT);
            show(OTHER);
            chai.expect(started).deep.equals([EXT, EXT, OTHER]);
        });

        it("records each tab frame with the simulator driver under its key, and forgets it when it is removed", () => {
            show(EXT);
            show(OTHER);
            chai.expect(Array.from(recorded.entries())).deep.equals([[tab(EXT), EXT], [tab(OTHER), OTHER]]);
            host.close();
            chai.expect(recorded.size).equals(0);
        });

        it("keeps one frame per tab, loaded and merely hidden while another editor or tab is shown", () => {
            show(EXT);
            const frame = tab(EXT);
            host.hide();
            chai.expect(frame.parentElement).equals(container);
            chai.expect(frame.style.display).equals("none");
            show(OTHER);
            show(EXT);
            chai.expect(tab(EXT)).equals(frame);
            chai.expect(frame.style.display).equals("");
            chai.expect(tab(OTHER).style.display).equals("none");
            chai.expect(container.children.filter(c => c.dataset["simxkey"]).length).equals(2);
        });

        it("moves focus into the shown tab's frame, and nowhere while no tab is shown", () => {
            show(EXT);
            host.focus();
            chai.expect(tab(EXT).focused).equals(1);
            show(OTHER);
            host.focus();
            chai.expect(tab(OTHER).focused).equals(1);
            chai.expect(tab(EXT).focused).equals(1);
            host.hide();
            host.focus();
            chai.expect(tab(EXT).focused + tab(OTHER).focused).equals(2);
        });

        it("shows the shown tab's loader, which names the tab, beside its frame until the tab is ready", () => {
            show(EXT);
            chai.expect(loaders.length).equals(1);
            const loader = loaders[0];
            chai.expect(loader.parentElement).equals(container);
            chai.expect(loader.textContent).not.equals("");
            chai.expect(loader.style.display).equals("");
            ready(EXT);
            chai.expect(loader.style.display).equals("none");
            show(EXT);
            chai.expect(loaders.length).equals(1);
            chai.expect(loader.style.display).equals("none");
        });

        it("shows only the loader of the shown tab, and only while that tab is not ready", () => {
            show(EXT);
            ready(EXT);
            show(OTHER);
            const [extLoader, otherLoader] = loaders;
            chai.expect([extLoader.style.display, otherLoader.style.display]).deep.equals(["none", ""]);
            show(EXT);
            chai.expect([extLoader.style.display, otherLoader.style.display]).deep.equals(["none", "none"]);
            show(OTHER);
            chai.expect([extLoader.style.display, otherLoader.style.display]).deep.equals(["none", ""]);
            host.hide();
            chai.expect([extLoader.style.display, otherLoader.style.display]).deep.equals(["none", "none"]);
            show(OTHER);
            ready(OTHER);
            chai.expect([extLoader.style.display, otherLoader.style.display]).deep.equals(["none", "none"]);
        });

        it("removes every tab's loader with its frame when its project closes or reloads", () => {
            show(EXT);
            show(OTHER);
            host.close();
            chai.expect(loaders.map(l => l.parentElement)).deep.equals([undefined, undefined]);
            chai.expect(container.children.length).equals(0);
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

    describe("the tab shown last", () => {
        it("is remembered from when the tab is shown, while it is hidden, until another tab is shown", () => {
            chai.expect(host.getLastShownKey()).equals(undefined);
            show(EXT);
            chai.expect(host.getLastShownKey()).equals(EXT);
            host.hide();
            chai.expect(host.getLastShownKey()).equals(EXT);
            show(OTHER);
            host.hide();
            chai.expect(host.getLastShownKey()).equals(OTHER);
        });

        it("is forgotten when the editor shows a text language, until a tab is shown again", () => {
            show(EXT);
            host.hide();
            host.forgetLastShown();
            chai.expect(host.getLastShownKey()).equals(undefined);
            show(EXT);
            chai.expect(host.getLastShownKey()).equals(EXT);
        });

        it("is forgotten when the tab frames are removed", () => {
            show(EXT);
            host.hide();
            host.close();
            chai.expect(host.getLastShownKey()).equals(undefined);

            show(OTHER);
            host.close();
            chai.expect(host.getLastShownKey()).equals(undefined);
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

        it("tells a tab that becomes ready while hidden that it is hidden", () => {
            show(EXT);
            host.hide();
            ready(EXT);
            chai.expect(events(tab(EXT))[0]).deep.equals({ type: "simxeditor", event: "hidden" });
        });

        it("posts every simulator command and state change to every ready tab", () => {
            show(EXT);
            show(OTHER);
            ready(EXT);
            const before = events(tab(EXT)).length;
            host.simulatorCommand("stop");
            host.simulatorStateChanged("Stopped");
            host.simulatorCommand("restart");
            chai.expect(events(tab(EXT)).slice(before)).deep.equals([
                { type: "simxeditor", event: "simulator", command: "stop" },
                { type: "simxeditor", event: "simulatorstate", state: "Stopped" },
                { type: "simxeditor", event: "simulator", command: "restart" },
            ]);
            chai.expect(events(tab(OTHER))).deep.equals([]);
        });

        it("posts every change of fullscreen-simulator mode to every ready tab, and none to a tab not ready", () => {
            show(EXT);
            show(OTHER);
            ready(EXT);
            const before = events(tab(EXT)).length;
            host.fullscreenChanged(true);
            host.fullscreenChanged(true);
            host.fullscreenChanged(false);
            chai.expect(events(tab(EXT)).slice(before)).deep.equals([
                { type: "simxeditor", event: "fullscreen", enabled: true },
                { type: "simxeditor", event: "fullscreen", enabled: false },
            ]);
            chai.expect(events(tab(OTHER))).deep.equals([]);
        });

        it("posts the current fullscreen-simulator mode once after the tab is ready, after the simulator's state", () => {
            host.fullscreenChanged(true);
            show(EXT);
            ready(EXT);
            chai.expect(events(tab(EXT))).deep.equals([
                { type: "simxeditor", event: "shown" },
                { type: "simxeditor", event: "simulatorstate", state: "Running" },
                { type: "simxeditor", event: "fullscreen", enabled: true },
            ]);
        });
    });

    describe("actions", () => {
        const create = (qName: string) => ({ type: "simxeditor", event: "action", action: "create", qName } as const);
        const open = (qName: string) => ({ type: "simxeditor", event: "action", action: "open", qName } as const);

        function actions(frame: FakeElement) {
            return events(frame).filter(e => e.event === "action");
        }

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

        it("posts an action at once to a tab that is ready, once", () => {
            show(EXT);
            ready(EXT);
            host.hide();
            const before = events(tab(EXT)).length;
            host.requestAction(EXT, create("ext.Thing"));
            chai.expect(events(tab(EXT)).slice(before)).deep.equals([create("ext.Thing")]);
            ready(EXT);
            chai.expect(actions(tab(EXT))).deep.equals([create("ext.Thing")]);
        });

        it("holds one action per tab, a later request replacing one not yet posted", () => {
            show(EXT);
            show(OTHER);
            host.requestAction(EXT, create("ext.Thing"));
            host.requestAction(OTHER, create("other.Thing"));
            host.requestAction(EXT, create("ext.Other"));
            ready(EXT);
            ready(OTHER);
            chai.expect(actions(tab(EXT))).deep.equals([create("ext.Other")]);
            chai.expect(actions(tab(OTHER))).deep.equals([create("other.Thing")]);
        });

        it("delivers an open action as it delivers a create action, held until the tab is ready, then at once", () => {
            host.requestAction(EXT, open("ext.thing1"));
            show(EXT);
            chai.expect(actions(tab(EXT))).deep.equals([]);
            ready(EXT);
            chai.expect(actions(tab(EXT))).deep.equals([open("ext.thing1")]);
            host.requestAction(EXT, open("ext.thing2"));
            chai.expect(actions(tab(EXT))).deep.equals([open("ext.thing1"), open("ext.thing2")]);
        });

        it("holds one action per tab whatever its kind, a later open replacing a create not yet posted and the reverse", () => {
            show(EXT);
            show(OTHER);
            host.requestAction(EXT, create("ext.Thing"));
            host.requestAction(EXT, open("ext.thing1"));
            host.requestAction(OTHER, open("other.thing1"));
            host.requestAction(OTHER, create("other.Thing"));
            ready(EXT);
            ready(OTHER);
            chai.expect(actions(tab(EXT))).deep.equals([open("ext.thing1")]);
            chai.expect(actions(tab(OTHER))).deep.equals([create("other.Thing")]);
        });

        it("drops an action not yet posted when the tab frames are removed", () => {
            host.requestAction(EXT, create("ext.Thing"));
            show(EXT);
            host.close();
            host.requestAction(OTHER, create("other.Thing"));
            host.close();
            show(EXT);
            ready(EXT);
            show(OTHER);
            ready(OTHER);
            chai.expect(actions(tab(EXT))).deep.equals([]);
            chai.expect(actions(tab(OTHER))).deep.equals([]);
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

        it("brokers a port pair when the simulator frame loads after the tab became ready", () => {
            show(EXT);
            ready(EXT);
            chai.expect(channels.length).equals(0);
            const simulatorFrame = loadSimulatorFrame(EXT);
            chai.expect(channels.length).equals(1);
            chai.expect(brokered(EXT, simulatorFrame).simulator.map(p => p.transfer)).deep.equals([[channels[0].port1]]);
            chai.expect(brokered(EXT, simulatorFrame).tab.map(p => p.transfer)).deep.equals([[channels[0].port2]]);
        });

        it("brokers a new pair whenever the simulator frame is respawned or reloads", () => {
            show(EXT);
            ready(EXT);
            const first = loadSimulatorFrame(EXT);
            simulatorColumn.removeChild(first);
            const second = loadSimulatorFrame(EXT);
            host.simulatorFrameLoaded(EXT, second as unknown as HTMLIFrameElement);
            chai.expect(channels.length).equals(3);
            chai.expect(ports(first).map(p => p.transfer)).deep.equals([[channels[0].port1]]);
            chai.expect(ports(second).map(p => p.transfer)).deep.equals([[channels[1].port1], [channels[2].port1]]);
            chai.expect(ports(tab(EXT)).map(p => p.transfer)).deep.equals(channels.map(c => [c.port2]));
        });

        it("starts the simulator frame of every tab again after the simulator unloads, and brokers a new pair once it loads", () => {
            show(EXT);
            ready(EXT);
            const first = loadSimulatorFrame(EXT);
            simulatorColumn.removeChild(first);
            delete simulatorFrames[EXT];
            started = [];
            host.ensureSimulatorFrames();
            chai.expect(started).deep.equals([EXT]);
            chai.expect(channels.length).equals(1);
            const second = loadSimulatorFrame(EXT);
            chai.expect(channels.length).equals(2);
            chai.expect(ports(second).map(p => p.transfer)).deep.equals([[channels[1].port1]]);
            chai.expect(ports(tab(EXT)).map(p => p.transfer)).deep.equals([[channels[0].port2], [channels[1].port2]]);
        });

        it("starts no simulator frame after the simulator unloads while no tab exists", () => {
            show(EXT);
            host.close();
            started = [];
            host.ensureSimulatorFrames();
            chai.expect(started).deep.equals([]);
        });

        it("brokers nothing to a simulator frame no longer in the page, nor before the tab is ready", () => {
            const simulatorFrame = loadSimulatorFrame(EXT);
            loadSimulatorFrame(OTHER);
            show(EXT);
            simulatorColumn.removeChild(simulatorFrame);
            ready(EXT);
            show(OTHER);
            chai.expect(channels.length).equals(0);
        });

        it("pairs each tab with the simulator frame of its own key", () => {
            const extFrame = loadSimulatorFrame(EXT);
            const otherFrame = loadSimulatorFrame(OTHER);
            show(EXT);
            show(OTHER);
            ready(OTHER);
            ready(EXT);
            chai.expect(ports(otherFrame).map(p => p.msg.key)).deep.equals([OTHER]);
            chai.expect(ports(extFrame).map(p => p.msg.key)).deep.equals([EXT]);
            chai.expect(ports(tab(OTHER))[0].transfer).deep.equals([channels[0].port2]);
            chai.expect(ports(extFrame)[0].transfer).deep.equals([channels[1].port1]);
        });
    });
});
