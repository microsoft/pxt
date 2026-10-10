/// <reference path="../../localtypings/pxteditor.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";
import * as dmp from "diff-match-patch";
import * as pxteditor from "../../pxteditor";
import { getTextAtTime, HistoryFile, parseHistoryFile, updateHistory } from "../../pxteditor/history";
import {
    answerSimxEditorRequest,
    getProjectSimxEditors,
    getSimxEditorKeyOfMarker,
    getSimxEditorMarkerName,
    getSimxEditorRegistrations,
    SimxEditorHost,
    SimxEditorRegistration,
} from "../../webapp/src/simxEditorHost";
import { getEditorToggleLayout, EditorToggleLayoutInput, getSimxEditorMenuItemContent } from "../../webapp/src/editorToggleLayout";
import { hasEditorTab, SimxEditorSimulatorState } from "../../pxtservices/simxeditor";
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
import {
    applyUserEdit,
    getScopedName,
    getScopeUsage,
    getVisibleFiles,
    isValidRelativeName,
    PROJFS_MAX_PENDING_MUTATIONS,
    PROJFS_RATE_LIMIT,
    PROJFS_RATE_WINDOW_MS,
    PROJFS_SCOPE_QUOTA_BYTES,
    ProjfsConfigPackage,
    ProjfsEditor,
    ProjfsHost,
    ProjfsPackage,
    ProjfsPackageFile,
    ProjfsProject,
    setFileListedAsync,
    utf8Length,
    writeProjectFileAsync,
} from "../../webapp/src/projfsHost";
import {
    getProjectId,
    getSimxChannel,
    getTargetId,
    ProjfsClient,
    ProjfsContentReply,
    ProjfsError,
    ProjfsErrorCode,
    ProjfsErrorReply,
    ProjfsFilesReply,
    ProjfsReply,
    ProjfsRequest,
} from "../../pxtservices/projfs";
import {
    createProjassetsConfig,
    getImageAssets,
    getVisualConfig,
    ProjassetsConfig,
    ProjassetsHost,
    ProjassetsOpenProject,
} from "../../webapp/src/projassetsHost";
import {
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

function diffText(a: string, b: string) {
    return pxt.diff.computePatch(a, b);
}

function patchText(patch: unknown, a: string) {
    return pxt.diff.applyPatch(a, patch as any)
}

const filename = "main.ts";

const simulatorTheme: pxt.SimulatorTheme = {
    "background-color": "#111111",
    "button-stroke": "#222222",
    "text-color": "#333333",
    "button-fill": "#444444",
    "dpad-fill": "#555555",
    "joystick-handle-stroke": "#666666",
    layout: "default",
};

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

    it("prepends the scope to relative names", () => {
        chai.expect(getScopedName("owner/repo", "notes.txt")).equals("owner/repo/notes.txt");
        chai.expect(getScopedName("owner/repo", "other/repo/x.ts")).equals("owner/repo/other/repo/x.ts");
        chai.expect(getScopedName("owner/repo", "../x.ts")).equals(undefined);
    });

    it("refuses names under a malformed scope", () => {
        chai.expect(getScopedName("../owner", "x.ts")).equals(undefined);
        chai.expect(getScopedName("", "x.ts")).equals(undefined);
        chai.expect(getScopedName("pxt_modules/owner", "x.ts")).equals(undefined);
    });

    it("measures content in UTF-8 bytes", () => {
        chai.expect(utf8Length("abc")).equals(3);
        chai.expect(utf8Length("\u00e9")).equals(2);
        chai.expect(utf8Length("\u20ac")).equals(3);
        chai.expect(utf8Length("\ud83d\ude00")).equals(4);
    });

    it("makes visible exactly the stored scope files pxt.json lists, by relative name, in listed order", () => {
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
        const scoped = { "owner/repo/a.txt": "" };
        chai.expect(getVisibleFiles({ ...scoped }, "owner/repo")).deep.equals([]);
        chai.expect(getVisibleFiles({ [pxt.CONFIG_NAME]: "{", ...scoped }, "owner/repo")).deep.equals([]);
        chai.expect(getVisibleFiles({ [pxt.CONFIG_NAME]: `{"files":"owner/repo/a.txt"}`, ...scoped }, "owner/repo")).deep.equals([]);
    });

    it("counts every stored file under the scope folder, listed or not", () => {
        const files = {
            [pxt.CONFIG_NAME]: JSON.stringify({ files: ["owner/repo/a.txt"] }),
            "owner/repo/a.txt": "aaa",
            "owner/repo/hand-made.txt": "\u20ac",
            "owner/repo2/b.txt": "bbbbbbbb",
            "owner/b.txt": "bbbbbbbb",
            "main.ts": "bbbbbbbb",
        };
        chai.expect(getScopeUsage(files, "owner/repo")).equals(6);
    });
});

