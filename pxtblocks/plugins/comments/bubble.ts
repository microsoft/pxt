import * as Blockly from "blockly";

import dom = Blockly.utils.dom;

/**
 * The abstract pop-up bubble class. This creates a UI that looks like a speech
 * bubble, where it has a "tail" that points to the block, and a "head" that
 * displays arbitrary svg elements.
 */
export abstract class Bubble implements Blockly.IDeletable, Blockly.IBubble, Blockly.ISelectable {
    /** The width of the border around the bubble. */
    static readonly BORDER_WIDTH = 0;

    /** Double the width of the border around the bubble. */
    static readonly DOUBLE_BORDER = this.BORDER_WIDTH * 2;

    /** The minimum size the bubble can have. */
    static readonly MIN_SIZE = this.DOUBLE_BORDER;

    /** Distance between arrow point and anchor point. */
    static readonly ANCHOR_RADIUS = 8;

    public id: string;

    /** The SVG group containing all parts of the bubble. */
    protected svgRoot: SVGGElement;

    /** The SVG path for the arrow from the anchor to the bubble. */
    private tail: SVGLineElement;

    /** The SVG background rect for the main body of the bubble. */
    private background: SVGRectElement;

    /** The SVG group containing the contents of the bubble. */
    protected contentContainer: SVGGElement;

    /**
     * The size of the bubble (including background and contents but not tail).
     */
    private size = new Blockly.utils.Size(0, 0);

    /** The colour of the background of the bubble. */
    private colour = '#ffffff';

    /** True if the bubble has been disposed, false otherwise. */
    public disposed = false;

    /** The position of the top of the bubble relative to its anchor. */
    private relativeTop = 0;

    /** The position of the left of the bubble realtive to its anchor. */
    private relativeLeft = 0;

    private dragStrategy = new Blockly.dragging.BubbleDragStrategy(this, this.workspace);


    private topBar: SVGRectElement;

    protected deleteIcon: SVGImageElement;

    private collapseIcon: SVGImageElement;

    private collapseHandler: () => void;
    private deleteHandler: () => void;

    private isDragDelete: boolean;

    /**
     * @param workspace The workspace this bubble belongs to.
     * @param anchor The anchor location of the thing this bubble is attached to.
     *     The tail of the bubble will point to this location.
     * @param ownerRect An optional rect we don't want the bubble to overlap with
     *     when automatically positioning.
     */
    constructor(
        public readonly workspace: Blockly.WorkspaceSvg,
        protected anchor: Blockly.utils.Coordinate,
        protected ownerRect?: Blockly.utils.Rect,
    ) {
        this.id = Blockly.utils.idGenerator.getNextUniqueId();
        this.svgRoot = dom.createSvgElement(
            Blockly.utils.Svg.G,
            { 'class': 'blocklyBubble' },
            workspace.getBubbleCanvas(),
        );
        const embossGroup = dom.createSvgElement(
            Blockly.utils.Svg.G,
            {
                // 'filter': `url(#${this.workspace.getRenderer().getConstants().embossFilterId
                //     })`,
            },
            this.svgRoot,
        );
        this.tail = dom.createSvgElement(
            Blockly.utils.Svg.LINE,
            {
                'stroke-width': '3',
                'stroke-linecap': 'round'
            },
            embossGroup,
        );
        this.background = dom.createSvgElement(
            Blockly.utils.Svg.RECT,
            {
                'class': 'blocklyDraggable',
                'stroke-width': '3',
                'x': 0,
                'y': 0
            },
            embossGroup,
        );
        this.contentContainer = dom.createSvgElement(Blockly.utils.Svg.G, {}, this.svgRoot);

        this.topBar = dom.createSvgElement(
            Blockly.utils.Svg.RECT,
            {
                'class': 'blocklyCommentTopbarBackground',
                'x': Bubble.BORDER_WIDTH,
                'y': Bubble.BORDER_WIDTH
            },
            embossGroup
        );

        this.deleteIcon = dom.createSvgElement(
            Blockly.utils.Svg.IMAGE,
            {
                'class': 'blocklyDeleteIcon',
                'href': `${workspace.options.pathToMedia}delete-icon.svg`,
            },
            embossGroup
        );

        this.collapseIcon = dom.createSvgElement(
            Blockly.utils.Svg.IMAGE,
            {
                'class': 'blocklyFoldoutIcon',
                'href': `${workspace.options.pathToMedia}foldout-icon.svg`,
            },
            embossGroup
        );

        Blockly.browserEvents.conditionalBind(
            this.background,
            'pointerdown',
            this,
            this.onMouseDown,
        );

        Blockly.browserEvents.conditionalBind(
            this.topBar,
            'pointerdown',
            this,
            this.onMouseDown,
        );

        Blockly.browserEvents.conditionalBind(
            this.collapseIcon,
            'pointerdown',
            this,
            this.onCollapseDown,
        );
        Blockly.browserEvents.conditionalBind(
            this.deleteIcon,
            'pointerdown',
            this,
            this.onDeleteDown,
        );

    }

