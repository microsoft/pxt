import * as Blockly from "blockly";

import { CommentIcon } from "./blockComment";
import { deleteBlockDataForField, setBlockDataForField } from "../../fields";
import { getBlockDataForField } from "../../fields/field_utils";

// makecode fields generated from functions always use valid JavaScript
// identifiers for their names. starting the name with a ~ prevents us
// from colliding with those fields
const REVIEW_COMMENT_OFFSET_X_FIELD_NAME = "~reviewCommentOffsetX";
const REVIEW_COMMENT_OFFSET_Y_FIELD_NAME = "~reviewCommentOffsetY";

// makecode field for review comments on a block
// TODO thsparks - could do this with a data field like the offsets above, would need to override get/set/changed text maybe?
// TODO thsparks - maybe can store this more like normal comments with mutationToDom?
export const REVIEW_COMMENT_FIELD_NAME = "~reviewComment";

/** The type string used to identify the comment icon. */
export const REVIEW_COMMENT_ICON_TYPE = new Blockly.icons.IconType<ReviewCommentIcon>("review-comment");

/**
 * An icon which allows the user to add comment text to a block.
 */
export class ReviewCommentIcon extends CommentIcon {

    // TODO thsparks : How to get this to appear automatically when data is set? Maybe something in the loader? Or somewhere else?

    /**
     * The weight this icon has relative to other icons. Icons with more positive
     * weight values are rendered farther toward the end of the block.
     */
    protected weight = 1;

    protected xOffsetFieldName = REVIEW_COMMENT_OFFSET_X_FIELD_NAME;
    protected yOffsetFieldName = REVIEW_COMMENT_OFFSET_Y_FIELD_NAME;

    constructor(protected readonly sourceBlock: Blockly.Block) {
        super(sourceBlock);

        this.text = getBlockDataForField(sourceBlock, REVIEW_COMMENT_FIELD_NAME) || "";
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

    /** Sets the text of this comment. Updates any bubbles if they are visible. */
    override setText(text: string) {
        // Blockly comments are omitted from XML serialization if they're empty.
        // In that case, they won't be present in the saved XML but any comment offset
        // data that was previously saved will be since it's a part of the block's
        // serialized data and not the comment's. In order to prevent that orphaned save
        // data from persisting, we need to clear it when the user creates a new comment.

        // If setText is called with the empty string while our text is already the
        // empty string, that means that this comment is newly created and we can safely
        // clear any pre-existing saved offset data.
        if (!this.text && !text) {
            this.clearAllData();
        }

        setBlockDataForField(this.sourceBlock, REVIEW_COMMENT_FIELD_NAME, text);
        this.text = text;
        this.textInputBubble?.setText(this.text);
    }

    /** Returns the text of this comment. */
    getText(): string {
        return this.text;
    }

    /**
     * Updates the text of this comment in response to changes in the text of
     * the input bubble.
     */
    override onTextChange(): void {
        if (!this.textInputBubble) return;

        const newText = this.textInputBubble.getText();
        if (this.text === newText) return;

        setBlockDataForField(this.sourceBlock, REVIEW_COMMENT_FIELD_NAME, newText);
        this.text = newText;
    }

    clearAllData(): void {
        this.clearSavedOffsetData();
        deleteBlockDataForField(this.sourceBlock, REVIEW_COMMENT_FIELD_NAME);
    }
}

Blockly.icons.registry.register(REVIEW_COMMENT_ICON_TYPE, ReviewCommentIcon);
