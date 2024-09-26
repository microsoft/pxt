import * as Blockly from "blockly";

import { CommentIcon } from "./blockComment";
import { setBlockDataForField } from "../../fields";

// makecode fields generated from functions always use valid JavaScript
// identifiers for their names. starting the name with a ~ prevents us
// from colliding with those fields
const REVIEW_COMMENT_OFFSET_X_FIELD_NAME = "~reviewCommentOffsetX";
const REVIEW_COMMENT_OFFSET_Y_FIELD_NAME = "~reviewCommentOffsetY";

// makecode field for review comments on a block
// TODO thsparks - could do this with a data field like the offsets above, would need to override get/set/changed text maybe?
// TODO thsparks - maybe can store this more like normal comments with mutationToDom?
export const REVIEW_COMMENT_COMPONENT_NAME = "reviewComment";

/** The type string used to identify the comment icon. */
export const REVIEW_COMMENT_ICON_TYPE = new Blockly.icons.IconType<ReviewCommentIcon>("review-comment");

/**
 * An icon which allows the user to add comment text to a block.
 */
export class ReviewCommentIcon extends CommentIcon {
    /**
     * The weight this icon has relative to other icons. Icons with more positive
     * weight values are rendered farther toward the end of the block.
     */
    protected weight = 1;

    protected elementName: string = REVIEW_COMMENT_COMPONENT_NAME;
    protected xOffsetFieldName = REVIEW_COMMENT_OFFSET_X_FIELD_NAME;
    protected yOffsetFieldName = REVIEW_COMMENT_OFFSET_Y_FIELD_NAME;

    constructor(protected readonly sourceBlock: Blockly.Block) {
        super(sourceBlock);
    }

    override getType(): Blockly.icons.IconType<CommentIcon> {
        return REVIEW_COMMENT_ICON_TYPE;
    }

    override applyColour(): void {
        super.applyColour();
        const colour = "#7bd3ed";
        const borderColour = "#7bd3ed"; // "#0d4b5e";
        this.textInputBubble?.setColour(colour, borderColour);
    }
}

Blockly.icons.registry.register(REVIEW_COMMENT_ICON_TYPE, ReviewCommentIcon);
