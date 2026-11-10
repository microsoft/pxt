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

describe("library picker string extraction", () => {
    it("extracts only the owning package's resource-qualified picker strings", () => {
        const make = (namespace: string) => pxt.inflateJRes(JSON.parse(JSON.stringify({
            "*": { namespace, mimeType: "application/x-makecode-grid-picker" },
            icons: { gridPickerCatalog: {
                name: "Images",
                tabs: [{ id: "all", name: "All", flat: true }],
                groups: [{ id: "birds", name: "Birds", tags: ["bird"] }],
                filters: [{ id: "playable", name: "Playable", tags: ["playable"] }]
            } }
        })));
        const alpha = make("alpha.pickers");
        const beta = make("beta.pickers");
        const files = ts.pxtc.genDocs("alpha", { byQName: {}, jres: { ...alpha, ...beta } }, { locs: true, jres: alpha });
        const strings = JSON.parse(files["alpha-strings.json"]);
        for (const name of ["Images", "All", "Birds", "Playable"]) {
            chai.expect(strings[`alpha.pickers.icons|gridPicker|${name}`]).equals(name);
        }
        chai.expect(Object.keys(strings).some(key => key.startsWith("beta."))).equals(false);
    });
});

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

describe("simulator-focused tutorial steps", () => {
    it("parses the flag without treating it as the deprecated fullscreen hint", () => {
        const info = pxt.tutorial.parseTutorial(`# Simulator

## Step 1

Write some code.

## Try it @simFullscreen

Look at the simulator and press A.

## Step 3

Return to your code.`);

        chai.expect(info.steps[1].title).to.equal("Try it");
        chai.expect(info.steps[1].simFullscreen).to.equal(true);
        chai.expect(info.steps[1].showHint).to.equal(undefined);
        chai.expect(info.steps[1].showDialog).to.equal(undefined);
        chai.expect(info.steps[1].headerContentMd).to.equal("Look at the simulator and press A.");
        chai.expect(info.steps[0].simFullscreen).to.equal(undefined);
        chai.expect(info.steps[2].simFullscreen).to.equal(undefined);
    });

    it("supports case-insensitive flags, hidden titles, and activity steps", () => {
        const info = pxt.tutorial.parseTutorial(`# Simulator

### @activities true

## Activity 1

### {Try it @SIMFULLSCREEN}

Press A.

### Continue

Edit your code.`);

        chai.expect(info.steps[0].simFullscreen).to.equal(true);
        chai.expect(info.steps[0].title).to.equal(undefined);
        chai.expect(info.steps[0].activity).to.equal(0);
        chai.expect(info.steps[0].showHint).to.equal(undefined);
        chai.expect(info.steps[1].simFullscreen).to.equal(undefined);
    });

    it("preserves hints and supports explicit combinations with other modifiers", () => {
        const info = pxt.tutorial.parseTutorial(`# Simulator

## Try it @simFullscreen @showhint @resetDiff @tutorialCompleted

Press A.

\`\`\`blocks
test();
\`\`\`

## Legacy @fullscreen

An ordinary fullscreen hint.`);

        const step = info.steps[0];
        chai.expect(step.simFullscreen).to.equal(true);
        chai.expect(step.showHint).to.equal(true);
        chai.expect(step.resetDiff).to.equal(true);
        chai.expect(step.tutorialCompleted).to.equal(true);
        chai.expect(step.title).to.equal("Try it");
        chai.expect(step.hintContentMd).to.contain("test();");
        chai.expect(info.steps[1].showHint).to.equal(true);
        chai.expect(info.steps[1].simFullscreen).to.equal(undefined);
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