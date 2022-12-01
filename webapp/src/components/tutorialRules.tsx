import TutorialOptions = pxt.tutorial.TutorialOptions;
import TutorialStepInfo = pxt.tutorial.TutorialStepInfo;

export type TutorialRuleResult = {
    isValid: Boolean;
    hint: string | JSX.Element;
}

export type TutorialRule = {
    id: String; // Value used to indicate rule in markdown.

    // TODO thsparks : Remove unused parameters.
    // TODO thsparks : Add params here or in rule info?
    execute: (tutorialOptions: TutorialOptions) => Promise<TutorialRuleResult>;
}

export const TutorialRules: TutorialRule[] = [
    {
        id: "validateAnswerKeyBlocksExist",
        // TODO thsparks : Params?
        execute: validateAnswerKeyBlocksExist,
    }
]

    // TODO thsparks: Understand, comment, reduce duplication with old validation
     function tutorialBlockList(tutorial: TutorialOptions, step: TutorialStepInfo): Promise<pxt.Map<pxt.Map<number>> | undefined> {
        return pxt.BrowserUtils.tutorialInfoDbAsync()
            .then(db => db.getAsync(tutorial.tutorial, tutorial.tutorialCode)
                .then(entry => {
                    if (entry?.snippets) {
                        return Promise.resolve(entry.snippets);
                    }
                    else {
                        return Promise.resolve(undefined);
                    }
                })
            );
    }

    // TODO thsparks: Understand, comment, reduce duplication with old validation
    function extractBlockSnippet(tutorial: TutorialOptions, indexdb: pxt.Map<pxt.Map<number>>) {
        const { tutorialStepInfo, tutorialStep } = tutorial;
        const body = tutorial.tutorialStepInfo[tutorialStep].hintContentMd;
        let hintCode = "";
        if (body != undefined) {
            body.replace(/((?!.)\s)+/g, "\n").replace(/``` *(block|blocks)\s*\n([\s\S]*?)\n```/gmi, function (m0, m1, m2) {
                hintCode = `{\n${m2}\n}`;
                return "";
            });
        }

        const snippetStepKey = pxt.BrowserUtils.getTutorialCodeHash([hintCode]);
        let blockMap = {};
        if (indexdb != undefined) {
            blockMap = indexdb[snippetStepKey];
        }
        return blockMap;
    }


async function validateAnswerKeyBlocksExist(tutorialOptions: TutorialOptions): Promise<TutorialRuleResult> {
    const stepInfo = tutorialOptions.tutorialStepInfo ? tutorialOptions.tutorialStepInfo[tutorialOptions.tutorialStep] : null;
    if(!stepInfo) return {isValid: true, hint: ""};

    const userBlocks = Blockly.getMainWorkspace().getAllBlocks(false /* ordered */); // TODO thsparks : Confirm loaded before accessing?
    const userBlocksByType: Set<string> = new Set<string>(userBlocks.map(b => b.type));

    const indexdb = await tutorialBlockList(tutorialOptions, stepInfo);
    const tutorialBlocks = extractBlockSnippet(tutorialOptions, indexdb);
    const tutorialBlockKeys = Object.keys(tutorialBlocks ?? {});

    let missingBlocks: string[] = [];
    for (let i: number = 0; i < tutorialBlockKeys.length; i++) {
        let tutorialBlockKey = tutorialBlockKeys[i];
        if (!userBlocksByType.has(tutorialBlockKey)) { // user did not use a specific block
            missingBlocks.push(tutorialBlockKey);
        }
    }

    const isValid = missingBlocks.length == 0;
    return {
        isValid: isValid,
        hint: isValid ? undefined : `Missing blocks: ${missingBlocks.join(", ")}`,
    }
}