/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import * as util from "../common/testUtils";

const casesDir = path.join(process.cwd(), "tests", "tutorial-test", "cases");
const baselineDir = path.join(process.cwd(), "tests", "tutorial-test", "baselines");

// Just needs to exist
pxt.setAppTarget(util.testAppTarget);

describe("tutorial test cases", () => {
    const filenames: string[] = [];
    for (const file of fs.readdirSync(casesDir)) {
        if (file[0] == ".") {
            continue;
        }

        const filename = path.join(casesDir, file)
        if (file.substr(-3) === ".md") {
            filenames.push(filename)
        }
    };

    filenames.forEach(filename => {
        it("should correctly parse " + path.basename(filename), () => {
            tutorialTest(filename)
        });
    });
});

describe("documentation rendering", () => {
    const template = `
<aside id=youtube><div data-video="youtube:@ARGS@"></div></aside>
<aside id=vimeo><div data-video="vimeo:@ARGS@"></div></aside>
<main>@body@</main>`;

    const videoCases = [
        { name: "micro:bit YouTube", provider: "youtube", id: "S8NppVT_paw", url: "https://youtu.be/S8NppVT_paw" },
        { name: "Arcade YouTube", provider: "youtube", id: "-P5I_BzoYdg", url: "https://youtu.be/-P5I_BzoYdg" },
        { name: "Vimeo", provider: "vimeo", id: "123456", url: "https://vimeo.com/123456" }
    ];

    for (const video of videoCases) {
        it(`should render ${video.name} links after static breaks`, () => {
            const markdown = `
| Column |
|---|
| Value |

<br/>
${video.url}

## Next section`;
            const html = pxt.docs.renderMarkdown({
                template,
                markdown: pxt.docs.normalizeStaticMarkdown(markdown),
                theme: {}
            });

            chai.expect(html).to.contain(`data-video="${video.provider}:${video.id}"`);
            chai.expect(html).not.to.contain(`### @${video.provider}`);
        });

        it(`should render ${video.name} links with CRLF line endings`, () => {
            const markdown = ["# Video", "", video.url, "", "## Next section"].join("\r\n");
            const html = pxt.docs.renderMarkdown({ template, markdown, theme: {} });

            chai.expect(html).to.contain(`data-video="${video.provider}:${video.id}"`);
            chai.expect(html).not.to.contain(`### @${video.provider}`);
        });
    }
});

describe("documentation translation", () => {
    it("excludes metadata and token-only text from the translation catalog", () => {
        const samples = [
            "", " \t\n", "123 !?", "IE=edge,chrome=1", "width=device-width, initial-scale=1",
            "https://example.com/a", "http://example.com", "/docs/reference",
            "@target-name@", "{some value}", "&nbsp;&nbsp;",
            "123 @target@ /docs {value} &nbsp;",
            "@title@ @version@ (@slug@)", "@first@@second@"
        ];
        for (const text of samples) {
            const result = pxt.docs.translate(`<p>${text}</p>`, {});
            chai.expect(result.text, text).to.equal(`<p>${text}</p>`);
            chai.expect(result.missing, text).to.deep.equal({});
        }
    });

    it("translates prose and preserves surrounding whitespace", () => {
        const samples = [
            "Hello world", "Open @slug@ in GitHub", "Visit https://example.com",
            "@first@second@", "http://", "{unclosed", "&nbsp;Hello"
        ];
        for (const text of samples) {
            const result = pxt.docs.translate(` \t${text}\n `, { [text]: "translated" });
            chai.expect(result.text, text).to.equal(" \ttranslated\n ");
            chai.expect(result.missing, text).to.deep.equal({});
        }
        chai.expect(pxt.docs.translate(" Hello \t world ", {}).missing)
            .to.deep.equal({ "Hello world": "" });
    });

    it("handles long near-matches without backtracking", () => {
        const samples = [
            " ".repeat(10000) + "Hello",
            "!".repeat(10000) + "Hello",
            "&nbsp;".repeat(10000) + "Hello",
            "/path".repeat(10000) + "-Hello",
            "@target@".repeat(10000) + "Hello"
        ];
        for (const text of samples) {
            const result = pxt.docs.translate(text, { [text.trim()]: "translated" });
            chai.expect(result.text).to.equal(text.match(/^\s*/)[0] + "translated");
            chai.expect(result.missing).to.deep.equal({});
        }
    });
});

function tutorialTest(filename: string) {
    const input = fs.readFileSync(filename, "utf8");
    const basename = path.basename(filename).slice(0, -3) + ".json";
    const baselinePath = path.join(baselineDir, basename);

    let info = pxt.tutorial.parseTutorial(input);
    let baseline;
    try {
        baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    }
    catch (e) {
        // If there isn't a baseline, generate one.
        let newBaseline = info;
        fs.writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 4));
    }

    baseline = baseline || info;

    let err = pxt.Util.deq(baseline, info);
    if (err) {
        fs.writeFileSync(baselinePath + ".original", JSON.stringify(baseline, null, 4));
        fs.writeFileSync(baselinePath, JSON.stringify(info, null, 4));
    }
    chai.assert(err === null, `Parsed tutorial did not match baseline. See ${basename} diff for details.`);
}