    /** Dispose of this bubble. */
    dispose() {
        if (this.disposed) return;

        dom.removeNode(this.svgRoot);
        this.disposed = true;

        if (this.isDragDelete && this.deleteHandler) {
            this.deleteHandler();
        }
    }

    /**
     * Set the location the tail of this bubble points to.
     *
     * @param anchor The location the tail of this bubble points to.
     * @param relayout If true, reposition the bubble from scratch so that it is
     *     optimally visible. If false, reposition it so it maintains the same
     *     position relative to the anchor.
     */
    setAnchorLocation(anchor: Blockly.utils.Coordinate, relayout = false) {
        this.anchor = anchor;
        if (relayout) {
            this.positionByRect(this.ownerRect);
        } else {
            this.positionRelativeToAnchor();
        }
        this.renderTail();
    }

    /** Sets the position of this bubble relative to its anchor. */
    setPositionRelativeToAnchor(left: number, top: number) {
        this.relativeLeft = left;
        this.relativeTop = top;
        this.positionRelativeToAnchor();
        this.renderTail();
    }

    getPositionRelativeToAnchor() {
        return new Blockly.utils.Coordinate(this.relativeLeft, this.relativeTop);
    }

    /** @returns the size of this bubble. */
    protected getSize() {
        return this.size;
    }

    /**
     * Sets the size of this bubble, including the border.
     *
     * @param size Sets the size of this bubble, including the border.
     * @param relayout If true, reposition the bubble from scratch so that it is
     *     optimally visible. If false, reposition it so it maintains the same
     *     position relative to the anchor.
     */
    protected setSize(size: Blockly.utils.Size, relayout = false) {
        const topBarSize = this.topBar.getBBox();
        const deleteSize = this.deleteIcon.getBBox();
        const foldoutSize = this.collapseIcon.getBBox();

        size.width = Math.max(size.width, Bubble.MIN_SIZE);
        size.height = Math.max(size.height, Bubble.MIN_SIZE);
        this.size = size;

        this.background.setAttribute('width', `${size.width}`);
        this.background.setAttribute('height', `${size.height}`);

        this.topBar.setAttribute('width', `${size.width - Bubble.DOUBLE_BORDER}`);

        this.updateDeleteIconPosition(size, topBarSize, deleteSize);
        this.updateFoldoutIconPosition(topBarSize, foldoutSize);

        if (relayout) {
            this.positionByRect(this.ownerRect);
        } else {
            this.positionRelativeToAnchor();
        }
        this.renderTail();
    }

    /** Returns the colour of the background and tail of this bubble. */
    protected getColour(): string {
        return this.colour;
    }

    /** Sets the colour of the background and tail of this bubble. */
    public setColour(colour: string, borderColour?: string) {
        this.colour = colour;
        this.tail.setAttribute('stroke', borderColour || colour);
        this.background.setAttribute('fill', borderColour || colour);
        this.background.setAttribute('stroke', borderColour || colour);

        this.svgRoot.setAttribute('style', `--commentBorderColour: ${colour}`)
    }

    /** Passes the pointer event off to the gesture system. */
    private onMouseDown(e: PointerEvent) {
        this.workspace.getGesture(e)?.handleBubbleStart(e, this);
        Blockly.common.setSelected(this);
    }

