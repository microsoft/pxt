import * as Blockly from "blockly";

import { TextInputBubble } from "./textinput_bubble";
import { deleteBlockDataForField, getBlockDataForField, setBlockDataForField } from "../../fields";

const eventUtils = Blockly.Events;

/** The size of the comment icon in workspace-scale units. */
const SIZE = 17;

/** The default width in workspace-scale units of the text input bubble. */
const DEFAULT_BUBBLE_WIDTH = 160;

/** The default height in workspace-scale units of the text input bubble. */
const DEFAULT_BUBBLE_HEIGHT = 80;

// makecode fields generated from functions always use valid JavaScript
// identifiers for their names. starting the name with a ~ prevents us
// from colliding with those fields
const COMMENT_OFFSET_X_FIELD_NAME = "~commentOffsetX";
const COMMENT_OFFSET_Y_FIELD_NAME = "~commentOffsetY";

/**
 * An icon which allows the user to add comment text to a block.
 */
export class CommentIcon extends Blockly.icons.Icon {
    /** The type string used to identify this icon. */
    static readonly TYPE = Blockly.icons.IconType.COMMENT;

    /**
     * The weight this icon has relative to other icons. Icons with more positive
     * weight values are rendered farther toward the end of the block.
     */
    static readonly WEIGHT = 3;

    /** The bubble used to show editable text to the user. */
    private textInputBubble: TextInputBubble | null = null;

    /** The text of this comment. */
    private text = '';

    /** The size of this comment (which is applied to the editable bubble). */
    private bubbleSize = new Blockly.utils.Size(DEFAULT_BUBBLE_WIDTH, DEFAULT_BUBBLE_HEIGHT);

    /**
     * The visibility of the bubble for this comment.
     *
     * This is used to track what the visibile state /should/ be, not necessarily
     * what it currently /is/. E.g. sometimes this will be true, but the block
     * hasn't been rendered yet, so the bubble will not currently be visible.
     */
    private bubbleVisiblity = false;

    constructor(protected readonly sourceBlock: Blockly.Block) {
        super(sourceBlock);
    }

