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

    constructor(properties: pxt.tutorial.CodeValidatorBaseProperties) {
        this.enabled = properties.enabled?.toLowerCase() != "false"; // Default to true
    }

    async execute(options: CodeValidationExecuteOptions): Promise<CodeValidationResult> {
        if (!this.enabled) return defaultResult();

        return this.executeInternal(options);
    }

    protected abstract executeInternal(options: CodeValidationExecuteOptions): Promise<CodeValidationResult>;
}

export class BlocksExistValidator extends CodeValidatorBase {
    name = "blocksexistvalidator";
    markers: string[];

    constructor(properties: pxt.tutorial.CodeValidatorBaseProperties) {
        super(properties);
        if (properties.markers) {
            this.markers = properties.markers.split(",").map(m => m.trim());
        }
    }

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

        // if no valid markers are specified, default to "highlight" and "validate-exists"
        if (!this.markers || (!this.markers.includes("highlight") && !this.markers.includes("validate-exists"))) {
            this.markers = ["highlight", "validate-exists"];
        }

        const allHighlightedBlocks = await pxt.tutorial.getTutorialHighlightedBlocks(tutorialOptions);
        const allValidateBlocks = await pxt.tutorial.getTutorialValidateBlocks(tutorialOptions);
        if (!allHighlightedBlocks && !allValidateBlocks) {
            return defaultResult();
        }

        const stepHash = pxt.tutorial.getTutorialStepHash(tutorialOptions);
        let highlightBlocksCount: pxt.Map<number> = {};
        let validateBlocksCount: pxt.Map<number> = {};

        if (allHighlightedBlocks && this.markers.includes("highlight")) {
            highlightBlocksCount = allHighlightedBlocks[stepHash];
        }

        if (allValidateBlocks && this.markers.includes("validate-exists")) {
            const stepValidateBlocks = allValidateBlocks[stepHash];
            validateBlocksCount = pxt.tutorial.getRequiredBlockCounts(stepValidateBlocks);
        }

        // Combine the two block counts
        const requiredBlockCounts: pxt.Map<number> = {...highlightBlocksCount};
        for (const block in validateBlocksCount) {
            requiredBlockCounts[block] = (requiredBlockCounts[block] || 0) + validateBlocksCount[block];
        }

        const {
            missingBlocks,
            disabledBlocks,
            insufficientBlocks
        } = pxt.blocks.validateBlocksExist({
            usedBlocks: editor.getAllBlocks(false /* ordered */),
            requiredBlockCounts: requiredBlockCounts,
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
        } else if (insufficientBlocks.length > 0) {
            isValid = false;
            errorDescription = lf("Make sure you have enough blocks and that they're connected to the rest of your code. It should look like this.");
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