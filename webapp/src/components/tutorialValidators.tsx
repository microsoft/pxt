import TutorialOptions = pxt.tutorial.TutorialOptions;
import TutorialStepInfo = pxt.tutorial.TutorialStepInfo;
import CodeValidationConfig = pxt.tutorial.CodeValidationConfig;
import CodeValidator = pxt.tutorial.CodeValidator;
import CodeValidatorMetadata = pxt.tutorial.CodeValidatorMetadata;
import CodeValidationResult = pxt.tutorial.CodeValidationResult;
import CodeValidationExecuteOptions = pxt.tutorial.CodeValidationExecuteOptions;
import { MarkedContent } from "../marked";

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

export function PopulateValidatorCache(metadata: CodeValidationConfig): pxt.Map<CodeValidator>{
    if(!metadata?.validatorsMetadata) {
        return null;
    }

    metadata.validators = {};
    metadata.validatorsMetadata.forEach(v => {
        const validator = GetValidator(v);
        if(validator) {
            metadata.validators[v.validatorType] = validator;
        }
    });

    return metadata.validators;
}

abstract class CodeValidatorBase implements CodeValidator {
    enabled: boolean;

    constructor(properties: {[index: string]: string}) {
        this.enabled = properties["enabled"]?.toLowerCase() != "false"; // Default to true
    }

    execute(options: CodeValidationExecuteOptions): Promise<CodeValidationResult> {
        if (!this.enabled) return Promise.resolve(defaultResult);

        return this.executeInternal(options);
    }

    protected abstract executeInternal(options: CodeValidationExecuteOptions): Promise<CodeValidationResult>;
}

export class BlocksExistValidator extends CodeValidatorBase {
    private useHintHighlight = false;

    constructor(properties: { [index: string]: string }) {
        super(properties);
        this.useHintHighlight = properties["useanswerkeyhighlight"]?.toLowerCase() === "true";
    }

    async executeInternal(options: CodeValidationExecuteOptions): Promise<CodeValidationResult> {
        let missingBlocks: string[] = [];
        const {parent, tutorialOptions} = options;
        const stepInfo = tutorialOptions.tutorialStepInfo
            ? tutorialOptions.tutorialStepInfo[tutorialOptions.tutorialStep]
            : null;
        if (!stepInfo) return { isValid: true, hint: "" };

        // Currently, this validator only supports useHintHighlight, so this flag/check is redundant,
        // but there are plans to support manual specification of blocks in the future.
        // As such, it felt prudent to still require this flag so tutorial authors don't have to go back and add it later on.
        if (this.useHintHighlight) {
            // TODO thsparks : Confirm loaded before accessing?
            const userBlocks = Blockly.getMainWorkspace().getAllBlocks(false /* ordered */);
            const enabledBlocks = userBlocks.filter(b => b.isEnabled()); // TODO thsparks : Customize hint if all are present but not enabled (or vice versa).
            const userBlocksByType: Set<string> = new Set<string>(enabledBlocks.map((b) => b.type));

            const allHighlightedBlocks = await getTutorialHighlightedBlocks(tutorialOptions, stepInfo);
            if(!allHighlightedBlocks) {
                return defaultResult;
            }

            const stepHash = getTutorialStepHash(tutorialOptions);
            const stepHighlights = allHighlightedBlocks[stepHash];
            const highlightedBlockKeys = stepHighlights ? Object.keys(stepHighlights) : [];

            for (let i: number = 0; i < highlightedBlockKeys.length; i++) {
                let tutorialBlockKey = highlightedBlockKeys[i];
                if (!userBlocksByType.has(tutorialBlockKey)) {
                    // user did not use a specific block
                    missingBlocks.push(tutorialBlockKey);
                }
            }
        }

        const isValid = missingBlocks.length == 0;
        const blockImages = stepInfo?.hintContentMd ? (<div>
            <strong>{lf("Looks like you're missing some blocks.")}</strong>
            <p>{lf("Make sure you see blocks that look like this and that they're connected to the rest of your code.")}</p>
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