namespace pxt.tutorial {
    export function parseTutorial(tutorialmd: string): TutorialInfo {
        const [steps, activities] = parseTutorialSteps(tutorialmd);
        const title = parseTutorialTitle(tutorialmd);
        if (!steps)
            return undefined; // error parsing steps

        // collect code and infer editor
        let editor: string = undefined;
        const regex = /```(sim|block|blocks|filterblocks|spy|ghost|typescript|ts|js|javascript|template)?\s*\n([\s\S]*?)\n```/gmi;
        let code = '';
        let templateCode: string;
        // Concatenate all blocks in separate code blocks and decompile so we can detect what blocks are used (for the toolbox)
        tutorialmd
            .replace(/((?!.)\s)+/g, "\n")
            .replace(regex, function (m0, m1, m2) {
                switch (m1) {
                    case "block":
                    case "blocks":
                    case "filterblocks":
                        if (!checkTutorialEditor(pxt.BLOCKS_PROJECT_NAME))
                            return undefined;
                        break;
                    case "spy":
                        if (!checkTutorialEditor(pxt.PYTHON_PROJECT_NAME))
                            return undefined;
                        break;
                    case "typescript":
                    case "ts":
                    case "javascript":
                    case "js":
                        if (!checkTutorialEditor(pxt.JAVASCRIPT_PROJECT_NAME))
                            return undefined;
                        break;
                    case "template":
                        templateCode = m2;
                        break;
                }
                code += "\n { \n " + m2 + "\n } \n";
                return "";
            });

        return <pxt.tutorial.TutorialInfo>{
            editor: editor || pxt.BLOCKS_PROJECT_NAME,
            title: title,
            steps: steps,
            activities: activities,
            code,
            templateCode
        };

        function checkTutorialEditor(expected: string) {
            if (editor && editor != expected) {
                pxt.debug(`tutorial ambiguous: contains snippets of different types`);
                return false;
            } else {
                editor = expected;
                return true;
            }
        }
    }

