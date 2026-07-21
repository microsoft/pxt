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