    /** Positions the bubble relative to its anchor. Does not render its tail. */
    protected positionRelativeToAnchor() {
        let left = this.anchor.x;
        if (this.workspace.RTL) {
            left -= this.relativeLeft + this.size.width;
        } else {
            left += this.relativeLeft;
        }
        const top = this.relativeTop + this.anchor.y;
        this.moveTo(left, top);
    }

    /**
     * Moves the bubble to the given coordinates.
     *
     * @internal
     */
    moveTo(x: number, y: number) {
        this.svgRoot.setAttribute('transform', `translate(${x}, ${y})`);
    }

    /**
     * Positions the bubble "optimally" so that the most of it is visible and
     * it does not overlap the rect (if provided).
     */
    protected positionByRect(rect = new Blockly.utils.Rect(0, 0, 0, 0)) {
        const viewMetrics = this.workspace.getMetricsManager().getViewMetrics(true);

        const optimalLeft = this.getOptimalRelativeLeft(viewMetrics);
        const optimalTop = this.getOptimalRelativeTop(viewMetrics);

        const topPosition = {
            x: optimalLeft,
            y: (-this.size.height -
                this.workspace.getRenderer().getConstants().MIN_BLOCK_HEIGHT) as number,
        };
        const startPosition = { x: -this.size.width - 30, y: optimalTop };
        const endPosition = { x: rect.getWidth(), y: optimalTop };
        const bottomPosition = { x: optimalLeft, y: rect.getHeight() };

        const closerPosition =
            rect.getWidth() < rect.getHeight() ? endPosition : bottomPosition;
        const fartherPosition =
            rect.getWidth() < rect.getHeight() ? bottomPosition : endPosition;

        const topPositionOverlap = this.getOverlap(topPosition, viewMetrics);
        const startPositionOverlap = this.getOverlap(startPosition, viewMetrics);
        const closerPositionOverlap = this.getOverlap(closerPosition, viewMetrics);
        const fartherPositionOverlap = this.getOverlap(
            fartherPosition,
            viewMetrics,
        );

        // Set the position to whichever position shows the most of the bubble,
        // with tiebreaks going in the order: top > start > close > far.
        const mostOverlap = Math.max(
            topPositionOverlap,
            startPositionOverlap,
            closerPositionOverlap,
            fartherPositionOverlap,
        );
        if (topPositionOverlap === mostOverlap) {
            this.relativeLeft = topPosition.x;
            this.relativeTop = topPosition.y;
            this.positionRelativeToAnchor();
            return;
        }
        if (startPositionOverlap === mostOverlap) {
            this.relativeLeft = startPosition.x;
            this.relativeTop = startPosition.y;
            this.positionRelativeToAnchor();
            return;
        }
        if (closerPositionOverlap === mostOverlap) {
            this.relativeLeft = closerPosition.x;
            this.relativeTop = closerPosition.y;
            this.positionRelativeToAnchor();
            return;
        }
        // TODO: I believe relativeLeft_ should actually be called relativeStart_
        //  and then the math should be fixed to reflect this. (hopefully it'll
        //  make it look simpler)
        this.relativeLeft = fartherPosition.x;
        this.relativeTop = fartherPosition.y;
        this.positionRelativeToAnchor();
    }

