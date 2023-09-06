/// <reference path="../../built/pxteditor.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";
import * as dmp from "diff-match-patch";

const differ = new dmp.diff_match_patch();

function diffText(a: string, b: string) {
    return differ.patch_make(a, b);
}

function patchText(patch: unknown, a: string) {
    return differ.patch_apply(patch as any, a)[0]
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

function checkTimestamp(e: pxt.workspace.HistoryEntry, value: number) {
    chai.expect(e.timestamp).to.equal(value);
    chai.expect(e.editorVersion).to.equal(value + "");
}

describe("history", () => {
    it("should create and apply patches", () => {
        let { text, history } = createTestHistory();

        for (let i = 0; history.length > 0; i++) {
            chai.expect(text[filename]).to.equal(versions[versions.length - 1 - i]);
            text = pxt.workspace.applyDiff(text, history.pop(), patchText);
        }

        chai.expect(text[filename]).to.equal(versions[0]);
    });

    it("should collapse entries at a given interval", () => {
        let { text, history } = createTestHistory();

        const collapsed = pxt.workspace.collapseHistory([...history], {...text}, { interval: 250 }, diffText, patchText);

        chai.expect(collapsed.length).to.equal(3);

        for (let i = 0; collapsed.length > 0; i++) {
            const entry = collapsed.pop();
            text = pxt.workspace.applyDiff(text, entry, patchText);
            if (collapsed.length) {
                chai.expect(text[filename]).to.equal(versions[collapsed[collapsed.length - 1].timestamp / 100]);
            }
        }
        chai.expect(text[filename]).to.equal(versions[0]);
    });

    it("should respect a min timestamp when collapsing", () => {
        let { text, history } = createTestHistory();

        const collapsed = pxt.workspace.collapseHistory([...history], {...text}, { interval: 250, minTime: 300 }, diffText, patchText);

        chai.expect(collapsed.length).to.equal(4);
        checkTimestamp(collapsed[0], 100);
        checkTimestamp(collapsed[1], 200);
        checkTimestamp(collapsed[2], 500);
        checkTimestamp(collapsed[3], 800);

        for (let i = 0; collapsed.length > 0; i++) {
            const entry = collapsed.pop();
            text = pxt.workspace.applyDiff(text, entry, patchText);
            if (collapsed.length) {
                chai.expect(text[filename]).to.equal(versions[collapsed[collapsed.length - 1].timestamp / 100]);
            }
        }
        chai.expect(text[filename]).to.equal(versions[0]);
    });

    it("should respect a max timestamp when collapsing", () => {
        let { text, history } = createTestHistory();

        const collapsed = pxt.workspace.collapseHistory([...history], {...text}, { interval: 250, maxTime: 500 }, diffText, patchText);

        chai.expect(collapsed.length).to.equal(5);
        checkTimestamp(collapsed[0], 200);
        checkTimestamp(collapsed[1], 500);
        checkTimestamp(collapsed[2], 600);
        checkTimestamp(collapsed[3], 700);
        checkTimestamp(collapsed[4], 800);

        for (let i = 0; collapsed.length > 0; i++) {
            const entry = collapsed.pop();
            text = pxt.workspace.applyDiff(text, entry, patchText);
            if (collapsed.length) {
                chai.expect(text[filename]).to.equal(versions[collapsed[collapsed.length - 1].timestamp / 100]);
            }
        }
        chai.expect(text[filename]).to.equal(versions[0]);
    });

    it("should respect a min + max timestamp when collapsing", () => {
        let { text, history } = createTestHistory();

        const collapsed = pxt.workspace.collapseHistory([...history], {...text}, { interval: 250, minTime: 400, maxTime: 500 }, diffText, patchText);

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
            text = pxt.workspace.applyDiff(text, entry, patchText);
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

        const history: pxt.workspace.HistoryEntry[] = [];
        history.push(pxt.workspace.diffScriptText(v1, v2, diffText));
        history.push(pxt.workspace.diffScriptText(v2, v3, diffText));

        const res1 = pxt.workspace.applyDiff({...v3}, history.pop(), patchText);
        chai.expect(res1["main.ts"]).to.equal(versions[1]);
        chai.expect(res1["custom.blocks"]).to.equal(versions[2]);

        const res2 = pxt.workspace.applyDiff({...res1}, history.pop(), patchText);
        chai.expect(res2["main.ts"]).to.equal(versions[0]);
        chai.expect(res2["custom.blocks"]).to.equal(undefined);
    });
})

function createTestHistory() {
    const history: pxt.workspace.HistoryEntry[] = [];

    let previous = { [filename]: versions[0] };

    for (let i = 1; i < versions.length; i++) {
        let current = { [filename]: versions[i] };
        history.push(pxt.workspace.diffScriptText(previous, current, diffText));
        history[history.length - 1].timestamp = 100 * i;
        history[history.length - 1].editorVersion = "" + (100 * i);
        previous = {...current};
    }

    return {
        text: previous as pxt.workspace.ScriptText,
        history
    };
}