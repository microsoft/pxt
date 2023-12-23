namespace pxt.blocks {
    interface BlockSet {
        blocks: string[];
        count: number;
    }

    export interface CriteriaData {
        criteriaID: string;
        friendlyText: string;
        blockRequirements?: BlockSet[];
        count?: number;
    }

    export function getCriteria(data: CriteriaData): RubricCriteria {
        switch (data.criteriaID) {
            case "blockCheck":
                return new BlockCheckCriteria(data.friendlyText, data.blockRequirements);
            case "comment":
                return new CommentCriteria(data.friendlyText, data.count);
            default:
                console.error(`Unrecognized criteriaID: ${data.criteriaID}`);
                return null;
        }
    }

    export abstract class RubricCriteria {
        friendlyText: string;
        abstract criteriaID: string;

        constructor(friendlyText: string) {
            this.friendlyText = friendlyText;
        }
    }


    class BlockCheckCriteria extends RubricCriteria {
        criteriaID: "blockCheck";
        blockRequirements: BlockSet[];

        constructor(friendlyText: string, blockRequirements: BlockSet[]) {
            super(friendlyText);
            this.blockRequirements = blockRequirements;
        }
    }

    class CommentCriteria extends RubricCriteria {
        criteriaID: "comment";
        count: number;

        constructor(friendlyText: string, count: number) {
            super(friendlyText);
            this.count = count;
        }
    }

}