import { MarkedContent } from "../marked";
import { getBlocksEditor } from "../app";
import CodeValidator = pxt.tutorial.CodeValidator;
import CodeValidatorMetadata = pxt.tutorial.CodeValidatorMetadata;
import CodeValidationResult = pxt.tutorial.CodeValidationResult;
import CodeValidationExecuteOptions = pxt.tutorial.CodeValidationExecuteOptions;

const defaultResult: () => CodeValidationResult = () => ({
    isValid: true,
    hint: null,
});

export function GetValidator(metadata: CodeValidatorMetadata): CodeValidator {
    switch (metadata.validatorType.toLowerCase()) {
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

    async execute(options: CodeValidationExecuteOptions): Promise<CodeValidationResult> {
        if (!this.enabled) return defaultResult();

        return this.executeInternal(options);
    }

    protected abstract executeInternal(options: CodeValidationExecuteOptions): Promise<CodeValidationResult>;
}

export class BlocksExistValidator extends CodeValidatorBase {
    name = "blocksexistvalidator";

    async executeInternal(options: CodeValidationExecuteOptions): Promise<CodeValidationResult> {
        const { parent, tutorialOptions } = options;
        const stepInfo = tutorialOptions.tutorialStepInfo?.[tutorialOptions.tutorialStep];

        if (!stepInfo) {
            return defaultResult();
        }

        const editor = getBlocksEditor()?.editor;
        if (!editor) {
            return defaultResult();
        }

        const allHighlightedBlocks = await pxt.tutorial.getTutorialHighlightedBlocks(tutorialOptions);
        if (!allHighlightedBlocks) {
            return defaultResult();
        }

        const stepHash = pxt.tutorial.getTutorialStepHash(tutorialOptions);
        const stepHighlights = allHighlightedBlocks[stepHash];

        const {
            missingBlocks,
            disabledBlocks,
        } = pxt.blocks.validateBlocksExist({
            usedBlocks: editor.getAllBlocks(false /* ordered */),
            requiredBlockCounts: stepHighlights,
        });

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
            <MarkedContent className="no-select tutorial-validation-answer-key-hint" markdown={stepInfo.hintContentMd} parent={parent} />
        </div>) : "";

        return {
            isValid: isValid,
            hint: isValid ? undefined : blockImages,
        }
    }
}