/// <reference path="../../built/pxtcompiler.d.ts"/>


import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import * as util from "../common/testUtils";

const casesDir = path.join(process.cwd(), "tests", "language-service", "cases");
const testPackage = path.relative(process.cwd(), path.join("tests", "language-service", "test-package"));

interface CompletionTestCase {
    fileName: string;
    fileText: string;
    lineText: string;
    isPython: boolean;
    position: number;
    wordStartPos: number;
    wordEndPos: number;
    expectedSymbols: string[];
    unwantedSymbols: string[];
}

function initGlobals() {
    let g = global as any
    g.pxt = pxt;
    g.ts = ts;
    g.pxtc = pxtc;
    g.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
    g.atob = (str: string) => Buffer.from(str, "base64").toString("binary");
}

initGlobals();
pxt.setAppTarget(util.testAppTarget);

describe("language service", () => {
    const cases = getTestCases();

    for (const testCase of cases) {
        it("get completions " + testCase.fileName + testCase.position, () => {
            return runCompletionTestCaseAsync(testCase);
        });
    }
})

function getTestCases() {
    let filenames: string[] = [];
    for (const file of fs.readdirSync(casesDir)) {
        // ignore hidden files
        if (file[0] == ".") {
            continue;
        }

        // ignore files that start with TODO_; these represent future work
        if (file.indexOf("TODO") >= 0) {
            continue;
        }

        // TODO(pxt-arcade/1887) support python as well
        if (file.substr(-3) !== ".ts") {
            continue;
        }

        const filename = path.join(casesDir, file);

        // if a file is named "ONLY", only run that one file
        // (this is useful for working on a specific test case when
        // the test suite gets large)
        if (file.indexOf("ONLY") >= 0) {
            filenames = [filename]
            break;
        }

        filenames.push(filename);
    };

    const testCases: CompletionTestCase[] = [];

    for (const fileName of filenames) {
        const fileText = fs.readFileSync(fileName, { encoding: "utf8" });
        const isPython = fileName.substr(-3) !== ".ts";

        const lines = fileText.split("\n");
        let position = 0;

        for (const line of lines) {
            const commentString = isPython ? "#" : "//";
            const commentIndex = line.indexOf(commentString);
            if (commentIndex !== -1) {
                const comment = line.substr(commentIndex + commentString.length).trim();
                const symbols = comment.split(";")
                    .map(s => s.trim())
                const expectedSymbols = symbols
                    .filter(s => s.indexOf("!") === -1)
                const unwantedSymbols = symbols
                    .filter(s => s.indexOf("!") !== -1)
                    .map(s => s.replace("!", ""))

                const lineWithoutCommment = line.substring(0, commentIndex);
                const relativeDotPosition = lineWithoutCommment.lastIndexOf(".") + 1 /*monaco is one-indexed*/;
                const dotPosition = position + relativeDotPosition;

                testCases.push({
                    fileName,
                    fileText,
                    lineText: line.substr(0, commentIndex),
                    isPython,
                    expectedSymbols,
                    unwantedSymbols,
                    position: dotPosition,
                    wordStartPos: dotPosition + 1,
                    wordEndPos: dotPosition + 1,
                })
            }

            position += line.length + 1/*new lines*/;
        }
    }

    return testCases;
}

function runCompletionTestCaseAsync(testCase: CompletionTestCase) {
    return getOptionsAsync(testCase.fileText)
        .then(opts => {
            setOptionsOp(opts);
            ensureAPIInfoOp();
            const result = completionsOp(
                "main.ts",
                testCase.position,
                testCase.wordStartPos,
                testCase.wordEndPos,
                testCase.fileText
            );

            if (pxtc.service.IsOpErr(result)) {
                chai.assert(false, `Lang service crashed with:\n${result.errorMessage}`)
                return;
            }

            const symbolExists = (sym: string) => result.entries.some(s => (testCase.isPython ? s.pyQName : s.qName) === sym)
            for (const sym of testCase.expectedSymbols) {
                chai.assert(symbolExists(sym), `Did not receive symbol '${sym}' for '${testCase.lineText}'`);
            }
            for (const sym of testCase.unwantedSymbols) {
                chai.assert(!symbolExists(sym), `Receive explicitly unwanted symbol '${sym}' for '${testCase.lineText}'`);
            }
        })
}

function getOptionsAsync(fileContent: string) {
    const packageFiles: pxt.Map<string> = {};
    packageFiles["main.ts"] = fileContent;

    return util.getTestCompileOptsAsync(packageFiles, testPackage, true);
}

function ensureAPIInfoOp() {
    pxtc.service.performOperation("apiInfo", {});
}

function setOptionsOp(opts: pxtc.CompileOptions) {
    return pxtc.service.performOperation("setOptions", {
        options: opts
    });
}

function completionsOp(fileName: string, position: number, wordStartPos: number, wordEndPos: number, fileContent?: string): pxtc.service.OpError | pxtc.CompletionInfo {
    return pxtc.service.performOperation("getCompletions", {
        fileName,
        fileContent,
        position,
        wordStartPos,
        wordEndPos,
        runtime: pxt.appTarget.runtime
    }) as pxtc.service.OpError | pxtc.CompletionInfo;
}