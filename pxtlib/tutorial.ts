namespace pxt.tutorial {
    const _h2Regex = /^##[^#](.*)$([\s\S]*?)(?=^##[^#]|$(?![\r\n]))/gmi;
    const _h3Regex = /^###[^#](.*)$([\s\S]*?)(?=^###[^#]|$(?![\r\n]))/gmi;

    export function parseTutorial(tutorialmd: string): TutorialInfo {
        const { metadata, body } = parseTutorialMetadata(tutorialmd);
        const { steps, activities } = parseTutorialMarkdown(body, metadata);
        const title = parseTutorialTitle(body);
        if (!steps)
            return undefined; // error parsing steps

        // collect code and infer editor
        const { code, templateCode, editor, language } = computeBodyMetadata(body);

        // noDiffs legacy
        if (metadata.diffs === true // enabled in tutorial
            || (metadata.diffs !== false && metadata.noDiffs !== true // not disabled
                && (
                    (editor == pxt.BLOCKS_PROJECT_NAME && pxt.appTarget.appTheme.tutorialBlocksDiff)  //blocks enabled always
                    || (editor != pxt.BLOCKS_PROJECT_NAME && pxt.appTarget.appTheme.tutorialTextDiff) // text enabled always
                ))
        ) {
            diffify(steps, activities);
        }

        // strip hidden snippets
        steps.forEach(step => {
            step.contentMd = stripHiddenSnippets(step.contentMd)
            step.headerContentMd = stripHiddenSnippets(step.headerContentMd)
            step.hintContentMd = stripHiddenSnippets(step.hintContentMd);
        });

        return {
            editor,
            title,
            steps,
            activities,
            code,
            templateCode,
            metadata,
            language
        };
    }

    function computeBodyMetadata(body: string) {
        // collect code and infer editor
        let editor: string = undefined;
        const regex = /``` *(sim|block|blocks|filterblocks|spy|ghost|typescript|ts|js|javascript|template|python)?\s*\n([\s\S]*?)\n```/gmi;
        let code = '';
        let templateCode: string;
        let language: string;
        let idx = 0;
        // Concatenate all blocks in separate code blocks and decompile so we can detect what blocks are used (for the toolbox)
        body
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
                    case "python":
                        if (!checkTutorialEditor(pxt.PYTHON_PROJECT_NAME))
                            return undefined;
                        if (m1 == "python")
                            language = m1;
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
                code += `\n${m1 == "python"
                    ? "def __wrapper_" + idx + "():\n" + m2.replace(/^/gm, "    ")
                    : "{\n" + m2 + "\n}"}\n`;
                idx++
                return "";
            });
        // default to blocks
        editor = editor || pxt.BLOCKS_PROJECT_NAME
        return { code, templateCode, editor, language }

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

    function diffify(steps: TutorialStepInfo[], activities: TutorialActivityInfo[]) {
        // convert typescript snippets into diff snippets
        let lastSrc: string = undefined;
        steps.forEach((step, stepi) => {
            // reset diff on each activity or when requested
            if (step.resetDiff
                || (activities && activities.find(activity => activity.step == stepi)))
                lastSrc = undefined;
            // extract typescript snippet from hint or content
            if (step.hintContentMd) {
                const s = convertSnippetToDiff(step.hintContentMd);
                if (s && s != step.hintContentMd) {
                    step.hintContentMd = s;
                    return;
                }
            }
            if (step.headerContentMd) {
                const s = convertSnippetToDiff(step.headerContentMd);
                if (s && s != step.headerContentMd) {
                    step.headerContentMd = s;
                    return;
                }
            }
        })

        function convertSnippetToDiff(src: string): string {
            const diffClasses: pxt.Map<string> = {
                "typescript": "diff",
                "spy": "diffspy",
                "blocks": "diffblocks",
                "python": "diff"
            }
            const highlightRx = /\s*(\/\/|#)\s*@highlight/gm;

            if (!src) return src;
            return src
                .replace(/```(typescript|spy|python|blocks|ghost|template)((?:.|[\r\n])+)```/, function (m, type, code) {
                    const fileA = lastSrc;

                    const hidden = /^(template|ghost)$/.test(type);
                    const hasHighlight = highlightRx.test(code);
                    code = code.replace(/^\n+/, '').replace(/\n+$/, ''); // always trim lines
                    if (hasHighlight) code = code.replace(highlightRx, '');

                    lastSrc = code;
                    if (!fileA || hasHighlight || hidden)
                        return m; // leave unchanged or reuse highlight info
                    else
                        return `\`\`\`${diffClasses[type]}
${fileA}
----------
${code}
\`\`\``
                })
        }
    }

    function parseTutorialTitle(tutorialmd: string): string {
        let title = tutorialmd.match(/^#[^#](.*)$/mi);
        return title && title.length > 1 ? title[1] : null;
    }

    function parseTutorialMarkdown(tutorialmd: string, metadata: TutorialMetadata): { steps: TutorialStepInfo[], activities: TutorialActivityInfo[] } {
        if (metadata && metadata.activities) {
            // tutorial with "## ACTIVITY", "### STEP" syntax
            return parseTutorialActivities(tutorialmd, metadata);
        } else {
            // tutorial with "## STEP" syntax
            let steps = parseTutorialSteps(tutorialmd, null, metadata);

            // old: "### STEP" syntax (no activity header guaranteed)
            if (!steps || steps.length < 1) steps = parseTutorialSteps(tutorialmd, _h3Regex, metadata);

            return { steps: steps, activities: null };
        }
    }

    function parseTutorialActivities(markdown: string, metadata: TutorialMetadata): { steps: TutorialStepInfo[], activities: TutorialActivityInfo[] } {
        let stepInfo: TutorialStepInfo[] = [];
        let activityInfo: TutorialActivityInfo[] = [];

        markdown.replace(_h2Regex, function (match, name, activity) {
            let i = activityInfo.length;
            activityInfo.push({
                name: name || lf("Activity {0}", i),
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

        return { steps: stepInfo, activities: activityInfo };
    }

    function parseTutorialSteps(markdown: string, regex?: RegExp, metadata?: TutorialMetadata): TutorialStepInfo[] {
        // use regex override if present
        let stepRegex = regex || _h2Regex;

        let stepInfo: TutorialStepInfo[] = [];
        markdown.replace(stepRegex, function (match, flags, step) {
            step = step.trim();
            let { header, hint } = parseTutorialHint(step, metadata && metadata.explicitHints);
            let info: TutorialStepInfo = {
                contentMd: step,
                headerContentMd: header
            }
            if (/@(fullscreen|unplugged)/.test(flags))
                info.fullscreen = true;
            if (/@unplugged/.test(flags))
                info.unplugged = true;
            if (/@tutorialCompleted/.test(flags))
                info.tutorialCompleted = true;
            if (/@resetDiff/.test(flags))
                info.resetDiff = true;
            if (hint)
                info.hintContentMd = hint;
            stepInfo.push(info);
            return "";
        });

        if (markdown.indexOf("# Not found") == 0) {
            pxt.debug(`tutorial not found`);
            return undefined;
        }

        return stepInfo;
    }

    function parseTutorialHint(step: string, explicitHints?: boolean): { header: string, hint: string } {
        // remove hidden code sections
        step = stripHiddenSnippets(step);

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

        return { header, hint };
    }

    /* Remove hidden snippets from text */
    function stripHiddenSnippets(str: string): string {
        if (!str) return str;
        const hiddenSnippetRegex = /```(filterblocks|package|ghost|config|template)\s*\n([\s\S]*?)\n```/gmi;
        return str.replace(hiddenSnippetRegex, '').trim();
    }

    /*
        Parses metadata at the beginning of tutorial markown. Metadata is a key-value
        pair in the format: `### @KEY VALUE`
    */
    function parseTutorialMetadata(tutorialmd: string): { metadata: TutorialMetadata, body: string } {
        const metadataRegex = /### @(\S+) ([ \S]+)/gi;
        const m: pxt.Map<any> = {};

        const body = tutorialmd.replace(metadataRegex, function (f, k, v) {
            try {
                m[k] = JSON.parse(v);
            } catch {
                m[k] = v;
            }

            return "";
        });
        const metadata = (m as TutorialMetadata);
        if (metadata.explicitHints !== undefined
            && pxt.appTarget.appTheme
            && pxt.appTarget.appTheme.tutorialExplicitHints)
            metadata.explicitHints = true;

        return { metadata, body };
    }

    export function highlight(pre: HTMLElement): void {
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
            if (i > 0 && i < lines.length)
                pre.appendChild(document.createTextNode("\n"))
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
                pre.appendChild(document.createTextNode(line));
            }
        }
    }

    export function getTutorialOptions(md: string, tutorialId: string, filename: string, reportId: string, recipe: boolean): { options: pxt.tutorial.TutorialOptions, editor: string } {
        const tutorialInfo = pxt.tutorial.parseTutorial(md);
        if (!tutorialInfo)
            throw new Error(lf("Invalid tutorial format"));

        const tutorialOptions: pxt.tutorial.TutorialOptions = {
            tutorial: tutorialId,
            tutorialName: tutorialInfo.title || filename,
            tutorialReportId: reportId,
            tutorialStep: 0,
            tutorialReady: true,
            tutorialHintCounter: 0,
            tutorialStepInfo: tutorialInfo.steps,
            tutorialActivityInfo: tutorialInfo.activities,
            tutorialMd: md,
            tutorialCode: tutorialInfo.code,
            tutorialRecipe: !!recipe,
            templateCode: tutorialInfo.templateCode,
            autoexpandStep: true,
            metadata: tutorialInfo.metadata,
            language: tutorialInfo.language
        };

        return { options: tutorialOptions, editor: tutorialInfo.editor };
    }

}