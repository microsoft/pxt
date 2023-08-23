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
    "Mission accomplished" // 500
];

describe("history", () => {
    it("should create and apply patches", () => {
        let { text, history } = createTestHistory();

        for (let i = 0; i < history.length; i++) {
            chai.expect(text[filename]).to.equal(versions[versions.length - 1 - i]);
            text = pxt.workspace.applyDiff(text, history.pop(), patchText);
        }
    });

    it("should collapse entries", () => {
        let { text, history } = createTestHistory();

        const collapsed = pxt.workspace.collapseHistory(history, text, 250, diffText, patchText);

        chai.expect(collapsed.length).to.equal(2);

        for (let i = 0; i < collapsed.length; i++) {
            text = pxt.workspace.applyDiff(text, collapsed.pop(), patchText);
        }

        chai.expect(text[filename]).to.equal(versions[0]);
    });
})

function createTestHistory() {
    const history: pxt.workspace.HistoryEntry[] = [];

    let previous = { [filename]: versions[0] };

    for (let i = 1; i < versions.length; i++) {
        let current = { [filename]: versions[i] };
        history.push(pxt.workspace.diffScriptText(previous, current, diffText));
        history[history.length - 1].timestamp = 100 * i;
        previous = current;
    }

    return {
        text: previous as pxt.workspace.ScriptText,
        history
    };
}