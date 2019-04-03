namespace pxt.tutorial {

    export function parseTutorialSteps(tutorialId: string, tutorialmd: string): TutorialStepInfo[] {
        // Download tutorial markdown
        let steps = tutorialmd.split(/^##[^#].*$/gmi);
        let newAuthoring = true;
        if (steps.length <= 1) {
            // try again, using old logic.
            steps = tutorialmd.split(/^###[^#].*$/gmi);
            newAuthoring = false;
        }
        if (steps[0].indexOf("# Not found") == 0) {
            pxt.log(`Tutorial not found: ${tutorialId}`);
            throw new Error(`Tutorial not found: ${tutorialId}`);
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

        if (steps.length < 1) return undefined; // Promise.resolve();
        let options = steps[0];
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

    export function bundleTutorialCode(tutorialmd: string): string {
        tutorialmd = tutorialmd.replace(/((?!.)\s)+/g, "\n");

        const regex = /```(sim|block|blocks|filterblocks)\s*\n([\s\S]*?)\n```/gmi;
        let code = '';
        // Concatenate all blocks in separate code blocks and decompile so we can detect what blocks are used (for the toolbox)
        tutorialmd.replace(regex, function(m0,m1,m2) {
            code += "\n { \n " + m2 + "\n } \n";
            return "";
        });
        return code;
    }
}