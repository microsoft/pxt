namespace pxt.tutorial {
    const _h2Regex = /^##[^#](.*)$([\s\S]*?)(?=^##[^#]|$(?![\r\n]))/gmi;
    const _h3Regex = /^###[^#](.*)$([\s\S]*?)(?=^###[^#]|$(?![\r\n]))/gmi;

    export function parseTutorial(tutorialmd: string): TutorialInfo {
        const {steps, activities} = parseTutorialMarkdown(tutorialmd);
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

    function parseTutorialMarkdown(tutorialmd: string): {steps: TutorialStepInfo[], activities: TutorialActivityInfo[]} {
        const metadata = parseTutorialMetadata(tutorialmd);
        tutorialmd = stripHiddenSnippets(tutorialmd);
        if (metadata && metadata.activities) {
            // tutorial with "## ACTIVITY", "### STEP" syntax
            return parseTutorialActivities(tutorialmd, metadata);
        } else {
            // tutorial with "## STEP" syntax
            let steps = parseTutorialSteps(tutorialmd, null, metadata);

            // old: "### STEP" syntax (no activity header guaranteed)
            if (!steps || steps.length <= 1) steps = parseTutorialSteps(tutorialmd, _h3Regex, metadata);

            return {steps: steps, activities: null};
        }
    }

    function parseTutorialActivities(markdown: string, metadata: TutorialMetadata):  {steps: TutorialStepInfo[], activities: TutorialActivityInfo[]} {
        let stepInfo: TutorialStepInfo[] = [];
        let activityInfo: TutorialActivityInfo[] = [];

        markdown.replace(_h2Regex, function(match, name, activity) {
            let i = activityInfo.length;
            activityInfo.push({
                name: name || lf("Activity ") + i,
                step: stepInfo.length
            })

            let steps = parseTutorialSteps(activity, _h3Regex, metadata);
            steps = steps.map(step => {
                step.activity = i;
                return step;
            })
            stepInfo = stepInfo.concat(steps);

            return "";
        })

        return {steps: stepInfo, activities: activityInfo};
    }

    function parseTutorialSteps(markdown: string, regex?: RegExp, metadata?: TutorialMetadata): TutorialStepInfo[] {
        // use regex override if present
        let stepRegex = regex || _h2Regex;

        let stepInfo: TutorialStepInfo[] = [];
        markdown.replace(stepRegex, function (match, flags, step) {
            step = step.trim();
            let {header, hint} = parseTutorialHint(step, metadata && metadata.explicitHints);
            let info: TutorialStepInfo = {
                fullscreen: /@(fullscreen|unplugged)/.test(flags),
                unplugged: /@unplugged/.test(flags),
                tutorialCompleted: /@tutorialCompleted/.test(flags),
                contentMd: step,
                headerContentMd: header,
                hintContentMd: hint,
                hasHint: hint && hint.length > 0
            }
            stepInfo.push(info);
            return "";
        });

        if (markdown.indexOf("# Not found") == 0) {
            pxt.debug(`tutorial not found`);
            return undefined;
        }

        return stepInfo;
    }

    function parseTutorialHint(step: string, explicitHints?: boolean): {header: string, hint: string} {
        let header = step, hint;
        if (explicitHints) {
            // hint is explicitly set with hint syntax "#### ~ tutorialhint" and terminates at the next heading
            const hintTextRegex = /#+ ~ tutorialhint([\s\S]*)/i;
            header = step.replace(hintTextRegex, function (f, m) {
                hint = m;
                return "";
            });
        } else {
            // everything after the first ``` section OR the first image is treated as a "hint"
            const hintTextRegex = /(^[\s\S]*?\S)\s*((```|\!\[[\s\S]+?\]\(\S+?\))[\s\S]*)/mi;
            let hintText = step.match(hintTextRegex);
            if (hintText && hintText.length > 2) {
                header = hintText[1].trim();
                hint = hintText[2].trim();
            }
        }

        return {header: header, hint: hint};
    }

    /* Remove hidden snippets from text */
    function stripHiddenSnippets(str: string): string {
        if (!str) return null;
        const hiddenSnippetRegex = /```(filterblocks|package|ghost|config|template)\s*\n([\s\S]*?)\n```/gmi;
        return str.replace(hiddenSnippetRegex, '').trim();
    }

    /*
        Parses metadata at the beginning of tutorial markown. Metadata is a key-value
        pair in the format: `### @KEY VALUE`
    */
    function parseTutorialMetadata(tutorialmd: string): TutorialMetadata {
        const metadataRegex = /### @(\S+) ([ \S]+)/gi;
        const m: any = {};

        tutorialmd.replace(metadataRegex, function (f, k, v) {
            m[k] = v;
            return "";
        });

        return m as TutorialMetadata;
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
}