    /**
     * Calculate the what percentage of the bubble overlaps with the visible
     * workspace (what percentage of the bubble is visible).
     *
     * @param relativeMin The position of the top-left corner of the bubble
     *     relative to the anchor point.
     * @param viewMetrics The view metrics of the workspace the bubble will appear
     *     in.
     * @returns The percentage of the bubble that is visible.
     */
    private getOverlap(
        relativeMin: { x: number; y: number },
        viewMetrics: Blockly.MetricsManager.ContainerRegion,
    ): number {
        // The position of the top-left corner of the bubble in workspace units.
        const bubbleMin = {
            x: this.workspace.RTL
                ? this.anchor.x - relativeMin.x - this.size.width
                : relativeMin.x + this.anchor.x,
            y: relativeMin.y + this.anchor.y,
        };
        // The position of the bottom-right corner of the bubble in workspace units.
        const bubbleMax = {
            x: bubbleMin.x + this.size.width,
            y: bubbleMin.y + this.size.height,
        };

        // We could adjust these values to account for the scrollbars, but the
        // bubbles should have been adjusted to not collide with them anyway, so
        // giving the workspace a slightly larger "bounding box" shouldn't affect
        // the calculation.

        // The position of the top-left corner of the workspace.
        const workspaceMin = { x: viewMetrics.left, y: viewMetrics.top };
        // The position of the bottom-right corner of the workspace.
        const workspaceMax = {
            x: viewMetrics.left + viewMetrics.width,
            y: viewMetrics.top + viewMetrics.height,
        };

        const overlapWidth =
            Math.min(bubbleMax.x, workspaceMax.x) -
            Math.max(bubbleMin.x, workspaceMin.x);
        const overlapHeight =
            Math.min(bubbleMax.y, workspaceMax.y) -
            Math.max(bubbleMin.y, workspaceMin.y);
        return Math.max(
            0,
            Math.min(
                1,
                (overlapWidth * overlapHeight) / (this.size.width * this.size.height),
            ),
        );
    }

    /**
     * Calculate what the optimal horizontal position of the top-left corner of
     * the bubble is (relative to the anchor point) so that the most area of the
     * bubble is shown.
     *
     * @param viewMetrics The view metrics of the workspace the bubble will appear
     *     in.
     * @returns The optimal horizontal position of the top-left corner of the
     *     bubble.
     */
    private getOptimalRelativeLeft(viewMetrics: Blockly.MetricsManager.ContainerRegion): number {
        // By default, show the bubble just a bit to the left of the anchor.
        let relativeLeft = -this.size.width / 4;

        // No amount of sliding left or right will give us better overlap.
        if (this.size.width > viewMetrics.width) return relativeLeft;

        const workspaceRect = this.getWorkspaceViewRect(viewMetrics);

        if (this.workspace.RTL) {
            // Bubble coordinates are flipped in RTL.
            const bubbleRight = this.anchor.x - relativeLeft;
            const bubbleLeft = bubbleRight - this.size.width;

            if (bubbleLeft < workspaceRect.left) {
                // Slide the bubble right until it is onscreen.
                relativeLeft = -(workspaceRect.left - this.anchor.x + this.size.width);
            } else if (bubbleRight > workspaceRect.right) {
                // Slide the bubble left until it is onscreen.
                relativeLeft = -(workspaceRect.right - this.anchor.x);
            }
        } else {
            const bubbleLeft = relativeLeft + this.anchor.x;
            const bubbleRight = bubbleLeft + this.size.width;

            if (bubbleLeft < workspaceRect.left) {
                // Slide the bubble right until it is onscreen.
                relativeLeft = workspaceRect.left - this.anchor.x;
            } else if (bubbleRight > workspaceRect.right) {
                // Slide the bubble left until it is onscreen.
                relativeLeft = workspaceRect.right - this.anchor.x - this.size.width;
            }
        }

        return relativeLeft;
    }

    /**
     * Calculate what the optimal vertical position of the top-left corner of
     * the bubble is (relative to the anchor point) so that the most area of the
     * bubble is shown.
     *
     * @param viewMetrics The view metrics of the workspace the bubble will appear
     *     in.
     * @returns The optimal vertical position of the top-left corner of the
     *     bubble.
     */
    private getOptimalRelativeTop(viewMetrics: Blockly.MetricsManager.ContainerRegion): number {
        // By default, show the bubble just a bit higher than the anchor.
        let relativeTop = -this.size.height / 4;

        // No amount of sliding up or down will give us better overlap.
        if (this.size.height > viewMetrics.height) return relativeTop;

        const top = this.anchor.y + relativeTop;
        const bottom = top + this.size.height;
        const workspaceRect = this.getWorkspaceViewRect(viewMetrics);

        if (top < workspaceRect.top) {
            // Slide the bubble down until it is onscreen.
            relativeTop = workspaceRect.top - this.anchor.y;
        } else if (bottom > workspaceRect.bottom) {
            // Slide the bubble up until it is onscreen.
            relativeTop = workspaceRect.bottom - this.anchor.y - this.size.height;
        }

        return relativeTop;
    }