// lets every queued promise reaction run
function settle() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/** A clock for a projfs host, whose delays resolve only as a test advances it. */
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
    const SCOPE = "owner/repo";

    class FakeProject implements ProjfsProject {
        calls: string[] = [];
        failWrites = false;
        failListing = false;
        // when set, each write waits for it before storing
        writeGate: Promise<void> | undefined;

        constructor(public files: pxt.Map<string>) {
        }

        loadedAsync() {
            return Promise.resolve();
        }

        getFiles() {
            return { ...this.files };
        }

        async writeFileAsync(name: string, content: string) {
            if (this.failWrites) throw new Error("disk full");
            await this.writeGate;
            this.calls.push(`write ${name}`);
            this.files[name] = content;
        }

        async deleteFileAsync(name: string) {
            this.calls.push(`delete ${name}`);
            delete this.files[name];
        }

        async setListedAsync(name: string, listed: boolean) {
            if (this.failListing) throw new Error("pxt.json could not be updated");
            this.calls.push(`${listed ? "list" : "unlist"} ${name}`);
            const config = JSON.parse(this.files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
            config.files = listed ? [...config.files, name] : config.files.filter(f => f !== name);
            this.files[pxt.CONFIG_NAME] = JSON.stringify(config);
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
    function post(msg: any, replies: ProjfsReply[], key = SCOPE): Promise<void> {
        return host.handleMessageAsync(key, { type: "projfs", id: "" + nextId++, ...msg }, r => replies.push(r));
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

    async function send(msg: any, key = SCOPE): Promise<ProjfsReply> {
        const replies: ProjfsReply[] = [];
        await host.handleMessageAsync(key, { type: "projfs", id: "" + nextId++, ...msg }, r => replies.push(r));
        chai.expect(replies.length).equals(1);
        return replies[0];
    }

    async function writeMany(count: number, key = SCOPE) {
        for (let i = 0; i < count; i++)
            await send({ subtype: "write", name: `f${i}.txt`, content: "x" }, key);
    }

    async function expectError(msg: any, code: ProjfsErrorCode, key = SCOPE) {
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
        await host.handleMessageAsync(SCOPE, { type: "projfs", id: "abc", subtype: "list" }, r => replies.push(r));
        chai.expect(replies[0].type).equals("projfs");
        chai.expect(replies[0].id).equals("abc");
    });

    it("lists only the scope's listed files, by relative name", async () => {
        const reply = await send({ subtype: "list" }) as ProjfsFilesReply;
        chai.expect(reply.subtype).equals("files");
        chai.expect(reply.files).deep.equals([
            { name: "listed.txt", size: 5 },
        ]);
    });

    it("reads a listed scope file by its relative name", async () => {
        const reply = await send({ subtype: "read", name: "listed.txt" }) as ProjfsContentReply;
        chai.expect(reply).deep.include({ subtype: "content", name: "listed.txt", content: "hello" });
    });

    it("reaches no file outside the scope", async () => {
        for (const name of [pxt.MAIN_TS, pxt.CONFIG_NAME, pxt.SIMSTATE_JSON, "owner/repo/listed.txt"])
            await expectError({ subtype: "read", name }, "NOT_FOUND");
    });

    it("reads main.ts only as a file the extension wrote under that name", async () => {
        await send({ subtype: "write", name: pxt.MAIN_TS, content: "scoped" });
        const reply = await send({ subtype: "read", name: pxt.MAIN_TS }) as ProjfsContentReply;
        chai.expect(reply).deep.include({ subtype: "content", name: pxt.MAIN_TS, content: "scoped" });
        chai.expect(project.files[pxt.MAIN_TS]).equals("let x = 1");
    });

    it("hides a stored scope file pxt.json does not list from list and read", async () => {
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

    it("lists and reads only under the frame's scope, whatever the message names", async () => {
        project = newProject({ [pxt.CONFIG_NAME]: JSON.stringify({ files: ["owner/repo/listed.txt", "other/repo/theirs.txt"] }), "other/repo/theirs.txt": "theirs" });
        const listed = await send({ subtype: "list", channel: "other/repo", scope: "other/repo" }) as ProjfsFilesReply;
        chai.expect(listed.files.map(f => f.name)).deep.equals(["listed.txt"]);
        await expectError({ subtype: "read", name: "theirs.txt", channel: "other/repo", scope: "other/repo" }, "NOT_FOUND");
    });

    it("keeps the scopes of two extensions apart", async () => {
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

    it("writes a new file under the scope and lists it", async () => {
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

    it("lists a stored scope file pxt.json no longer lists when it is written", async () => {
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

    it("stores every write under the frame's scope, whatever the message names", async () => {
        const reply = await send({ subtype: "write", name: "other/repo/x.ts", content: "x", channel: "other/repo", scope: "other/repo" });
        chai.expect(reply).deep.include({ subtype: "ack", name: "other/repo/x.ts" });
        chai.expect(project.files["owner/repo/other/repo/x.ts"]).equals("x");
        chai.expect(Object.keys(project.files).filter(n => n.startsWith("other/"))).deep.equals([]);
    });

    it("only ever changes pxt.json entries under the scope", async () => {
        await send({ subtype: "write", name: "a.txt", content: "a" });
        await send({ subtype: "write", name: "b/c.txt", content: "c" });
        await send({ subtype: "delete", name: "a.txt" });
        await send({ subtype: "delete", name: "listed.txt" });
        const touched = project.calls.map(c => c.split(" ")[1]);
        chai.expect(touched.every(name => name.startsWith(SCOPE + "/"))).equals(true);
        chai.expect(project.listed()).deep.equals([pxt.MAIN_TS, "owner/repo/b/c.txt"]);
    });

    describe("quota", () => {
        const KIB = 1024;

        it("accepts a write that brings the scope to exactly the quota", async () => {
            const content = "x".repeat(PROJFS_SCOPE_QUOTA_BYTES - 5);
            const reply = await send({ subtype: "write", name: "big.txt", content });
            chai.expect(reply.subtype).equals("ack");
        });

        it("refuses a write one byte over the quota, whole", async () => {
            const content = "x".repeat(PROJFS_SCOPE_QUOTA_BYTES - 4);
            const before = { ...project.files };
            const reply = await expectError({ subtype: "write", name: "big.txt", content }, "QUOTA_EXCEEDED");
            chai.expect(reply.message).contains(`${PROJFS_SCOPE_QUOTA_BYTES + 1} bytes`);
            chai.expect(project.calls).deep.equals([]);
            chai.expect(project.files).deep.equals(before);
        });

        it("subtracts the size of the file a write replaces", async () => {
            project = newProject({ "owner/repo/brain.bin": "x".repeat(400 * KIB) });
            const replace = await send({ subtype: "write", name: "brain.bin", content: "y".repeat(500 * KIB) });
            chai.expect(replace.subtype).equals("ack");
            await expectError({ subtype: "write", name: "second.bin", content: "z".repeat(20 * KIB) }, "QUOTA_EXCEEDED");
        });

        it("counts unlisted files in the scope and ignores other folders", async () => {
            project = newProject({
                "owner/repo/hand-made.txt": "x".repeat(300 * KIB),
                "owner/repo2/big.txt": "x".repeat(500 * KIB),
                "main2.ts": "x".repeat(500 * KIB),
            });
            await send({ subtype: "write", name: "ok.txt", content: "x".repeat(200 * KIB) });
            await expectError({ subtype: "write", name: "over.txt", content: "x".repeat(12 * KIB) }, "QUOTA_EXCEEDED");
        });

        it("counts multi-byte characters and data: URIs at their stored length", async () => {
            const euros = "\u20ac".repeat(Math.floor(PROJFS_SCOPE_QUOTA_BYTES / 3));
            await expectError({ subtype: "write", name: "euros.txt", content: euros }, "QUOTA_EXCEEDED");
            const uri = "data:application/octet-stream;base64," + "A".repeat(PROJFS_SCOPE_QUOTA_BYTES);
            await expectError({ subtype: "write", name: "blob.bin", content: uri }, "QUOTA_EXCEEDED");
        });

        it("frees the size of a deleted file", async () => {
            project = newProject({ "owner/repo/brain.bin": "x".repeat(500 * KIB) });
            await expectError({ subtype: "write", name: "second.bin", content: "z".repeat(20 * KIB) }, "QUOTA_EXCEEDED");
            await send({ subtype: "delete", name: "brain.bin" });
            chai.expect((await send({ subtype: "write", name: "second.bin", content: "z".repeat(20 * KIB) })).subtype).equals("ack");
        });
    });

    it("deletes a file and removes it from pxt.json", async () => {
        const reply = await send({ subtype: "delete", name: "listed.txt" });
        chai.expect(reply).deep.include({ subtype: "ack", name: "listed.txt" });
        chai.expect(project.files).not.to.have.property("owner/repo/listed.txt");
        chai.expect(project.listed()).deep.equals([pxt.MAIN_TS]);
    });

    it("deletes a stored scope file pxt.json does not list", async () => {
        project = newProject({ "owner/repo/unlisted.txt": "x" });
        await send({ subtype: "delete", name: "unlisted.txt" });
        chai.expect(project.calls).deep.equals(["delete owner/repo/unlisted.txt"]);
    });

    it("removes a listed scope file that is not stored", async () => {
        project = newProject();
        delete project.files["owner/repo/listed.txt"];
        await send({ subtype: "delete", name: "listed.txt" });
        chai.expect(project.calls).deep.equals(["unlist owner/repo/listed.txt"]);
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

        it("limits each extension separately, so one extension's held writes never hold another's", async () => {
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

        it(`refuses writes and deletes beyond ${PROJFS_MAX_PENDING_MUTATIONS} waiting for replies, applying the waiting ones`, async () => {
            const replies: ProjfsReply[] = [];
            const posted: Promise<void>[] = [];
            for (let i = 0; i < PROJFS_MAX_PENDING_MUTATIONS; i++)
                posted.push(post({ subtype: "write", name: `f${i}.txt`, content: "x" }, replies));
            const refused: ProjfsReply[] = [];
            await post({ subtype: "write", name: "extra.txt", content: "x" }, refused);
            await post({ subtype: "delete", name: "f0.txt" }, refused);
            chai.expect(refused.map(r => (r as ProjfsErrorReply).code)).deep.equals(["RATE_LIMITED", "RATE_LIMITED"]);

            while (replies.length < PROJFS_MAX_PENDING_MUTATIONS)
                await advance(PROJFS_RATE_WINDOW_MS);
            await Promise.all(posted);
            chai.expect(replies.every(r => r.subtype === "ack")).equals(true);
            chai.expect(project.files).not.to.have.property("owner/repo/extra.txt");
            chai.expect(project.files).to.have.property("owner/repo/f0.txt");
            chai.expect((await send({ subtype: "write", name: "later.txt", content: "x" })).subtype).equals("ack");
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
            let release: () => void;
            first.writeGate = new Promise<void>(resolve => release = resolve);
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
            let release: () => void;
            project.writeGate = new Promise<void>(resolve => release = resolve);
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
    });

    it("applies requests one at a time, in order", async () => {
        const replies: ProjfsReply[] = [];
        const collect = (r: ProjfsReply) => replies.push(r);
        host.handleMessageAsync(SCOPE, { type: "projfs", id: "1", subtype: "write", name: "a.txt", content: "first" }, collect);
        host.handleMessageAsync(SCOPE, { type: "projfs", id: "2", subtype: "write", name: "a.txt", content: "second" }, collect);
        await host.handleMessageAsync(SCOPE, { type: "projfs", id: "3", subtype: "read", name: "a.txt" }, collect);
        chai.expect(replies.map(r => r.id)).deep.equals(["1", "2", "3"]);
        chai.expect((replies[2] as ProjfsContentReply).content).equals("second");
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
        await host.handleMessageAsync(SCOPE, "not a request", r => replies.push(r));
        chai.expect((replies[0] as ProjfsErrorReply).code).equals("INVALID_REQUEST");
    });

    describe("dirty", () => {
        it("passes a flagged write through the edit pipeline after saving and listing it", async () => {
            const reply = await send({ subtype: "write", name: "brain.ts", content: "let b = 1", dirty: true });
            chai.expect(reply).deep.include({ subtype: "ack", name: "brain.ts" });
            chai.expect(project.calls).deep.equals(["write owner/repo/brain.ts", "list owner/repo/brain.ts", "dirty owner/repo/brain.ts"]);
            chai.expect(project.dirtied).deep.equals([{ name: "owner/repo/brain.ts", content: "let b = 1", stored: "let b = 1" }]);
        });

        it("passes a flagged replacement through the edit pipeline", async () => {
            await send({ subtype: "write", name: "listed.txt", content: "bye", dirty: true });
            chai.expect(project.calls).deep.equals(["write owner/repo/listed.txt", "dirty owner/repo/listed.txt"]);
        });

        it("passes a flagged delete through the edit pipeline after deleting and unlisting the file", async () => {
            await send({ subtype: "delete", name: "listed.txt", dirty: true });
            chai.expect(project.calls).deep.equals(["delete owner/repo/listed.txt", "unlist owner/repo/listed.txt", "dirty owner/repo/listed.txt"]);
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
            await expectError({ subtype: "write", name: "big.txt", content: "x".repeat(PROJFS_SCOPE_QUOTA_BYTES), dirty: true }, "QUOTA_EXCEEDED");
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
            const collect = (r: ProjfsReply) => replies.push(r);
            host.handleMessageAsync(SCOPE, { type: "projfs", id: "1", subtype: "write", name: "a.ts", content: "1", dirty: true }, collect);
            host.handleMessageAsync(SCOPE, { type: "projfs", id: "2", subtype: "write", name: "b.txt", content: "2" }, collect);
            await host.handleMessageAsync(SCOPE, { type: "projfs", id: "3", subtype: "write", name: "a.ts", content: "3", dirty: true }, collect);
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

        it("applies flagged changes as artifacts where no editor takes user edits", async () => {
            const files: pxt.Map<string> = { [pxt.CONFIG_NAME]: JSON.stringify({ files: [] }) };
            const withoutEditor: ProjfsProject = {
                loadedAsync: () => Promise.resolve(),
                getFiles: () => ({ ...files }),
                writeFileAsync: async (name, content) => { files[name] = content; },
                deleteFileAsync: async name => { delete files[name]; },
                setListedAsync: async () => { },
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
         * does: a new file is saved on its own, while a pxt.json change saves
         * every file the package holds, and fails without a pxt.json.
         */
        function beginLoad(header: string): { finish: () => void, fail: () => void } {
            const read = { ...stored[header] };
            const files: pxt.Map<string> = {};
            const loaded = pxt.Util.defer<void>();
            current = {
                getFiles: () => ({ ...files }),
                writeFileAsync: async (name, content) => {
                    files[name] = content;
                    stored[header][name] = content;
                },
                deleteFileAsync: async name => {
                    delete files[name];
                    stored[header] = { ...files };
                },
                setListedAsync: async (name, listed) => {
                    if (!files[pxt.CONFIG_NAME]) throw new Error("pxt.json could not be updated");
                    const config = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                    config.files = listed ? [...config.files, name] : config.files.filter(f => f !== name);
                    files[pxt.CONFIG_NAME] = JSON.stringify(config);
                    stored[header] = { ...files };
                },
                loadedAsync: () => loaded.promise,
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

        /** The files of a project holding the listed scope files `scoped`, by relative name. */
        function projectFiles(scoped: pxt.Map<string>): pxt.Map<string> {
            const names = Object.keys(scoped).map(name => `${SCOPE}/${name}`);
            const files: pxt.Map<string> = { [pxt.CONFIG_NAME]: JSON.stringify({ name: "test", files: [pxt.MAIN_TS, ...names] }), [pxt.MAIN_TS]: "" };
            Object.keys(scoped).forEach(name => files[`${SCOPE}/${name}`] = scoped[name]);
            return files;
        }

        beforeEach(() => {
            stored = { first: projectFiles({ "brains.ts": "registers a, b" }), second: projectFiles({ "brains.ts": "registers c" }) };
            beginLoad("first").finish();
            host = new ProjfsHost(() => current, clock.now, clock.delay);
        });

        it("answers a list and a read that arrive while the project loads once it has loaded", async () => {
            const load = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const answered = Promise.all([post({ subtype: "list" }, replies), post({ subtype: "read", name: "brains.ts" }, replies)]);
            await settle();
            load.finish();
            await answered;
            chai.expect((replies[0] as ProjfsFilesReply).files).deep.equals([{ name: "brains.ts", size: 14 }]);
            chai.expect((replies[1] as ProjfsContentReply).content).equals("registers a, b");
        });

        it("applies a write that arrives while the project loads once it has loaded, and keeps it", async () => {
            const load = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const answered = post({ subtype: "write", name: "pushed.ts", content: "brain" }, replies);
            await settle();
            load.finish();
            await answered;
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack"]);
            chai.expect(current.getFiles()[`${SCOPE}/pushed.ts`]).equals("brain");
            chai.expect(stored.first[`${SCOPE}/pushed.ts`]).equals("brain");
            chai.expect(((await send({ subtype: "read", name: "pushed.ts" })) as ProjfsContentReply).content).equals("brain");
            chai.expect(((await send({ subtype: "read", name: "brains.ts" })) as ProjfsContentReply).content).equals("registers a, b");
        });

        it("applies a delete that arrives while the project loads once it has loaded", async () => {
            const load = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const answered = post({ subtype: "delete", name: "brains.ts" }, replies);
            await settle();
            load.finish();
            await answered;
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack"]);
            chai.expect(stored.first[`${SCOPE}/brains.ts`]).equals(undefined);
        });

        it("keeps an extension's requests in order across the load", async () => {
            const load = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const written = post({ subtype: "write", name: "brains.ts", content: "registers a, b, d" }, replies);
            await settle();
            load.finish();
            await Promise.all([written, post({ subtype: "read", name: "brains.ts" }, replies)]);
            chai.expect(replies.map(r => r.subtype)).deep.equals(["ack", "content"]);
            chai.expect((replies[1] as ProjfsContentReply).content).equals("registers a, b, d");
        });

        it("refuses with PROJECT_CLOSED a request whose project is replaced while it waits", async () => {
            const replaced = beginLoad("first");
            const replies: ProjfsReply[] = [];
            const answered = post({ subtype: "write", name: "pushed.ts", content: "brain" }, replies);
            await settle();
            const load = beginLoad("second");
            replaced.finish();
            await answered;
            chai.expect((replies[0] as ProjfsErrorReply).code).equals("PROJECT_CLOSED");
            chai.expect(stored.first[`${SCOPE}/pushed.ts`]).equals(undefined);
            load.finish();
            chai.expect(((await send({ subtype: "read", name: "brains.ts" })) as ProjfsContentReply).content).equals("registers c");
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
        openFile: string | undefined = "owner/repo/brain.ts";
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
        applyUserEdit(editor, "owner/repo/brain.ts", "let b = 2");
        chai.expect(editor.calls).deep.equals(["override text let b = 2", "sim dirty", "typecheck"]);
    });

    it("replaces the blocks editor's content when it shows the file", () => {
        editor.active = "blocks";
        editor.openFile = "owner/repo/brain.blocks";
        applyUserEdit(editor, "owner/repo/brain.blocks", "<xml/>");
        chai.expect(editor.calls).deep.equals(["override blocks <xml/>", "sim dirty", "typecheck"]);
    });

    it("leaves the editor's content alone when it shows another file", () => {
        applyUserEdit(editor, "owner/repo/other.ts", "let o = 1");
        chai.expect(editor.calls).deep.equals(["sim dirty", "typecheck"]);
    });

    it("leaves the editor's content alone when neither the text nor the blocks editor is active", () => {
        editor.active = "other";
        applyUserEdit(editor, "owner/repo/brain.ts", "let b = 2");
        chai.expect(editor.calls).deep.equals(["sim dirty", "typecheck"]);
    });

    it("dirties and typechecks after a delete without replacing any content", () => {
        applyUserEdit(editor, "owner/repo/brain.ts", undefined);
        chai.expect(editor.calls).deep.equals(["sim dirty", "typecheck"]);
    });

    it("schedules one typecheck per change, which the editor's debouncer merges", async () => {
        // the editor's typecheckNow triggers an AdaptiveDebouncer, whose firing reruns the simulator
        let typechecks = 0;
        const debouncer = new pxt.Util.AdaptiveDebouncer(() => typechecks++, 300, 50);
        editor.typecheckNow = () => debouncer.trigger();
        const files: pxt.Map<string> = { [pxt.CONFIG_NAME]: JSON.stringify({ files: [] }) };
        const project: ProjfsProject = {
            loadedAsync: () => Promise.resolve(),
            getFiles: () => ({ ...files }),
            writeFileAsync: async (name, content) => { files[name] = content; },
            deleteFileAsync: async name => { delete files[name]; },
            setListedAsync: async () => { },
            markDirty: (name, content) => applyUserEdit(editor, name, content),
        };
        const host = new ProjfsHost(() => project);
        const writes: Promise<void>[] = [];
        for (let i = 0; i < 5; i++)
            writes.push(host.handleMessageAsync("owner/repo", { type: "projfs", id: "" + i, subtype: "write", name: `b${i}.ts`, content: "x", dirty: true }, () => { }));
        await Promise.all(writes);
        chai.expect(editor.calls.filter(c => c === "sim dirty").length).equals(5);
        chai.expect(typechecks).equals(0);
        await new Promise(resolve => setTimeout(resolve, 120));
        chai.expect(typechecks).equals(1);
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
            "owner/repo/brain.ts": new FakeFile("let b = 1"),
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
        await writeProjectFileAsync(epkg, editorShowing("owner/repo/brain.ts"), "owner/repo/brain.ts", "let b = 2");
        chai.expect(epkg.files["owner/repo/brain.ts"].writes).deep.equals([{ content: "let b = 2", force: true }]);
    });

    it("leaves the write of a file the text editor does not show unforced", async () => {
        await writeProjectFileAsync(epkg, editorShowing("owner/repo/other.ts"), "owner/repo/brain.ts", "let b = 2");
        chai.expect(epkg.files["owner/repo/brain.ts"].writes).deep.equals([{ content: "let b = 2", force: false }]);
    });

    it("leaves the write unforced when the blocks editor shows the file", async () => {
        await writeProjectFileAsync(epkg, editorShowing("owner/repo/brain.ts", "blocks"), "owner/repo/brain.ts", "let b = 2");
        chai.expect(epkg.files["owner/repo/brain.ts"].writes).deep.equals([{ content: "let b = 2", force: false }]);
    });

    it("leaves the write unforced when no editor shows the project", async () => {
        await writeProjectFileAsync(epkg, undefined, "owner/repo/brain.ts", "let b = 2");
        chai.expect(epkg.files["owner/repo/brain.ts"].writes).deep.equals([{ content: "let b = 2", force: false }]);
    });

    it("adds and saves a file the package does not store", async () => {
        await writeProjectFileAsync(epkg, editorShowing("owner/repo/brain.ts"), "owner/repo/new.ts", "let n = 1");
        chai.expect(epkg.files["owner/repo/new.ts"].content).equals("let n = 1");
        chai.expect(epkg.saved).deep.equals(["owner/repo/new.ts"]);
    });
});

describe("projfs listing", () => {
    class FakeConfigPackage implements ProjfsConfigPackage {
        constructor(public config: string) {
        }

        updateConfigAsync(update: (config: pxt.PackageConfig) => void): Promise<void> | null {
            // like the editor package: null when pxt.json is malformed or the update throws
            try {
                const config = JSON.parse(this.config) as pxt.PackageConfig;
                update(config);
                this.config = JSON.stringify(config);
                return Promise.resolve();
            } catch (e) {
                return null;
            }
        }
    }

    it("lists a file once", async () => {
        const epkg = new FakeConfigPackage(JSON.stringify({ files: ["main.ts"] }));
        await setFileListedAsync(epkg, "owner/repo/a.txt", true);
        await setFileListedAsync(epkg, "owner/repo/a.txt", true);
        chai.expect(JSON.parse(epkg.config).files).deep.equals(["main.ts", "owner/repo/a.txt"]);
    });

    it("unlists a file from the files and testFiles lists", async () => {
        const epkg = new FakeConfigPackage(JSON.stringify({ files: ["main.ts", "owner/repo/a.txt"], testFiles: ["owner/repo/a.txt", "test.ts"] }));
        await setFileListedAsync(epkg, "owner/repo/a.txt", false);
        chai.expect(JSON.parse(epkg.config)).deep.equals({ files: ["main.ts"], testFiles: ["test.ts"] });
    });

    it("rejects when pxt.json cannot be changed", async () => {
        for (const config of ["not json", JSON.stringify({ name: "no files list" })]) {
            const epkg = new FakeConfigPackage(config);
            const error = await setFileListedAsync(epkg, "owner/repo/a.txt", true).then(() => undefined, e => e);
            chai.expect(error, config).instanceOf(Error);
            chai.expect(epkg.config).equals(config);
        }
    });
});

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

        deliver(source: unknown, data: unknown) {
            this.listeners.forEach(l => l({ source, data } as MessageEvent));
        }
    }

    let parent: FakeParent;
    let self: FakeSelf;
    let client: ProjfsClient;
    let clock: FakeClock;

    function lastRequest() {
        return parent.requests[parent.requests.length - 1];
    }

    function replyTo(request: ProjfsRequest, body: object, source: unknown = parent) {
        self.deliver(source, { type: "projfs", id: request.id, ...body });
    }

    beforeEach(() => {
        parent = new FakeParent();
        self = new FakeSelf();
        clock = new FakeClock();
        client = new ProjfsClient({ target: parent, listener: self });
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

    it("rejects with PERMISSION_DENIED when the extension's registration does not set allowFileWrite", async () => {
        const denied: ProjfsErrorCode = "PERMISSION_DENIED";
        const listed = client.list();
        replyTo(lastRequest(), { subtype: "error", code: denied, message: "not granted" });
        const error = await listed.then(() => undefined, e => e);
        chai.expect(error).instanceOf(ProjfsError);
        chai.expect(error.code).equals(denied);
    });

    it("ignores replies from other windows and to unknown requests", async () => {
        const read = client.read("main.ts");
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "forged" }, {});
        self.deliver(parent, { type: "projfs", id: "unknown", subtype: "content", content: "stray" });
        self.deliver(parent, { type: "other", id: lastRequest().id });
        replyTo(lastRequest(), { subtype: "content", name: "main.ts", content: "real" });
        chai.expect(await read).equals("real");
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

    it("reads the open project's id from the frame URL", () => {
        chai.expect(getProjectId("?parentOrigin=http%3A%2F%2Flocalhost%3A3232&channel=owner%2Frepo&target=arcade&project=3b1f7c2e-project")).equals("3b1f7c2e-project");
        chai.expect(getProjectId("?channel=owner%2Frepo&target=arcade")).equals(undefined);
        chai.expect(getProjectId("?project=")).equals(undefined);
    });

    it("keeps waiting for a reply however late it comes, and resolves with it", async () => {
        client.dispose();
        client = new ProjfsClient({ target: parent, listener: self, slowReplyMs: 5 });
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
        client = new ProjfsClient({ target: parent, listener: self, slowReplyMs: 5, onSlowReply: r => slow.push(r) });
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

    /** Connects the client to a host serving `owner/repo`; returns the project's stored files. */
    function connectToHost(): pxt.Map<string> {
        const files: pxt.Map<string> = {
            [pxt.CONFIG_NAME]: JSON.stringify({ files: [pxt.MAIN_TS] }),
            [pxt.MAIN_TS]: "",
        };
        const project: ProjfsProject = {
            loadedAsync: () => Promise.resolve(),
            getFiles: () => ({ ...files }),
            writeFileAsync: async (name, content) => { files[name] = content; },
            deleteFileAsync: async name => { delete files[name]; },
            setListedAsync: async (name, listed) => {
                const config = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                config.files = listed ? [...config.files, name] : config.files.filter(f => f !== name);
                files[pxt.CONFIG_NAME] = JSON.stringify(config);
            },
        };
        const host = new ProjfsHost(() => project, clock.now, clock.delay);
        // the editor posts each reply back to the frame's window
        parent.postMessage = (msg: ProjfsRequest) => {
            host.handleMessageAsync("owner/repo", msg, reply => self.deliver(parent, reply));
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
            { name: "notes.txt", size: utf8Length(text) },
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

    it("names every asset kind by its pxt.AssetType value", () => {
        // one entry per kind: a kind added without an entry fails to compile
        const assetTypes: { [K in ProjassetsKind]: pxt.AssetType } = {
            image: pxt.AssetType.Image,
        };
        for (const kind of Object.keys(assetTypes) as ProjassetsKind[])
            chai.expect(assetTypes[kind] as string, kind).equals(kind);
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

describe("projassets host", () => {
    const SCOPE = "owner/repo";

    withTargetVisuals(TARGET_PALETTE, THEME_PRESETS);

    let project: pxt.TilemapProject | undefined;
    let configFiles: pxt.Map<string>;
    let mainPkg: pxt.MainPackage;
    let config: ProjassetsConfig;
    let open: ProjassetsOpenProject | undefined;
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
        config = createProjassetsConfig(mainPkg, () => ACCOUNT_THEME);
        open = loadedProject();
        host = new ProjassetsHost(() => open, () => project, () => config);
        nextId = 0;
    });

    /** Replaces the project's pxt.json with one holding `extra`, and loads it as the editor does after a config edit. */
    function editConfig(extra: object) {
        configFiles[pxt.CONFIG_NAME] = testPxtJson(extra);
        mainPkg.loadConfig(true);
    }

    // sends a request whose replies, and notifications if it subscribes, land in `received`
    function post(msg: any, received: (ProjassetsReply | ProjassetsNotification)[], key = SCOPE): Promise<void> {
        return host.handleMessageAsync(key, { type: "projassets", id: "" + nextId++, ...msg }, r => received.push(r));
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

    /** Subscribes `key` and returns what it receives from then on, the subscription's ack first. */
    async function subscribe(key = SCOPE): Promise<(ProjassetsReply | ProjassetsNotification)[]> {
        const received: (ProjassetsReply | ProjassetsNotification)[] = [];
        await post({ subtype: "subscribe" }, received, key);
        chai.expect(received.map(r => r.subtype)).deep.equals(["ack"]);
        received.length = 0;
        return received;
    }

    const CHANGED = { type: "projassets", subtype: "changed" };

    it("replies with the request's id", async () => {
        const received: (ProjassetsReply | ProjassetsNotification)[] = [];
        await host.handleMessageAsync(SCOPE, { type: "projassets", id: "abc", subtype: "list", kind: "image" }, r => received.push(r));
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
        for (const kind of ["tile", "tilemap", "animation", "song", "json", "toString", "__proto__"])
            await expectError({ subtype: "list", kind }, "UNSUPPORTED_KIND");
    });

    it("refuses malformed requests with INVALID_REQUEST", async () => {
        await expectError({ subtype: "list" }, "INVALID_REQUEST");
        await expectError({ subtype: "list", kind: 7 }, "INVALID_REQUEST");
        await expectError({ subtype: "write", kind: "image" }, "INVALID_REQUEST");
        for (const msg of ["not a request", null]) {
            const received: (ProjassetsReply | ProjassetsNotification)[] = [];
            await host.handleMessageAsync(SCOPE, msg, r => received.push(r));
            chai.expect(received.map(r => (r as ProjassetsErrorReply).code)).deep.equals(["INVALID_REQUEST"]);
        }
    });

    it("refuses requests that arrive when no project is open with PROJECT_CLOSED", async () => {
        open = undefined;
        await expectError({ subtype: "list", kind: "image" }, "PROJECT_CLOSED");
        await expectError({ subtype: "subscribe" }, "PROJECT_CLOSED");
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
            await settle();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it("notifies once the change has applied", async () => {
            const seen: string[][] = [];
            await host.handleMessageAsync(SCOPE, { type: "projassets", id: "s", subtype: "subscribe" }, r => {
                if (r.subtype === "changed") seen.push(getImageAssets(project).map(i => i.displayName));
            });
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await settle();
            chai.expect(seen).deep.equals([["hero", "villain"]]);
        });

        it("notifies of undo and redo", async () => {
            const received = await subscribe();
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            project.pushUndo();
            await settle();
            received.length = 0;
            project.undo();
            await settle();
            chai.expect(received).deep.equals([CHANGED]);
            project.redo();
            await settle();
            chai.expect(received).deep.equals([CHANGED, CHANGED]);
        });

        it("notifies each subscribed extension, and no other", async () => {
            const first = await subscribe("owner/repo");
            const second = await subscribe("other/repo");
            const unsubscribed: (ProjassetsReply | ProjassetsNotification)[] = [];
            await post({ subtype: "list", kind: "image" }, unsubscribed, "third/repo");
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await settle();
            chai.expect(first).deep.equals([CHANGED]);
            chai.expect(second).deep.equals([CHANGED]);
            chai.expect(unsubscribed.map(r => r.subtype)).deep.equals(["assets"]);
        });

        it("notifies once after the project's palette changes", async () => {
            const received = await subscribe();
            editConfig({ palette: PROJECT_PALETTE });
            chai.expect(received).deep.equals([]);
            await settle();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it("notifies once after the project's simulator theme changes, in either declaration form", async () => {
            const received = await subscribe();
            editConfig({ theme: "purple" });
            await settle();
            chai.expect(received).deep.equals([CHANGED]);
            editConfig({ theme: { "dpad-fill": "#0a0b0c" } });
            await settle();
            chai.expect(received).deep.equals([CHANGED, CHANGED]);
        });

        it("notifies once after the project is renamed", async () => {
            const received = await subscribe();
            editConfig({ name: "renamed" });
            chai.expect(received).deep.equals([]);
            await settle();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it("sends no notification for a config change that leaves the name, palette and theme as they were", async () => {
            const received = await subscribe();
            editConfig({ description: "a new description" });
            editConfig({ description: "a new description", palette: TARGET_PALETTE.slice() });
            await settle();
            chai.expect(received).deep.equals([]);
            editConfig({ palette: PROJECT_PALETTE });
            await settle();
            received.length = 0;
            editConfig({ palette: PROJECT_PALETTE, description: "another description" });
            await settle();
            chai.expect(received).deep.equals([]);
        });

        it("notifies once for asset and palette changes made together", async () => {
            const received = await subscribe();
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            editConfig({ palette: PROJECT_PALETTE });
            await settle();
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
            config = createProjassetsConfig(mainPkg, () => ACCOUNT_THEME);
            firstFiles[pxt.CONFIG_NAME] = testPxtJson({ palette: PROJECT_PALETTE });
            firstPkg.loadConfig(true);
            await settle();
            chai.expect(received).deep.equals([]);
            editConfig({ palette: PROJECT_PALETTE });
            await settle();
            chai.expect(received).deep.equals([]);
        });

        it("sends no notification when nothing changes", async () => {
            const received = await subscribe();
            await send({ subtype: "list", kind: "image" });
            await settle();
            chai.expect(received).deep.equals([]);
        });

        it("notifies a frame once however often it subscribes", async () => {
            const received: (ProjassetsReply | ProjassetsNotification)[] = [];
            const reply = (r: ProjassetsReply | ProjassetsNotification) => received.push(r);
            await host.handleMessageAsync(SCOPE, { type: "projassets", id: "s1", subtype: "subscribe" }, reply);
            await host.handleMessageAsync(SCOPE, { type: "projassets", id: "s2", subtype: "subscribe" }, reply);
            received.length = 0;
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await settle();
            chai.expect(received).deep.equals([CHANGED]);
        });

        it("notifies each subscribed frame of one extension", async () => {
            const simulatorFrame = await subscribe();
            const tabFrame = await subscribe();
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await settle();
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
            await settle();
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
            await settle();
            chai.expect(current).deep.equals([]);
            project.createNewProjectImage(testBitmap(2, 2), "villain");
            await settle();
            chai.expect(old).deep.equals([]);
            chai.expect(current).deep.equals([CHANGED]);
        });

        it("stops listening to a project once it has closed and changed", async () => {
            const first = project;
            const listeners = trackListeners(first);
            await subscribe();
            open = undefined;
            first.createNewProjectImage(testBitmap(2, 2), "late");
            await settle();
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
            const add = tracked.addConfigLoadListener;
            const remove = tracked.removeConfigLoadListener;
            tracked.addConfigLoadListener = l => { listeners.add(l); add(l); };
            tracked.removeConfigLoadListener = l => { listeners.delete(l); remove(l); };
            return listeners;
        }

        it("listens to a project's config once while subscribed, and stops once the project has closed", async () => {
            const listeners = trackConfigListeners(config);
            await subscribe("owner/repo");
            await subscribe("other/repo");
            chai.expect(listeners.size).equals(1);
            open = undefined;
            editConfig({ palette: PROJECT_PALETTE });
            await settle();
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
                await settle();
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
            await reloadHost.handleMessageAsync(SCOPE, { type: "projassets", id: "" + nextId++, ...msg }, r => received.push(r));
            chai.expect(received.length).equals(1);
            return received[0] as ProjassetsReply;
        }

        beforeEach(async () => {
            stored = { first: projectFiles(["hero", "villain"]), second: projectFiles(["ghost"]) };
            beginLoad("first").finish();
            reloadHost = new ProjassetsHost(
                () => current,
                getTilemapProject,
                () => createProjassetsConfig(current.mainPkg, () => ACCOUNT_THEME));
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
            await settle();
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
            const subscribed = reloadHost.handleMessageAsync(SCOPE, { type: "projassets", id: "s", subtype: "subscribe" }, r => received.push(r));
            await settle();
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
            await settle();
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
            await settle();
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

        deliver(source: unknown, data: unknown) {
            this.listeners.forEach(l => l({ source, data } as MessageEvent));
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

    function replyTo(request: ProjassetsRequest, body: object, source: unknown = parent) {
        self.deliver(source, { type: "projassets", id: request.id, ...body });
    }

    beforeEach(() => {
        parent = new FakeParent();
        self = new FakeSelf();
        client = new ProjassetsClient({ target: parent, listener: self });
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
        client = new ProjassetsClient({ target: parent, listener: self, slowReplyMs: 5, onSlowReply: r => slow.push(r) });
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

    describe("through the host", () => {
        withTargetVisuals(TARGET_PALETTE, THEME_PRESETS);

        it("lists a project's images, name and visual configuration, and hears their changes", async () => {
            const project = new pxt.TilemapProject();
            const bitmap = testBitmap(3, 2);
            const image = project.createNewProjectImage(bitmap, "hero");
            const files = { [pxt.CONFIG_NAME]: testPxtJson() };
            const mainPkg = testMainPackage(files);
            const open: ProjassetsOpenProject = { loadedAsync: () => Promise.resolve() };
            const host = new ProjassetsHost(() => open, () => project, () => createProjassetsConfig(mainPkg, () => ACCOUNT_THEME));
            // the editor posts each reply and notification back to the frame's window
            parent.postMessage = (msg: ProjassetsRequest) => {
                host.handleMessageAsync("owner/repo", msg, reply => self.deliver(parent, reply));
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
            await settle();
            chai.expect(changes).equals(1);
            chai.expect((await client.list("image")).assets.map(i => [i.width, i.height, i.data]))
                .deep.equals([[5, 5, pxt.sprite.base64EncodeBitmap(edited)]]);
            files[pxt.CONFIG_NAME] = testPxtJson({ palette: PROJECT_PALETTE });
            mainPkg.loadConfig(true);
            await settle();
            chai.expect(changes).equals(2);
            chai.expect((await client.list("image")).palette).deep.equals(PROJECT_PALETTE);
            files[pxt.CONFIG_NAME] = testPxtJson({ palette: PROJECT_PALETTE, name: "renamed" });
            mainPkg.loadConfig(true);
            await settle();
            chai.expect(changes).equals(3);
            chai.expect((await client.list("image")).name).equals("renamed");
        });
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

console.log((JSON.parse(testProject[pxt.HISTORY_FILE]) as HistoryFile).entries.map(e => new Date(e.timestamp).toLocaleString()).join("\n"));


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
describe("simulator extension editor tab registrations", () => {
    const EXT = "someorg/pxt-ext";
    const OTHER = "otherorg/pxt-other";

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
            [EXT]: resolved(EXT, { wordmarkUrl: "https://sim.example/mark.svg", allowClipboardWrite: true }),
        });
        chai.expect(registrations.map(r => r.key)).deep.equals([OTHER, EXT]);
        chai.expect(registrations[0]).deep.include({ url: `https://sim.example/simx/${OTHER}/-/index.html`, allowPopups: true, wordmarkUrl: undefined });
        chai.expect(registrations[1]).deep.include({ wordmarkUrl: "https://sim.example/mark.svg", allowClipboardWrite: true });
        chai.expect(getSimxEditorRegistrations(undefined)).deep.equals([]);
    });

    it("offers a project the tabs of the extensions it includes, matching the repository in any case and at any depth", () => {
        const registrations = getSimxEditorRegistrations({ [EXT]: resolved(EXT), [OTHER]: resolved(OTHER) });
        const keys = (deps: string[]) => getProjectSimxEditors(registrations, deps).map(r => r.key);
        chai.expect(keys(["*", "github:SomeOrg/PXT-Ext/makecode/extensions/arcade#v1.0.0"])).deep.equals([EXT]);
        chai.expect(keys(["github:otherorg/pxt-other#abc", "github:someorg/pxt-ext"])).deep.equals([EXT, OTHER]);
        chai.expect(keys(["*", "file:../pxt-ext", "github:someorg/pxt-extended"])).deep.equals([]);
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

    it("shows a tab's wordmark in place of its label and icon, keeping the label as its accessible name", () => {
        const wordmark = getSimxEditorMenuItemContent({ key: EXT, label: "Ext", icon: "puzzle", wordmarkUrl: "https://sim.example/mark.svg" });
        chai.expect(wordmark).deep.equals({ text: "Ext", ariaLabel: "Ext", icon: undefined, image: "https://sim.example/mark.svg" });
        const label = getSimxEditorMenuItemContent({ key: EXT, label: "Ext", icon: "puzzle" });
        chai.expect(label).deep.equals({ text: "Ext", ariaLabel: "Ext", icon: "puzzle", image: undefined });
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

    // the parts of an element the host touches
    class FakeElement {
        style: pxt.Map<string> = {};
        dataset: pxt.Map<string> = {};
        attributes: pxt.Map<string> = {};
        children: FakeElement[] = [];
        parentElement: FakeElement | undefined;
        contentWindow = new FakeWindow();
        // the number of times focus was moved to the element
        focused = 0;
        className = "";
        title = "";
        src = "";
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
        return frame.contentWindow.posted.filter(p => p.msg.type === "simxeditor").map(p => p.msg);
    }

    function ports(frame: FakeElement) {
        return frame.contentWindow.posted.filter(p => p.msg.type === "simxeditorport");
    }

    beforeEach(() => {
        container = new FakeElement();
        simulatorColumn = new FakeElement();
        simulatorFrames = {};
        started = [];
        channels = [];
        state = "Running";
        let nextPort = 0;
        host = new SimxEditorHost({
            createFrame: () => new FakeElement() as unknown as HTMLIFrameElement,
            createLoader: () => new FakeElement() as unknown as HTMLElement,
            framePermissions: grants => ({
                sandbox: "allow-same-origin allow-scripts" + (grants.allowPopups ? " allow-popups allow-popups-to-escape-sandbox" : ""),
                allow: "autoplay;microphone" + (grants.allowClipboardWrite ? ";clipboard-write" : ""),
            }),
            startSimulatorExtension: key => {
                started.push(key);
                return simulatorFrames[key] as unknown as HTMLIFrameElement;
            },
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
            show(EXT, { allowPopups: true, allowClipboardWrite: true });
            const frame = tab(EXT);
            const url = new URL(frame.src);
            chai.expect(url.origin + url.pathname).equals(`${ORIGIN}/simx/${EXT}/-/index.html`);
            const query: pxt.Map<string> = {};
            url.searchParams.forEach((value, name) => query[name] = value);
            chai.expect(query).deep.equals({
                parentOrigin: "https://editor.example", channel: EXT, role: "editor", target: "arcade", project: "p1", language: "en",
            });
            chai.expect(frame.attributes).deep.equals({
                sandbox: "allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox",
                allow: "autoplay;microphone;clipboard-write",
            });
            chai.expect(frame.allowFullscreen).equals(true);
            chai.expect(frame.dataset).deep.equals({ simxkey: EXT, simxrole: "editor", origin: ORIGIN });
            chai.expect(frame.parentElement).equals(container);
        });

        it("starts the simulator frame of its key when it creates the tab frame, and only then", () => {
            show(EXT);
            host.hide();
            show(EXT);
            chai.expect(started).deep.equals([EXT]);
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

        it("shows the loading state over the shown tab until it is ready", () => {
            show(EXT);
            const loader = container.children.find(c => !c.dataset["simxkey"]);
            chai.expect(loader.style.display).equals("");
            ready(EXT);
            chai.expect(loader.style.display).equals("none");
            show(OTHER);
            chai.expect(loader.style.display).equals("");
            host.hide();
            chai.expect(loader.style.display).equals("none");
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

        it("removes the tab frames of other projects, and every one when the project closes, after posting closing", () => {
            show(EXT);
            ready(EXT);
            const frame = tab(EXT);
            host.close("p1");
            chai.expect(tab(EXT)).equals(frame);
            host.close("p2");
            chai.expect(tab(EXT)).equals(undefined);
            chai.expect(frame.parentElement).equals(undefined);
            chai.expect(events(frame).slice(-1)).deep.equals([{ type: "simxeditor", event: "closing" }]);

            show(OTHER);
            const other = tab(OTHER);
            host.close();
            chai.expect(other.parentElement).equals(undefined);
            chai.expect(events(other)).deep.equals([]);
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
