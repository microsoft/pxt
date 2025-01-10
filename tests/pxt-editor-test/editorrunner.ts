/// <reference path="../../localtypings/pxteditor.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";
import * as dmp from "diff-match-patch";
import * as pxteditor from "../../pxteditor";
import { getTextAtTime, HistoryFile, updateHistory } from "../../pxteditor/history";

pxt.appTarget = {
    versions: {
        target: "1"
    }
} as any

// const differ = new dmp.diff_match_patch();

function diffText(a: string, b: string) {
    return pxt.diff.computePatch(a, b);
}

function patchText(patch: unknown, a: string) {
    return pxt.diff.applyPatch(a, patch as any)
}

const filename = "main.ts";

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
    chai.expect(e.editorVersion).to.equal(value + "");
}

describe("history", () => {
    it("should create and apply patches", () => {
        let { text, history } = createTestHistory();

        for (let i = 0; history.length > 0; i++) {
            chai.expect(text[filename]).to.equal(versions[versions.length - 1 - i]);
            text = pxteditor.history.applyDiff(text, history.pop(), patchText);
        }

        chai.expect(text[filename]).to.equal(versions[0]);
    });

    it("should collapse entries at a given interval", () => {
        let { text, history } = createTestHistory();

        const collapsed = pxteditor.history.collapseHistory([...history], {...text}, { interval: 250 }, diffText, patchText);

        chai.expect(collapsed.length).to.equal(3);

        for (let i = 0; collapsed.length > 0; i++) {
            const entry = collapsed.pop();
            text = pxteditor.history.applyDiff(text, entry, patchText);
            if (collapsed.length) {
                chai.expect(text[filename]).to.equal(versions[collapsed[collapsed.length - 1].timestamp / 100]);
            }
        }
        chai.expect(text[filename]).to.equal(versions[0]);
    });

    it("should respect a min timestamp when collapsing", () => {
        let { text, history } = createTestHistory();

        const collapsed = pxteditor.history.collapseHistory([...history], {...text}, { interval: 250, minTime: 300 }, diffText, patchText);

        chai.expect(collapsed.length).to.equal(4);
        checkTimestamp(collapsed[0], 100);
        checkTimestamp(collapsed[1], 200);
        checkTimestamp(collapsed[2], 500);
        checkTimestamp(collapsed[3], 800);

        for (let i = 0; collapsed.length > 0; i++) {
            const entry = collapsed.pop();
            text = pxteditor.history.applyDiff(text, entry, patchText);
            if (collapsed.length) {
                chai.expect(text[filename]).to.equal(versions[collapsed[collapsed.length - 1].timestamp / 100]);
            }
        }
        chai.expect(text[filename]).to.equal(versions[0]);
    });

    it("should respect a max timestamp when collapsing", () => {
        let { text, history } = createTestHistory();

        const collapsed = pxteditor.history.collapseHistory([...history], {...text}, { interval: 250, maxTime: 500 }, diffText, patchText);

        chai.expect(collapsed.length).to.equal(5);
        checkTimestamp(collapsed[0], 200);
        checkTimestamp(collapsed[1], 500);
        checkTimestamp(collapsed[2], 600);
        checkTimestamp(collapsed[3], 700);
        checkTimestamp(collapsed[4], 800);

        for (let i = 0; collapsed.length > 0; i++) {
            const entry = collapsed.pop();
            text = pxteditor.history.applyDiff(text, entry, patchText);
            if (collapsed.length) {
                chai.expect(text[filename]).to.equal(versions[collapsed[collapsed.length - 1].timestamp / 100]);
            }
        }
        chai.expect(text[filename]).to.equal(versions[0]);
    });

    it("should respect a min + max timestamp when collapsing", () => {
        let { text, history } = createTestHistory();

        const collapsed = pxteditor.history.collapseHistory([...history], {...text}, { interval: 250, minTime: 400, maxTime: 500 }, diffText, patchText);

        chai.expect(collapsed.length).to.equal(7);
        checkTimestamp(collapsed[0], 100);
        checkTimestamp(collapsed[1], 200);
        checkTimestamp(collapsed[2], 300);
        checkTimestamp(collapsed[3], 500);
        checkTimestamp(collapsed[4], 600);
        checkTimestamp(collapsed[5], 700);
        checkTimestamp(collapsed[6], 800);

        for (let i = 0; collapsed.length > 0; i++) {
            const entry = collapsed.pop();
            text = pxteditor.history.applyDiff(text, entry, patchText);
            if (collapsed.length) {
                chai.expect(text[filename]).to.equal(versions[collapsed[collapsed.length - 1].timestamp / 100]);
            }
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
    const history: pxteditor.history.HistoryEntry[] = [];

    let previous = { [filename]: versions[0] };

    for (let i = 1; i < versions.length; i++) {
        let current = { [filename]: versions[i] };
        history.push(pxteditor.history.diffScriptText(previous, current, Date.now(), diffText));
        history[history.length - 1].timestamp = 100 * i;
        history[history.length - 1].editorVersion = "" + (100 * i);
        previous = {...current};
    }

    return {
        text: previous as pxt.workspace.ScriptText,
        history
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

    it("should restore to the version on the timestamp", () => {
        const project = createProjectText();
        const history = JSON.parse(project[pxt.HISTORY_FILE]) as HistoryFile;

        for (const entry of history.entries) {
            const { files } = getTextAtTime(project, history, entry.timestamp, patchText);

            chai.expect(files[pxt.MAIN_TS]).equals(entry.timestamp.toString());
        }
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
        new Date(2024, 8, 13, 8, 0, 0, 0),
        new Date(2024, 8, 13, 8, 15, 0, 0),
        new Date(2024, 8, 13, 8, 17, 0, 0),
        new Date(2024, 8, 13, 8, 23, 0, 0),
        new Date(2024, 8, 13, 8, 24, 0, 0),
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