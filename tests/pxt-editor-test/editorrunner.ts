/// <reference path="../../localtypings/pxteditor.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";
import * as dmp from "diff-match-patch";
import * as pxteditor from "../../pxteditor";
import { getTextAtTime, HistoryFile, parseHistoryFile, updateHistory } from "../../pxteditor/history";
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
} from "../../react-common/components/theming/simulatorThemeDefaults";

pxt.appTarget = {
    versions: {
        target: "1"
    },
    appTheme: {
        defaultLocale: "en"
    }
} as any

const differ = new dmp.diff_match_patch();

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