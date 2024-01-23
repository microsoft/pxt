namespace pxt.blocks {
    interface BlockSet {
        blocks: string[];
        count: number;
    }

    export interface CriteriaData {
        criteriaId: string;
        displayText: string;
        blockRequirements?: BlockSet[];
        count?: number;
    }

    export function getCriteria(data: CriteriaData): RubricCriteria {
        switch (data.criteriaId) {
            case "blockCheck":
                return new BlockCheckCriteria(data.displayText, data.blockRequirements);
            case "comment":
                return new CommentCriteria(data.displayText, data.count);
            default:
                console.error(`Unrecognized criteriaId: ${data.criteriaId}`);
                return null;
        }
    }

    function blockSetToRequiredBlockCounts(blockSet: BlockSet): pxt.Map<number> {
        const requiredBlockCounts: pxt.Map<number> = {};
        blockSet.blocks.forEach((block) => {
            requiredBlockCounts[block] = blockSet.count;
        });
        return requiredBlockCounts;
    }

    export async function validateProject(usedBlocks: Blockly.Block[], rubric: CriteriaInstance[], catalog: CatalogCriteria[]): Promise<EvaluationResult> {
        const finalResult: pxt.Map<CriteriaResult> = {};

        await Promise.all(rubric.map(async (criteria: CriteriaInstance) => {
            const catalogCriteria = catalog.find((c) => c.id === criteria.catalogCriteriaId);
            if (!catalogCriteria) {
                console.error(`Could not find catalog criteria with id ${criteria.catalogCriteriaId}`);
                return;
            }
            const validatorPlanId = catalogCriteria.use;

            if (validatorPlanId == "block_used_n_times") {
                // TODO - create validation plans somewhere which defines checks to run.
                finalResult[criteria.instanceId] = { passed: true, message: undefined };
            } else if (validatorPlanId == "ai_question") {
                const aiResponse = await askAiQuestion({ shareId: "???", target: "???", question: "Does this program use variables in a meaningful way, and are they well named?" });
                finalResult[criteria.instanceId] = { passed: true, message: aiResponse.responseMessage };
            }
        }));

        return { criteriaResults: finalResult } as EvaluationResult;
    }


    function validateBlockSet(usedBlocks: Blockly.Block[], blockSet: BlockSet): pxt.Map<boolean> {
        const requiredBlockCounts = blockSetToRequiredBlockCounts(blockSet);
        const blockResults: pxt.Map<boolean> = {};
        Object.keys(requiredBlockCounts).forEach((blockId) => {
            blockResults[blockId] = true;
        });
        const {
            missingBlocks,
            disabledBlocks,
            insufficientBlocks
        } = pxt.blocks.validateBlocksExist({
            usedBlocks: usedBlocks,
            requiredBlockCounts: requiredBlockCounts,
        });
        missingBlocks.forEach((blockId) => {
            blockResults[blockId] = false;
        });
        disabledBlocks.forEach((blockId) => {
            blockResults[blockId] = false;
        });
        insufficientBlocks.forEach((blockId) => {
            blockResults[blockId] = false;
        });
        return blockResults;
    }

    export abstract class RubricCriteria {
        displayText: string;
        abstract criteriaId: string;

        constructor(displayText: string) {
            this.displayText = displayText;
        }
    }


    class BlockCheckCriteria extends RubricCriteria {
        criteriaId: "blockCheck";
        blockRequirements: BlockSet[];

        constructor(displayText: string, blockRequirements: BlockSet[]) {
            super(displayText);
            this.blockRequirements = blockRequirements;
        }
    }

    class CommentCriteria extends RubricCriteria {
        criteriaId: "comment";
        count: number;

        constructor(displayText: string, count: number) {
            super(displayText);
            this.count = count;
        }
    }

}