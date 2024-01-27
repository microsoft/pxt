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