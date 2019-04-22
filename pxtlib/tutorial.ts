namespace pxt.tutorial {
    export function parseTutorial(tutorialmd: string): TutorialInfo {
        const steps = parseTutorialSteps(tutorialmd);
        if (!steps)
            return undefined; // error parsing steps

        // collect code and infer editor
        let editor: string = undefined;
        const regex = /```(sim|block|blocks|filterblocks|spy|typescript|ts|js|javascript)\s*\n([\s\S]*?)\n```/gmi;
        let code = '';
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
                }
                code += "\n { \n " + m2 + "\n } \n";
                return "";
            });

        return <pxt.tutorial.TutorialInfo>{
            editor: editor || pxt.BLOCKS_PROJECT_NAME,
            steps: parseTutorialSteps(tutorialmd),
            code
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

    function parseTutorialSteps(tutorialmd: string): TutorialStepInfo[] {
        // Download tutorial markdown
        let steps = tutorialmd.split(/^##[^#].*$/gmi);
        let newAuthoring = true;
        if (steps.length <= 1) {
            // try again, using old logic.
            steps = tutorialmd.split(/^###[^#].*$/gmi);
            newAuthoring = false;
        }
        if (steps[0].indexOf("# Not found") == 0) {
            pxt.debug(`tutorial not found`);
            return undefined;
        }
        let stepInfo: TutorialStepInfo[] = [];
        tutorialmd.replace(newAuthoring ? /^##[^#](.*)$/gmi : /^###[^#](.*)$/gmi, (f, s) => {
            let info: TutorialStepInfo = {
                fullscreen: /@(fullscreen|unplugged)/.test(s),
                unplugged: /@unplugged/.test(s)
            }
            stepInfo.push(info);
            return ""
        });

        if (steps.length < 1)
            return undefined; // Promise.resolve();
        steps = steps.slice(1, steps.length); // Remove tutorial title

        for (let i = 0; i < steps.length; i++) {
            const stepContent = steps[i].trim();
            const contentLines = stepContent.split('\n');
            stepInfo[i].headerContentMd = contentLines[0];
            stepInfo[i].contentMd = stepContent;
            stepInfo[i].hasHint = contentLines.length > 1;
        }
        return stepInfo;
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