    override getType(): Blockly.icons.IconType<CommentIcon> {
        return CommentIcon.TYPE;
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
        Blockly.utils.dom.createSvgElement('rect',
            {
                'class': 'blocklyIconSymbol',
                'x': '4',
                'y': '8',
                'height': '1',
                'width': '6',
                'style': 'fill: #575E75;'
            },
            this.svgRoot
        );
        // Dot of question mark.
        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.RECT,
            {
                'class': 'blocklyIconSymbol',
                'x': '4',
                'y': '6',
                'height': '1',
                'width': '6',
                'style': 'fill: #575E75;'
            },
            this.svgRoot
        );
        Blockly.utils.dom.createSvgElement('rect',
            {
                'class': 'blocklyIconSymbol',
                'x': '4',
                'y': '4',
                'height': '1',
                'width': '8',
                'style': 'fill: #575E75;'
            },
            this.svgRoot
        );
        Blockly.utils.dom.addClass(this.svgRoot!, 'blockly-icon-comment');
    }

    override dispose() {
        super.dispose();
        this.textInputBubble?.dispose();
    }

    override getWeight(): number {
        return CommentIcon.WEIGHT;
    }

    override getSize(): Blockly.utils.Size {
        return new Blockly.utils.Size(SIZE, SIZE);
    }

    override applyColour(): void {
        super.applyColour();
        const colour = (this.sourceBlock as Blockly.BlockSvg).style.colourPrimary;
        const borderColour = (this.sourceBlock as Blockly.BlockSvg).style.colourTertiary;
        this.textInputBubble?.setColour(colour, borderColour);
    }

    /**
     * Updates the state of the bubble (editable / noneditable) to reflect the
     * state of the bubble if the bubble is currently shown.
     */
    override async updateEditable(): Promise<void> {
        super.updateEditable();
        if (this.bubbleIsVisible()) {
            // Close and reopen the bubble to display the correct UI.
            await this.setBubbleVisible(false);
            await this.setBubbleVisible(true);
        }
    }

    override onLocationChange(blockOrigin: Blockly.utils.Coordinate): void {
        super.onLocationChange(blockOrigin);
        const anchorLocation = this.getAnchorLocation();
        this.textInputBubble?.setAnchorLocation(anchorLocation);
    }

    /** Sets the text of this comment. Updates any bubbles if they are visible. */
    setText(text: string) {
        // Blockly comments are omitted from XML serialization if they're empty.
        // In that case, they won't be present in the saved XML but any comment offset
        // data that was previously saved will be since it's a part of the block's
        // serialized data and not the comment's. In order to prevent that orphaned save
        // data from persisting, we need to clear it when the user creates a new comment.

        // If setText is called with the empty string while our text is already the
        // empty string, that means that this comment is newly created and we can safely
        // clear any pre-existing saved offset data.
        if (!this.text && !text) {
            this.clearSavedOffsetData();
        }

        const oldText = this.text;
        eventUtils.fire(
            new (eventUtils.get(eventUtils.BLOCK_CHANGE))(
                this.sourceBlock,
                'comment',
                null,
                oldText,
                text,
            ),
        );
        this.text = text;
        this.textInputBubble?.setText(this.text);
    }

    /** Returns the text of this comment. */
    getText(): string {
        return this.text;
    }

    /**
     * Sets the size of the editable bubble for this comment. Resizes the
     * bubble if it is visible.
     */
    setBubbleSize(size: Blockly.utils.Size) {
        this.bubbleSize = size;
        this.textInputBubble?.setSize(this.bubbleSize, true);
    }

    /** @returns the size of the editable bubble for this comment. */
    getBubbleSize(): Blockly.utils.Size {
        return this.bubbleSize;
    }

    /**
     * @returns the state of the comment as a JSON serializable value if the
     * comment has text. Otherwise returns null.
     */
    saveState(): CommentState | null {
        if (this.text) {
            return {
                'text': this.text,
                'pinned': this.bubbleIsVisible(),
                'height': this.bubbleSize.height,
                'width': this.bubbleSize.width,
            };
        }
        return null;
    }

    /** Applies the given state to this comment. */
    loadState(state: CommentState) {
        this.text = state['text'] ?? '';
        this.bubbleSize = new Blockly.utils.Size(
            state['width'] ?? DEFAULT_BUBBLE_WIDTH,
            state['height'] ?? DEFAULT_BUBBLE_HEIGHT,
        );
        this.bubbleVisiblity = state['pinned'] ?? false;
        this.setBubbleVisible(this.bubbleVisiblity);
    }

    // TODO: switch our custom comment position serialization
    // to use setBubbleLocation and getBubbleLocation instead
    setBubbleLocation(location: Blockly.utils.Coordinate) {

    }

    // TODO: switch our custom comment position serialization
    // to use setBubbleLocation and getBubbleLocation instead
    getBubbleLocation(): Blockly.utils.Coordinate | undefined {
        if (this.bubbleIsVisible()) {
            return this.textInputBubble.getRelativeToSurfaceXY();
        }
        return undefined
    }

    override onClick(): void {
        super.onClick();
        this.setBubbleVisible(!this.bubbleIsVisible());
    }

    override isClickableInFlyout(): boolean {
        return false;
    }

    /**
     * Updates the text of this comment in response to changes in the text of
     * the input bubble.
     */
    onTextChange(): void {
        if (!this.textInputBubble) return;

        const newText = this.textInputBubble.getText();
        if (this.text === newText) return;

        eventUtils.fire(
            new (eventUtils.get(eventUtils.BLOCK_CHANGE))(
                this.sourceBlock,
                'comment',
                null,
                this.text,
                newText,
            ),
        );
        this.text = newText;
    }

    /**
     * Updates the size of this icon in response to changes in the size of the
     * input bubble.
     */
    onSizeChange(): void {
        if (this.textInputBubble) {
            this.bubbleSize = this.textInputBubble.getSize();
        }
    }

    onPositionChange(): void {
        if (this.textInputBubble) {
            const coord = this.textInputBubble.getPositionRelativeToAnchor();

            setBlockDataForField(this.sourceBlock, COMMENT_OFFSET_X_FIELD_NAME, coord.x + "");
            setBlockDataForField(this.sourceBlock, COMMENT_OFFSET_Y_FIELD_NAME, coord.y + "");
        }
    }

    bubbleIsVisible(): boolean {
        return this.bubbleVisiblity;
    }

    async setBubbleVisible(visible: boolean): Promise<void> {
        if (this.bubbleVisiblity === visible) return;
        if (visible && this.textInputBubble) return;
        if (!visible && !this.textInputBubble) return;

        this.bubbleVisiblity = visible;

        if (!this.sourceBlock.rendered || this.sourceBlock.isInFlyout || this.sourceBlock.isInsertionMarker()) return;

        await Blockly.renderManagement.finishQueuedRenders();

        if (!this.sourceBlock.rendered || this.sourceBlock.isInFlyout || this.sourceBlock.isInsertionMarker()) return;


        if (visible) {
            if (this.sourceBlock.isEditable()) {
                this.showEditableBubble();
            } else {
                this.showNonEditableBubble();
            }
            this.applyColour();
        } else {
            this.hideBubble();
        }

        if (this.sourceBlock.isEditable()) {
            eventUtils.fire(
                new (eventUtils.get(eventUtils.BUBBLE_OPEN))(
                    this.sourceBlock,
                    visible,
                    'comment',
                ),
            );
        }
    }

    /**
     * Shows the editable text bubble for this comment, and adds change listeners
     * to update the state of this icon in response to changes in the bubble.
     */
    private showEditableBubble() {
        const savedPosition = this.getSavedOffsetData();
        this.textInputBubble = new TextInputBubble(
            this.sourceBlock.workspace as Blockly.WorkspaceSvg,
            this.getAnchorLocation(),
            this.getBubbleOwnerRect(),
        );
        this.textInputBubble.setText(this.getText());
        this.textInputBubble.setSize(this.bubbleSize, true);
        this.textInputBubble.addTextChangeListener(() => this.onTextChange());
        this.textInputBubble.addSizeChangeListener(() => this.onSizeChange());
        this.textInputBubble.addPositionChangeListener(() => this.onPositionChange());
        this.textInputBubble.setDeleteHandler(() => {
            this.setBubbleVisible(false);
            this.sourceBlock.setCommentText(null);
            this.clearSavedOffsetData();
        });
        this.textInputBubble.setCollapseHandler(() => {
            this.setBubbleVisible(false);
        });

        if (savedPosition) {
            this.textInputBubble.setPositionRelativeToAnchor(savedPosition.x, savedPosition.y);
        }
    }

    /** Shows the non editable text bubble for this comment. */
    private showNonEditableBubble() {
        const savedPosition = this.getSavedOffsetData();
        this.textInputBubble = new TextInputBubble(
            this.sourceBlock.workspace as Blockly.WorkspaceSvg,
            this.getAnchorLocation(),
            this.getBubbleOwnerRect(),
            true
        );
        this.textInputBubble.setText(this.getText());
        this.textInputBubble.setSize(this.bubbleSize, true);
        this.textInputBubble.setCollapseHandler(() => {
            this.setBubbleVisible(false);
        });
        if (savedPosition) {
            this.textInputBubble.setPositionRelativeToAnchor(savedPosition.x, savedPosition.y);
        }
    }

    /** Hides any open bubbles owned by this comment. */
    private hideBubble() {
        this.textInputBubble?.dispose();
        this.textInputBubble = null;
    }

    /**
     * @returns the location the bubble should be anchored to.
     *     I.E. the middle of this icon.
     */
    private getAnchorLocation(): Blockly.utils.Coordinate {
        const midIcon = SIZE / 2;
        return Blockly.utils.Coordinate.sum(
            this.workspaceLocation,
            new Blockly.utils.Coordinate(midIcon, midIcon),
        );
    }

    /**
     * @returns the rect the bubble should avoid overlapping.
     *     I.E. the block that owns this icon.
     */
    private getBubbleOwnerRect(): Blockly.utils.Rect {
        const bbox = (this.sourceBlock as Blockly.BlockSvg).getSvgRoot().getBBox();
        return new Blockly.utils.Rect(bbox.y, bbox.y + bbox.height, bbox.x, bbox.x + bbox.width);
    }

    private getSavedOffsetData(): Blockly.utils.Coordinate | undefined {
        const offsetX = getBlockDataForField(this.sourceBlock, COMMENT_OFFSET_X_FIELD_NAME);
        const offsetY = getBlockDataForField(this.sourceBlock, COMMENT_OFFSET_Y_FIELD_NAME);

        if (offsetX && offsetY) {
            return new Blockly.utils.Coordinate(
                parseFloat(offsetX),
                parseFloat(offsetY)
            );
        }

        return new Blockly.utils.Coordinate(16, 16);
    }

    private clearSavedOffsetData() {
        deleteBlockDataForField(this.sourceBlock, COMMENT_OFFSET_X_FIELD_NAME);
        deleteBlockDataForField(this.sourceBlock, COMMENT_OFFSET_Y_FIELD_NAME);
    }
}

/** The save state format for a comment icon. */
export interface CommentState {
    /** The text of the comment. */
    text?: string;

    /** True if the comment is open, false otherwise. */
    pinned?: boolean;

    /** The height of the comment bubble. */
    height?: number;

    /** The width of the comment bubble. */
    width?: number;
}

Blockly.icons.registry.unregister(CommentIcon.TYPE.toString());
Blockly.icons.registry.register(CommentIcon.TYPE, CommentIcon);