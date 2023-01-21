import { MarkedContent } from "../marked";
import TutorialOptions = pxt.tutorial.TutorialOptions;
import TutorialStepInfo = pxt.tutorial.TutorialStepInfo;
import CodeValidationConfig = pxt.tutorial.CodeValidationConfig;
import CodeValidator = pxt.tutorial.CodeValidator;
import CodeValidatorMetadata = pxt.tutorial.CodeValidatorMetadata;
import CodeValidationResult = pxt.tutorial.CodeValidationResult;
import CodeValidationExecuteOptions = pxt.tutorial.CodeValidationExecuteOptions;

const defaultResult: CodeValidationResult = {
    isValid: true,
    hint: null,
};

export function GetValidator(metadata: CodeValidatorMetadata): CodeValidator {
    switch(metadata.validatorType.toLowerCase()) {
        case "blocksexistvalidator":
            return new BlocksExistValidator(metadata.properties);
        default:
            console.error(`Unrecognized validator: ${metadata.validatorType}`);
            return null;
    }
}

abstract class CodeValidatorBase implements CodeValidator {
    enabled: boolean;
    abstract name: string;

    constructor(properties: {[index: string]: string}) {
        this.enabled = properties["enabled"]?.toLowerCase() != "false"; // Default to true
    }

    execute(options: CodeValidationExecuteOptions): Promise<CodeValidationResult> {
        if (!this.enabled) return Promise.resolve(defaultResult);

        const result = this.executeInternal(options);

        if (!result) {
            pxt.tickEvent(`codevalidation.detectederror`, {
                validator: this.name,
                tutorial: options.tutorialOptions?.tutorial,
                step: options.tutorialOptions?.tutorialStep,
            });
        }

        return result;
    }

    protected abstract executeInternal(options: CodeValidationExecuteOptions): Promise<CodeValidationResult>;
}

export class BlocksExistValidator extends CodeValidatorBase {
    name = "blocksexistvalidator";

    async executeInternal(options: CodeValidationExecuteOptions): Promise<CodeValidationResult> {
        let missingBlocks: string[] = [];
        let disabledBlocks: string[] = [];
        const {parent, tutorialOptions} = options;
        const stepInfo = tutorialOptions.tutorialStepInfo
            ? tutorialOptions.tutorialStepInfo[tutorialOptions.tutorialStep]
            : null;
        if (!stepInfo) {
            return defaultResult;
        }

        const userBlocks = Blockly.getMainWorkspace()?.getAllBlocks(false /* ordered */);
        const userBlocksEnabledByType = new Map<string, boolean>(); // Key = type, value = enabled
        userBlocks.forEach(b => userBlocksEnabledByType.set(b.type, userBlocksEnabledByType.get(b.type) || b.isEnabled()));

        const allHighlightedBlocks = await getTutorialHighlightedBlocks(tutorialOptions, stepInfo);
        if (!allHighlightedBlocks) {
            return defaultResult;
        }

        const stepHash = getTutorialStepHash(tutorialOptions);
        const stepHighlights = allHighlightedBlocks[stepHash];
        const highlightedBlockKeys = stepHighlights ? Object.keys(stepHighlights) : [];

        for (let i: number = 0; i < highlightedBlockKeys.length; i++) {
            let tutorialBlockKey = highlightedBlockKeys[i];
            const isEnabled = userBlocksEnabledByType.get(tutorialBlockKey);
            if (isEnabled === undefined) {
                // user did not use a specific block
                missingBlocks.push(tutorialBlockKey);
            } else if (!isEnabled) {
                disabledBlocks.push(tutorialBlockKey);
            }
        }

        let isValid = true;
        let errorDescription: string;

        if (missingBlocks.length > 0 && disabledBlocks.length > 0) {
            isValid = false;
            errorDescription = lf("Make sure you see blocks that look like this and that they're connected to the rest of your code.")
        } else if (missingBlocks.length > 0) {
            isValid = false;
            errorDescription = lf("Make sure you see blocks that look like this in your workspace.");
        } else if (disabledBlocks.length > 0) {
            isValid = false;
            errorDescription = lf("Make sure your blocks are connected to the rest of your code like this.");
        }

        const blockImages = stepInfo?.hintContentMd ? (<div>
            <strong>{lf("Looks like you're missing some blocks.")}</strong>
            <p>{errorDescription}</p>
            <MarkedContent className="no-select" markdown={stepInfo.hintContentMd} parent={parent} />
        </div>) : "";

        return {
            isValid: isValid,
            hint: isValid ? undefined : blockImages,
        }
    }
}

function getTutorialHighlightedBlocks(tutorial: TutorialOptions, step: TutorialStepInfo): Promise<pxt.Map<pxt.Map<number>> | undefined> {
    return pxt.BrowserUtils.tutorialInfoDbAsync().then((db) =>
        db.getAsync(tutorial.tutorial, tutorial.tutorialCode).then((entry) => {
            if (entry?.highlightBlocks) {
                return Promise.resolve(entry.highlightBlocks);
            } else {
                return Promise.resolve(undefined);
            }
        })
    );
}

function getTutorialStepHash(tutorial: TutorialOptions): string {
    const { tutorialStepInfo, tutorialStep } = tutorial;
    const body = tutorialStepInfo[tutorialStep].hintContentMd;
    let hintCode = "";
    if (body != undefined) {
        body.replace(/((?!.)\s)+/g, "\n")
            .replace(
                /``` *(block|blocks)\s*\n([\s\S]*?)\n```/gim,
                function (m0, m1, m2) {
                    hintCode = `{\n${m2}\n}`;
                    return "";
                }
            );
    }

    return pxt.BrowserUtils.getTutorialCodeHash([hintCode]);
}