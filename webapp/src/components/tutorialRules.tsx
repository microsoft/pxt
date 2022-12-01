import TutorialOptions = pxt.tutorial.TutorialOptions;
import TutorialStepInfo = pxt.tutorial.TutorialStepInfo;

export type TutorialRuleResult = {
    validationResult: Boolean;
    message: string | undefined; // TODO thsparks : Would it make more sense for this to be more of a "hint" that is only shown if the user requests more help?
}

export type TutorialRule = {
    id: String; // Value used to indicate rule in markdown.

    // TODO thsparks : Remove unused parameters.
    // TODO thsparks : Add params here or in rule info?
    execute: (tutorialOptions: TutorialOptions, tutorialStepInfo: TutorialStepInfo) => TutorialRuleResult;
}

export const TutorialRules: TutorialRule[] = [
    {
        id: "validateAnswerKeyBlocksExist",
        // TODO thsparks : Params?
        execute: validateAnswerKeyBlocksExist,
    }
]

function validateAnswerKeyBlocksExist(tutorialOptions: TutorialOptions, tutorialStepInfo: TutorialStepInfo): TutorialRuleResult {
    const userBlocks = Blockly.getMainWorkspace().getAllBlocks(false /* ordered */); // TODO thsparks : Confirm loaded before accessing?

    return {
        validationResult: false,
        message: `Test validation failure. Block count: ${userBlocks.length}`,
    }
}