    /**
     * @returns a rect defining the bounds of the workspace's view in workspace
     * coordinates.
     */
    private getWorkspaceViewRect(viewMetrics: Blockly.MetricsManager.ContainerRegion): Blockly.utils.Rect {
        const top = viewMetrics.top;
        let bottom = viewMetrics.top + viewMetrics.height;
        let left = viewMetrics.left;
        let right = viewMetrics.left + viewMetrics.width;

        bottom -= this.getScrollbarThickness();
        if (this.workspace.RTL) {
            left -= this.getScrollbarThickness();
        } else {
            right -= this.getScrollbarThickness();
        }

        return new Blockly.utils.Rect(top, bottom, left, right);
    }

    /** @returns the scrollbar thickness in workspace units. */
    private getScrollbarThickness() {
        return Blockly.Scrollbar.scrollbarThickness / this.workspace.scale;
    }

    /** Draws the tail of the bubble. */
    private renderTail() {
        // Find the relative coordinates of the center of the bubble.
        const relBubbleX = this.size.width / 2;
        const relBubbleY = this.size.height / 2;
        // Find the relative coordinates of the center of the anchor.
        let relAnchorX = -this.relativeLeft;
        let relAnchorY = -this.relativeTop;

        const angle = Math.atan2(relBubbleY - relAnchorY, relBubbleX - relAnchorX);

        relAnchorX += Bubble.ANCHOR_RADIUS * Math.cos(angle);
        relAnchorY += Bubble.ANCHOR_RADIUS * Math.sin(angle);

        this.tail.setAttribute("x1", relBubbleX + "");
        this.tail.setAttribute("y1", relBubbleY + "");

        this.tail.setAttribute("x2", relAnchorX + "");
        this.tail.setAttribute("y2", relAnchorY + "");
    }
    /**
     * Move this bubble to the front of the visible workspace.
     *
     * @returns Whether or not the bubble has been moved.
     * @internal
     */
    bringToFront(): boolean {
        const svgGroup = this.svgRoot?.parentNode;
        if (this.svgRoot && svgGroup?.lastChild !== this.svgRoot) {
            svgGroup?.appendChild(this.svgRoot);
            return true;
        }
        return false;
    }

    /** @internal */
    getRelativeToSurfaceXY(): Blockly.utils.Coordinate {
        return new Blockly.utils.Coordinate(
            this.workspace.RTL
                ? -this.relativeLeft + this.anchor.x - this.size.width
                : this.anchor.x + this.relativeLeft,
            this.anchor.y + this.relativeTop,
        );
    }

    /** @internal */
    getSvgRoot(): SVGElement {
        return this.svgRoot;
    }

    /**
     * Move this bubble during a drag.
     *
     * @param newLoc The location to translate to, in workspace coordinates.
     * @internal
     */
    moveDuringDrag(newLoc: Blockly.utils.Coordinate) {
        this.moveTo(newLoc.x, newLoc.y);
        if (this.workspace.RTL) {
            this.relativeLeft = this.anchor.x - newLoc.x - this.size.width;
        } else {
            this.relativeLeft = newLoc.x - this.anchor.x;
        }
        this.relativeTop = newLoc.y - this.anchor.y;
        this.renderTail();
    }

    setDragging(_start: boolean) {
        // NOOP in base class.
    }

    /** @internal */
    setDeleteStyle(wouldDelete: boolean) {
        this.isDragDelete = wouldDelete;
        if (wouldDelete) {
            dom.addClass(this.getSvgRoot(), 'blocklyDraggingDelete');
        } else {
            dom.removeClass(this.getSvgRoot(), 'blocklyDraggingDelete');
        }
    }

    /** @internal */
    isDeletable(): boolean {
        return false;
    }

    /** @internal */
    showContextMenu(_e: Event) {
        // NOOP in base class.
    }

    /** Returns whether this bubble is movable or not. */
    isMovable(): boolean {
        return true;
    }

