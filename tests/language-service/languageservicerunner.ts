/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import * as util from "../common/testUtils";

const completionCasesDir = path.join(process.cwd(), "tests", "language-service", "completion_cases");
const snippetCasesDir = path.join(process.cwd(), "tests", "language-service", "snippet_cases");
const testPackage = path.relative(process.cwd(), path.join("tests", "language-service", "test-package"));

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

enum FileCheck {
    Keep,
    Only,
    Skip
}

function checkTestFile(file: string): FileCheck {
    // ignore hidden files
    if (file[0] == ".") {
        return FileCheck.Skip
    }

    // ignore files that start with TODO_; these represent future work
    if (file.indexOf("TODO") >= 0) {
        console.log("Skipping test file marked as 'TODO': " + file);
        return FileCheck.Skip
    }

    const ext = file.substr(-3)
    if (ext !== ".ts" && ext !== ".py") {
        console.error("Skipping unknown/unsupported file in test folder: " + file);
        return FileCheck.Skip
    }

    // if a file is named "ONLY", only run that one file
    // (this is useful for working on a specific test case when
    // the test suite gets large)
    if (file.indexOf("ONLY") >= 0) {
        return FileCheck.Only
    }

    return FileCheck.Keep
}
function getTestCaseFilenames(dir: string) {
    let files = fs.readdirSync(dir)
        .map(f => [checkTestFile(f), path.join(dir, f)] as [FileCheck, string])
        .filter(([c, _]) => c !== FileCheck.Skip)
    if (files.some(([c, _]) => c === FileCheck.Only))
        files = files.filter(([c, _]) => c === FileCheck.Only)
    return files.map(([_, f]) => f)
}

interface LangServTestCase {
    fileName: string;
    isPython: boolean;
}

interface SnippetTestCase extends LangServTestCase {
    qName: string;
    expectedSnippet: string;
}

interface CompletionTestCase extends LangServTestCase {
    fileText: string;
    lineText: string;
    position: number;
    wordStartPos: number;
    wordEndPos: number;
    expectedSymbols: string[];
    unwantedSymbols: string[];
}

function getSnippetTestCases(): SnippetTestCase[] {
    const filenames = getTestCaseFilenames(snippetCasesDir)
    const cases = filenames
        .map(getSnippetTestCasesInFile)
        .reduce((p, n) => [...p, ...n], [])
    return cases;
}

function getSnippetTestCasesInFile(fileName: string): SnippetTestCase[] {
    const testCases: SnippetTestCase[] = [];

    const fileText = fs.readFileSync(fileName, { encoding: "utf8" });
    const isPython = fileName.substr(-3) !== ".ts";
    const commentString = isPython ? "#" : "//";

    /* Snippet case spec:
    example:
    // testNamespace.someFunction
    testNamespace.someFunction("")

    Each line that starts in a comment begins a new test case.
    The case ends when the next line with a comment starts or the end of file is reached.
    The content on the comment line is read as the qualified symbol name (qName) of the symbol we want to create a snippet for.
    The non-comment content is the expected snippet result.
    */
    const lines = fileText.split("\n");
    const startsWithComment = (l: string) => l.substr(0, commentString.length) === commentString;
    const linesAndTypes = lines.map(l => [l, startsWithComment(l)] as [string, boolean])

    let currentCommentLine = ""
    let currentCaseLines: string[] = []
    for (let [line, startsWithComment] of linesAndTypes) {
        if (startsWithComment) {
            // finish current test case
            if (currentCommentLine) {
                const testCase = makeTestCase(currentCommentLine, currentCaseLines.join("\n"));
                testCases.push(testCase);
            }

            // start new test case
            currentCommentLine = line
            currentCaseLines = []
        } else {
            // add to current test case
            currentCaseLines.push(line)
        }
    }
    // finish last current test case
    if (currentCommentLine) {
        const testCase = makeTestCase(currentCommentLine, currentCaseLines.join("\n"));
        testCases.push(testCase);
    }

    return testCases;

    function makeTestCase(comment: string, content: string): SnippetTestCase {
        const qName = comment
            .substr(commentString.length)
            .trim()

        const expectedSnippet = content.trim()

        return {
            fileName,
            isPython,
            qName,
            expectedSnippet
        }
    }
}

