import * as Blockly from "blockly";

import { CommentIcon } from "./blockComment";
import { deleteBlockDataForField, setBlockDataForField } from "../../fields";
import { getBlockDataForField } from "../../fields/field_utils";
import { TextInputBubble } from "./textinput_bubble";

const eventUtils = Blockly.Events;

// makecode fields generated from functions always use valid JavaScript
// identifiers for their names. starting the name with a ~ prevents us
// from colliding with those fields
const REVIEW_COMMENT_OFFSET_X_FIELD_NAME = "~reviewCommentOffsetX";
const REVIEW_COMMENT_OFFSET_Y_FIELD_NAME = "~reviewCommentOffsetY";

const REVIEW_COMMENT_BUBBLE_WIDTH_FIELD_NAME = "~reviewCommentWidth";
const REVIEW_COMMENT_HEIGHT_FIELD_NAME = "~reviewCommentHeight";

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
        this.setInitialValues();
    }

    setInitialValues() {
        this.text = getBlockDataForField(this.sourceBlock, REVIEW_COMMENT_FIELD_NAME) || "";

        const bubbleWidth = parseInt(getBlockDataForField(this.sourceBlock, REVIEW_COMMENT_BUBBLE_WIDTH_FIELD_NAME) || "0");
        const bubbleHeight = parseInt(getBlockDataForField(this.sourceBlock, REVIEW_COMMENT_HEIGHT_FIELD_NAME) || "0");
        if (bubbleWidth && bubbleHeight) {
            this.setBubbleSize(new Blockly.utils.Size(bubbleWidth, bubbleHeight));
        }

        this.setBubbleVisible(!!this.text);
    }
    override initView(pointerdownListener: (e: PointerEvent) => void): void {
        if (this.svgRoot) return; // Already initialized.

        super.initView(pointerdownListener);

        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.PATH,
            {
                'class': 'blocklyIconShape',
                'd': 'm 2,2 0,9.2211 3.0026599,0 1.6008929,1.5989 1.8138195,-1.5989 6.6046683,0 0,-9.2211 -13.0220406,0 z',
                'style': 'fill: #fff;'
            },
            this.svgRoot
        );
        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.PATH,
            {
                'class': 'blocklyIconSymbol',
                'd': 'm 17 2 -9 9 0 2 2 0 9 -9 z',
                'style': 'fill: #575E75;'
            },
            this.svgRoot
        );
        Blockly.utils.dom.addClass(this.svgRoot!, 'blockly-icon-comment');
        Blockly.utils.dom.addClass(this.svgRoot!, 'blockly-icon-review-comment');
    }

    override getType(): Blockly.icons.IconType<CommentIcon> {
        return REVIEW_COMMENT_ICON_TYPE;
    }

    override applyColour(): void {
        super.applyColour();
        const colour = "#00b4cc"; // "#7bd3ed";
        const borderColour = "#00b4cc"; // "#0d4b5e";
        this.textInputBubble?.setColour(colour, borderColour);
    }

    // Function to allow subclasses to override the creation of the text input bubble
    override createTextInputBubble(readOnly: boolean): TextInputBubble {

        // TODO thsparks - add username as header if logged in, or "Feedback" if not.
        // TODO thsparks - also maybe return readonly version of bubble if username doesn't match header username. Idk.

        const tib = new TextInputBubble(
            this.sourceBlock.workspace as Blockly.WorkspaceSvg,
            this.getAnchorLocation(),
            this.getBubbleOwnerRect(),
            false, // Ignore readonly flag. TODO thsparks, use readOnly || pxt.shell.isReviewMode()
            ["reviewCommentBubble"],
            lf("Feedback"),
        );
        return tib;
    }

    protected override showEditableBubble(): void {
        super.showEditableBubble();

        // We have to override this method to prevent the setCommentText(null) call
        // and replace it with a call to update the data field, and to remove the icon.
        this.textInputBubble.setDeleteHandler(() => {
            this.setBubbleVisible(false);
            this.clearAllData();
            this.sourceBlock.removeIcon(REVIEW_COMMENT_ICON_TYPE);
        });
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

        const oldText = this.text;
        setBlockDataForField(this.sourceBlock, REVIEW_COMMENT_FIELD_NAME, text);
        this.text = text;
        this.textInputBubble?.setText(this.text);

        // Fire change event to save file
        eventUtils.fire(
            new (eventUtils.get(eventUtils.BLOCK_CHANGE))(
                this.sourceBlock,
                REVIEW_COMMENT_FIELD_NAME,
                null,
                oldText,
                text,
            ),
        );
    }

    /**
     * Updates the text of this comment in response to changes in the text of
     * the input bubble.
     */
    override onTextChange(): void {
        if (!this.textInputBubble) return;

        const oldText = this.text;
        const newText = this.textInputBubble.getText();
        if (this.text === newText) return;

        setBlockDataForField(this.sourceBlock, REVIEW_COMMENT_FIELD_NAME, newText);
        this.text = newText;

        // Fire change event to save file
        eventUtils.fire(
            new (eventUtils.get(eventUtils.BLOCK_CHANGE))(
                this.sourceBlock,
                REVIEW_COMMENT_FIELD_NAME,
                null,
                oldText,
                newText,
            ),
        );
    }

    clearAllData(): void {
        this.clearSavedOffsetData();
        deleteBlockDataForField(this.sourceBlock, REVIEW_COMMENT_FIELD_NAME);
    }

    override onSizeChange(): void {
        super.onSizeChange();
        this.updateSizeData();
    }

    override setBubbleSize(size: Blockly.utils.Size): void {
        super.setBubbleSize(size);
        this.updateSizeData();
    }

    updateSizeData() {
        if (this.textInputBubble) {
            setBlockDataForField(this.sourceBlock, REVIEW_COMMENT_BUBBLE_WIDTH_FIELD_NAME, this.textInputBubble.getSize().width + "");
            setBlockDataForField(this.sourceBlock, REVIEW_COMMENT_HEIGHT_FIELD_NAME, this.textInputBubble.getSize().height + "");
        }
    }
}

Blockly.icons.registry.register(REVIEW_COMMENT_ICON_TYPE, ReviewCommentIcon);

Blockly.Css.register(`
    .blocklyTextInputBubble.reviewCommentBubble .blocklyTextarea {
      background-color: #c7f8ff;
    }

    .blockly-icon-comment.blockly-icon-review-comment {
        opacity: 0.9;
    }
`);