    /** Starts a drag on the bubble. */
    startDrag(): void {
        this.dragStrategy.startDrag();
    }

    /** Drags the bubble to the given location. */
    drag(newLoc: Blockly.utils.Coordinate): void {
        this.dragStrategy.drag(newLoc);
    }

    /** Ends the drag on the bubble. */
    endDrag(): void {
        this.dragStrategy.endDrag();
    }

    /** Moves the bubble back to where it was at the start of a drag. */
    revertDrag(): void {
        this.dragStrategy.revertDrag();
    }

    select(): void {
        // Bubbles don't have any visual for being selected.
    }

    unselect(): void {
        // Bubbles don't have any visual for being selected.
    }

    /** See IFocusableNode.getFocusableElement. */
    getFocusableElement(): HTMLElement | SVGElement {
      return this.svgRoot;
    }

    /** See IFocusableNode.getFocusableTree. */
    getFocusableTree(): Blockly.IFocusableTree {
        return this.workspace;
    }

    /** See IFocusableNode.onNodeFocus. */
    onNodeFocus(): void {
        this.select();
        this.bringToFront();
    }

    /** See IFocusableNode.onNodeBlur. */
    onNodeBlur(): void {
        this.unselect();
    }

    /** See IFocusableNode.canBeFocused. */
    canBeFocused(): boolean {
        return true;
    }

    contentTop() {
        const topBarSize = this.topBar.getBBox();
        return Bubble.BORDER_WIDTH + topBarSize.height
    }

    setDeleteHandler(handler: () => void) {
        this.deleteHandler = handler;
    }

    setCollapseHandler(handler: () => void) {
        this.collapseHandler = handler;
    }

    private onDeleteDown(e: PointerEvent) {
        if (Blockly.browserEvents.isRightButton(e)) {
            e.stopPropagation();
            return;
        }

        if (this.deleteHandler) {
            this.deleteHandler();
        }
        e.stopPropagation();
    }

    private onCollapseDown(e: PointerEvent) {
        if (Blockly.browserEvents.isRightButton(e)) {
            e.stopPropagation();
            return;
        }

        if (this.collapseHandler) {
            this.collapseHandler();
        }
        e.stopPropagation();
    }

    /**
     * Updates the position of the delete icon elements to reflect the new size.
     */
    private updateDeleteIconPosition(
        size: Blockly.utils.Size,
        topBarSize: Blockly.utils.Size,
        deleteSize: Blockly.utils.Size,
    ) {
        const deleteMargin = this.calcDeleteMargin(topBarSize, deleteSize);
        this.deleteIcon.setAttribute('y', `${deleteMargin}`);
        this.deleteIcon.setAttribute(
            'x',
            `${size.width - deleteSize.width - deleteMargin}`,
        );
    }

    /**
     * Updates the position of the foldout icon elements to reflect the new size.
     */
    private updateFoldoutIconPosition(topBarSize: Blockly.utils.Size, foldoutSize: Blockly.utils.Size) {
        const foldoutMargin = this.calcFoldoutMargin(topBarSize, foldoutSize);
        this.collapseIcon.setAttribute('y', `${foldoutMargin}`);
        this.collapseIcon.setAttribute('x', `${foldoutMargin}`);
    }

    /** Calculates the margin that should exist around the delete icon. */
    private calcDeleteMargin(topBarSize: Blockly.utils.Size, deleteSize: Blockly.utils.Size) {
        return ((topBarSize.height - deleteSize.height) / 2) + Bubble.BORDER_WIDTH;
    }

    /** Calculates the margin that should exist around the foldout icon. */
    private calcFoldoutMargin(topBarSize: Blockly.utils.Size, foldoutSize: Blockly.utils.Size) {
        return ((topBarSize.height - foldoutSize.height) / 2) + Bubble.BORDER_WIDTH;
    }
}

Blockly.Css.register(`
.blocklyBubble .blocklyDeleteIcon, .blocklyBubble .blocklyFoldoutIcon {
    filter: grayscale(100%) brightness(100000);
}

.blocklyBubble .blocklyTextarea.blocklyText {
    color: #575E75;
}
`);