    function parseTutorialTitle(tutorialmd: string): string {
        let title = tutorialmd.match(/^#[^#](.*)$/mi);
        return title && title.length > 1 ? title[1] : null;
    }

    function parseTutorialSteps(tutorialmd: string): [TutorialStepInfo[], TutorialActivityInfo[]] {
        const metadata = parseTutorialMetadata(tutorialmd);
        const hiddenSnippetRegex = /```(filterblocks|package|ghost|config|template)\s*\n([\s\S]*?)\n```/gmi;

        // Download tutorial markdown
        let activityInfo: TutorialActivityInfo[] = [];
        let stepInfo: TutorialStepInfo[] = [];
        let activities = tutorialmd.split(/(?=^#[^#].*$)/gmi);

        for (let i = 0; i < activities.length; i++) {
            let activity = activities[i];
            if (!activity) continue;

            let name;
            activity = activity.replace(/^#[^#](.*)$/mi, function (f, s) {
                name = s;
                return ""
            });

            let steps = activity.split(/(?=^##[^#].*$)/gmi);

            let newAuthoring = true;
            if (steps.length <= 1) {
                // try again, using old logic.
                steps = activity.split(/^###[^#].*$/gmi);
                newAuthoring = false;
            }
            if (steps[0].indexOf("# Not found") == 0) {
                pxt.debug(`tutorial not found`);
                return undefined;
            }

            if (steps && steps.length > 0) {
                activityInfo.push({
                    name: name || lf("Activity ") + activityInfo.length,
                    step: stepInfo.length
                })
            }

            for (let j = 0; j < steps.length; j++) {
                let step = steps[j];
                let flags;
                step = step.replace(newAuthoring ? /^##[^#](.*)$/gmi : /^###[^#](.*)$/gmi, function (f, s) {
                    flags = s;
                    return "";
                }).trim();

                if (!step) continue;

                let info: TutorialStepInfo = {
                    fullscreen: /@(fullscreen|unplugged)/.test(flags),
                    unplugged: /@unplugged/.test(flags),
                    tutorialCompleted: /@tutorialCompleted/.test(flags),
                    contentMd: step.trim(),
                    activity: i
                }

                stepInfo.push(info);
            }
        }

        for (let i = 0; i < stepInfo.length; i++) {
            const info = stepInfo[i];
            const stepContent = info.contentMd;
            const contentLines = stepContent.split('\n');

            info.headerContentMd = contentLines[0];

            let hintContentMd;
            if (metadata && metadata.v == 2) {
                // v2: hint is explicitly defined in HTML comment form: <!-- HINT TEXT -->
                const hintTextRegex = /<!--([\s\S]*?)-->/i;
                info.headerContentMd = stepContent.replace(hintTextRegex, function (f, m) {
                    hintContentMd = m;
                    return "";
                });
            } else {
                // v1: everything after the first ``` section OR the first image is treated as a "hint"
                const hintTextRegex = /(^[\s\S]*?\S)\s*((```|\!\[[\s\S]+?\]\(\S+?\))[\s\S]*)/mi;
                let hintText = stepContent.match(hintTextRegex);
                if (hintText && hintText.length > 2) {
                    info.headerContentMd = hintText[1];
                    hintContentMd = hintText[2];
                }
            }

            // remove hidden snippets from the hint
            if (hintContentMd) {
                hintContentMd = hintContentMd.replace(hiddenSnippetRegex, '');
                info.hintContentMd = hintContentMd;
            }

            info.hasHint = hintContentMd && hintContentMd.length > 1;
        }
        return [stepInfo, activityInfo];
    }

    /*
        Parses metadata table at the beginning of tutorial markown. Expects a series of
        key-value pairs, in "| key | value |\n" format.
    */
    function parseTutorialMetadata(tutorialmd: string): TutorialMetadata {
        let m: any = {};

        const tableRegex = /(?:\|[\s\S]+?\|[\s\S]+?\|\n)*/i;
        const keyValueRegex = /\|([\s\S]+?)\|([\s\S]+?)\|\n/gi;

        const table = tutorialmd.match(tableRegex)[0];
        table.replace(keyValueRegex, function (f, k, v) {
                m[k.trim()] = v.trim();
                return "";
            });

        const metadata = m as TutorialMetadata;
        return metadata && metadata.v ? metadata :  null;
    }

    export function highlight(pre: HTMLPreElement): void {
        let text = pre.textContent;
        if (!/@highlight/.test(text)) // shortcut, nothing to do
            return;

        // collapse image python/js literales
        text = text.replace(/img\s*\(\s*"{3}(.|\n)*"{3}\s*\)/g, `""" """`);
        text = text.replace(/img\s*\(\s*`(.|\n)*`\s*\)/g, "img` `");

        // render lines
        pre.textContent = ""; // clear up and rebuild
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; ++i) {
            let line = lines[i];
            if (/@highlight/.test(line)) {
                // highlight next line
                line = lines[++i];
                if (line !== undefined) {
                    const span = document.createElement("span");
                    span.className = "highlight-line";
                    span.textContent = line;
                    pre.appendChild(span);
                }
            } else {
                pre.appendChild(document.createTextNode(line + '\n'));
            }
        }
    }

    /**
     * This is a temporary hack to automatically patch examples and tutorials while
     * the pxt-arcade APIs are being updated. This should be removed once that upgrade is
     * complete.
     *
     * @param inputJS The snippet of js (or markdown with js snippets) to upgrade
     */
    export function patchArcadeSnippets(inputJS: string): string {
        if (pxt.appTarget.id !== "arcade" && pxt.appTarget.id !== "pxt-32") return inputJS;

        const declRegex = /enum\s+SpriteKind\s*{((?:[^}]|\s)+)}/gm;
        const builtin = ["Player", "Projectile", "Enemy", "Food"]
        const match = declRegex.exec(inputJS);

        if (match) {
            const referencedNames = match[1].split(/(?:\s|,)+/)
                .map(n => n.trim())
                .filter(n => /[a-zA-Z]+/.test(n))
                .filter(n => builtin.indexOf(n) === -1);

            if (referencedNames.length) {
                return inputJS.replace(declRegex,
`
namespace SpriteKind {
${referencedNames.map(rn => "    export const " + rn + " = SpriteKind.create()").join("\n")}
}
`)
            }
            else {
                return inputJS.replace(declRegex, "");
            }
        }

        return inputJS;
    }
}