function getCompletionTestCases(): CompletionTestCase[] {
    const filenames = getTestCaseFilenames(completionCasesDir)

    const testCases: CompletionTestCase[] = [];

    for (const fileName of filenames) {
        const fileText = fs.readFileSync(fileName, { encoding: "utf8" });
        const isPython = fileName.substr(-3) !== ".ts";
        const commentString = isPython ? "#" : "//";

        const lines = fileText.split("\n");
        let position = 0;

        /*  Completion case spec:
        example:
        foo.ba // foo.bar; foo.baz

        Each line that ends in a comment is a test cases.
        The comment is a ";" seperated list of expected symbols.
        Symbols that start with "!" must not be present in the completion list.
        The completions are triggered as if  the user's cursor was at the end of
        the line right after the last non-whitespace character.
        */
        for (const line of lines) {
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

                // find last non-whitespace character
                let lastNonWhitespace: number;
                let endsInDot = false;
                for (let i = lineWithoutCommment.length - 1; i >= 0; i--) {
                    lastNonWhitespace = i
                    if (lineWithoutCommment[i] !== " ") {
                        endsInDot = lineWithoutCommment[i] === "."
                        break
                    }
                }

                let relativeCompletionPosition = lastNonWhitespace + 1

                const completionPosition = position + relativeCompletionPosition;

                const lineText = line.substr(0, commentIndex);

                // Find word start and end
                let wordStartPos = fileText.slice(0, completionPosition).search(/[a-zA-Z\d]+\s*$/)
                let wordEndPos = wordStartPos + fileText.slice(wordStartPos).search(/[^a-zA-Z\d]/)
                if (wordStartPos < 0 || wordEndPos < 0) {
                    wordStartPos = completionPosition
                    wordEndPos = completionPosition
                }

                testCases.push({
                    fileName,
                    fileText,
                    lineText,
                    isPython,
                    expectedSymbols,
                    unwantedSymbols,
                    position: completionPosition,
                    wordStartPos,
                    wordEndPos,
                })
            }

            position += line.length + 1/*new line char*/;
        }
    }

    return testCases;
}

const fileName = (isPython: boolean) => isPython ? pxt.MAIN_PY : pxt.MAIN_TS

function runCompletionTestCaseAsync(testCase: CompletionTestCase): Promise<void> {
    return getOptionsAsync(testCase.fileText, testCase.isPython)
        .then(opts => {
            setOptionsOp(opts);
            ensureAPIInfoOp();
            const result = completionsOp(
                fileName(testCase.isPython),
                testCase.position,
                testCase.wordStartPos,
                testCase.wordEndPos,
                testCase.fileText
            );

            if (pxtc.service.IsOpErr(result)) {
                chai.assert(false, `Lang service crashed with:\n${result.errorMessage}`)
                return;
            }

            const symbolIndex = (sym: string) => result.entries.reduce((prevIdx, s, idx) => {
                if (prevIdx >= 0)
                    return prevIdx
                if ((testCase.isPython ? s.pyQName : s.qName) === sym)
                    return idx;
                return -1
            }, -1)
            const hasSymbol = (sym: string) => symbolIndex(sym) >= 0;

            let lastFoundIdx = -1;
            for (const sym of testCase.expectedSymbols) {
                let idx = symbolIndex(sym)
                const foundSymbol = idx >= 0
                chai.assert(foundSymbol, `Did not receive symbol '${sym}' for '${testCase.lineText}'; instead we got ${result.entries.length} other symbols${result.entries.length < 5 ? ": " + result.entries.map(e => e.qName).join(", ") : "."}`);
                chai.assert(!foundSymbol || idx > lastFoundIdx, `Found symbol '${sym}', but in the wrong order at index: ${idx}. Expected it after: ${lastFoundIdx >= 0 ? result.entries[lastFoundIdx].qName : ""}`)
                lastFoundIdx = idx;
            }
            for (const sym of testCase.unwantedSymbols) {
                chai.assert(!hasSymbol(sym), `Receive explicitly unwanted symbol '${sym}' for '${testCase.lineText}'`);
            }
        })
}

function runSnippetTestCaseAsync(testCase: SnippetTestCase): Promise<void> {
    return getOptionsAsync("", testCase.isPython)
        .then(opts => {
            setOptionsOp(opts);
            ensureAPIInfoOp();
            const { qName, isPython, expectedSnippet } = testCase;
            const result = snippetOp(qName, isPython);

            if (pxtc.service.IsOpErr(result)) {
                chai.assert(false, `Lang service crashed with:\n${result.errorMessage}`)
                return;
            }

            chai.assert(typeof result === "string", `Lang service returned non-string result: ${JSON.stringify(result)}`)

            const match = util.compareBaselines(result, expectedSnippet, {
                whitespaceSensitive: false
            })

            chai.assert(match, `Snippet for ${qName} "${result}" did not match expected "${expectedSnippet}"`);
        })
}

function getOptionsAsync(fileContent: string, isPython: boolean) {
    const packageFiles: pxt.Map<string> = {};
    packageFiles[fileName(isPython)] = fileContent;

    return util.getTestCompileOptsAsync(packageFiles, [testPackage], true)
        .then(opts => {
            if (isPython)
                opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME
            return opts
        })
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

function snippetOp(qName: string, python: boolean): pxtc.service.OpError | string {
    return pxtc.service.performOperation("snippet", {
        snippet: {
            qName,
            python
        },
        runtime: pxt.appTarget.runtime
    }) as pxtc.service.OpError | string;
}



describe("language service", () => {
    const completionCases = getCompletionTestCases();
    for (const testCase of completionCases) {
        it("get completions " + testCase.fileName + testCase.position, () => {
            return runCompletionTestCaseAsync(testCase);
        });
    }

    const snippetCases = getSnippetTestCases();
    for (const testCase of snippetCases) {
        it(`snippet for ${testCase.qName} in ${testCase.fileName}`, () => {
            return runSnippetTestCaseAsync(testCase);
        });
    }
})