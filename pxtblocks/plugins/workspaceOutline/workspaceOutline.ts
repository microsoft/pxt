import * as Blockly from "blockly";
import { UiMetrics } from "blockly/core/metrics_manager";

export class OpenWorkspaceOutlineButton implements Blockly.IPositionable {
    // Unique string to identify the element
    id: string = "openWorkspaceOutlineButton";

    protected initialized = false;
    protected outlineFlyout: WorkspaceOutlineFlyout;
    protected svgRoot: SVGElement;
    protected svgImg: SVGImageElement;
    protected flyoutDefinition: Blockly.utils.toolbox.FlyoutDefinition;

    /** Left coordinate in pixels. */
    protected left = 0;

    /** Top coordinate in pixels. */
    protected top = 0;

    /** Width in pixels. Used for clip path. */
    protected readonly WIDTH = 40;

    /** Height in pixels. Used for clip path. */
    protected readonly HEIGHT = 60;

    /** Distance from bottom/top edge of workspace in pixels. */
    protected readonly MARGIN_VERTICAL = 20;

    /** Distance from right/left edge of workspace in pixels. */
    protected readonly MARGIN_HORIZONTAL = 20;

    /** Extent of hotspot on all sides beyond the size of the button in pixels. */
    protected readonly HOTSPOT_MARGIN = 10;

    /** Array holding info needed to unbind events. Used for disposing. */
    private boundEvents: Blockly.browserEvents.Data[] = [];

    /**
     * Constructor for a backpack.
     * @param workspace The target workspace that the button will be added to.
     */
    constructor(protected workspace: Blockly.WorkspaceSvg) {}

    /**
     * Initializes the open outline button.
     */
    init() {
        this.workspace.getComponentManager().addComponent({
            component: this,
            weight: 2,
            capabilities: [Blockly.ComponentManager.Capability.POSITIONABLE],
        });
        this.initFlyout();
        this.createDom();
        // this.attachListeners();
        // registerContextMenus(this.options.contextMenu, this.workspace);
        this.initialized = true;
        this.workspace.resize();
    }

    protected initFlyout() {
        // Create flyout options.
        const flyoutWorkspaceOptions = new Blockly.Options({
            scrollbars: true,
            parentWorkspace: this.workspace,
            rtl: !this.workspace.RTL,
            oneBasedIndex: this.workspace.options.oneBasedIndex,
            renderer: this.workspace.options.renderer,
            rendererOverrides: this.workspace.options.rendererOverrides || undefined,
            move: {
                scrollbars: true,
            },
        });

        // Create vertical or horizontal flyout.
        if (this.workspace.horizontalLayout) {
            flyoutWorkspaceOptions.toolboxPosition =
                this.workspace.toolboxPosition === Blockly.utils.toolbox.Position.TOP
                    ? Blockly.utils.toolbox.Position.BOTTOM
                    : Blockly.utils.toolbox.Position.TOP;
            const HorizontalFlyout = Blockly.registry.getClassFromOptions(
                Blockly.registry.Type.FLYOUTS_HORIZONTAL_TOOLBOX,
                this.workspace.options,
                true
            );
            if (HorizontalFlyout) {
                this.outlineFlyout = new WorkspaceOutlineFlyout(flyoutWorkspaceOptions);
            } else {
                throw new Error("HorizontalFlyout does not exist");
            }
        } else {
            flyoutWorkspaceOptions.toolboxPosition =
                this.workspace.toolboxPosition === Blockly.utils.toolbox.Position.RIGHT
                    ? Blockly.utils.toolbox.Position.LEFT
                    : Blockly.utils.toolbox.Position.RIGHT;
            const VerticalFlyout = Blockly.registry.getClassFromOptions(
                Blockly.registry.Type.FLYOUTS_VERTICAL_TOOLBOX,
                this.workspace.options,
                true
            );
            if (VerticalFlyout) {
                this.outlineFlyout = new WorkspaceOutlineFlyout(flyoutWorkspaceOptions);
            } else {
                throw new Error("VerticalFlyout does not exist");
            }
        }
        // Add flyout to DOM.
        const parentNode = this.workspace.getParentSvg().parentNode;
        parentNode?.appendChild(this.outlineFlyout?.createDom(Blockly.utils.Svg.SVG));
        this.outlineFlyout.init(this.workspace);
    }

    /**
     * Creates DOM for UI element.
     */
    protected createDom() {
        if (this.svgRoot) return; // Already initialized

        // G svg element used to group other elements: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/g
        this.svgRoot = Blockly.utils.dom.createSvgElement(Blockly.utils.Svg.G, {}, null);

        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.PATH,
            {
                class: "blocklyIconShape",
                d: "m 2,2 0,9.2211 3.0026599,0 1.6008929,1.5989 1.8138195,-1.5989 6.6046683,0 0,-9.2211 -13.0220406,0 z",
                style: "fill: #fff;",
            },
            this.svgRoot
        );
        Blockly.utils.dom.createSvgElement(
            "rect",
            {
                class: "blocklyIconSymbol",
                x: "4",
                y: "8",
                height: "1",
                width: "6",
                style: "fill: #575E75;",
            },
            this.svgRoot
        );
        // Dot of question mark.
        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.RECT,
            {
                class: "blocklyIconSymbol",
                x: "4",
                y: "6",
                height: "1",
                width: "6",
                style: "fill: #575E75;",
            },
            this.svgRoot
        );
        Blockly.utils.dom.createSvgElement(
            "rect",
            {
                class: "blocklyIconSymbol",
                x: "4",
                y: "4",
                height: "1",
                width: "8",
                style: "fill: #575E75;",
            },
            this.svgRoot
        );

        Blockly.utils.dom.insertAfter(this.svgRoot, this.workspace.getBubbleCanvas());
    }

    private addEvent(node: Element, name: string, thisObject: object, func: (event: Event) => void) {
        const event = Blockly.browserEvents.bind(node, name, thisObject, func);
        this.boundEvents.push(event);
    }

    dispose() {
        if (this.svgRoot) {
            Blockly.utils.dom.removeNode(this.svgRoot);
        }
        for (const event of this.boundEvents) {
            Blockly.browserEvents.unbind(event);
        }
        this.boundEvents.length = 0;
    }

    protected attachListeners() {
        if (!this.svgRoot) return;
        this.addEvent(this.svgRoot, "mouseup", this, this.onClick);
        // this.addEvent(this.svgRoot, "mouseover", this, this.onMouseOver);
        // this.addEvent(this.svgRoot, "mouseout", this, this.onMouseOut);
    }

    position(metrics: UiMetrics, savedPositions: Blockly.utils.Rect[]): void {
        if (!this.initialized) {
            return;
        }

        const scrollbars = this.workspace.scrollbar;
        const hasVerticalScrollbars = scrollbars && scrollbars.isVisible() && scrollbars.canScrollVertically();
        const hasHorizontalScrollbars = scrollbars && scrollbars.isVisible() && scrollbars.canScrollHorizontally();

        if (
            metrics.toolboxMetrics.position === Blockly.TOOLBOX_AT_LEFT ||
            (this.workspace.horizontalLayout && !this.workspace.RTL)
        ) {
            // Right corner placement.
            this.left = metrics.absoluteMetrics.left + metrics.viewMetrics.width - this.WIDTH - this.MARGIN_HORIZONTAL;
            if (hasVerticalScrollbars && !this.workspace.RTL) {
                this.left -= Blockly.Scrollbar.scrollbarThickness;
            }
        } else {
            // Left corner placement.
            this.left = this.MARGIN_HORIZONTAL;
            if (hasVerticalScrollbars && this.workspace.RTL) {
                this.left += Blockly.Scrollbar.scrollbarThickness;
            }
        }

        const startAtBottom = metrics.toolboxMetrics.position === Blockly.TOOLBOX_AT_BOTTOM;
        if (startAtBottom) {
            // Bottom corner placement
            this.top = metrics.absoluteMetrics.top + metrics.viewMetrics.height - this.HEIGHT - this.MARGIN_VERTICAL;
            if (hasHorizontalScrollbars) {
                // The horizontal scrollbars are always positioned on the bottom.
                this.top -= Blockly.Scrollbar.scrollbarThickness;
            }
        } else {
            // Upper corner placement
            this.top = metrics.absoluteMetrics.top + this.MARGIN_VERTICAL;
        }

        // Check for collision and bump if needed.
        let boundingRect = this.getBoundingRectangle();
        for (let i = 0, otherEl; (otherEl = savedPositions[i]); i++) {
            if (boundingRect.intersects(otherEl)) {
                if (startAtBottom) {
                    // Bump up.
                    this.top = otherEl.top - this.HEIGHT - this.MARGIN_VERTICAL;
                } else {
                    // Bump down.
                    this.top = otherEl.bottom + this.MARGIN_VERTICAL;
                }
                // Recheck other savedPositions
                boundingRect = this.getBoundingRectangle();
                i = -1;
            }
        }

        if (this.svgRoot) {
            this.svgRoot.setAttribute("transform", `translate(${this.left},${this.top})`);
        }
    }

    getBoundingRectangle(): Blockly.utils.Rect | null {
        return new Blockly.utils.Rect(this.top, this.top + this.HEIGHT, this.left, this.left + this.WIDTH);
    }

    protected updateFlyoutDefinition() {
        if (!this.initialized) return;

        // TODO thsparks
        const itemInfoArray: Blockly.utils.toolbox.FlyoutItemInfo[] = [];

        const topBlocks = this.workspace.getTopBlocks(true);
        for (const block of topBlocks) {
            const button: Blockly.utils.toolbox.ButtonInfo = {
                kind: "button",
                text: block.getFieldValue("NAME"),
                callbackkey: "callback",
            };
            itemInfoArray.push(button);
        }

        this.flyoutDefinition = itemInfoArray;
    }

    protected onClick() {
        this.updateFlyoutDefinition();
        this.outlineFlyout.show(this.flyoutDefinition);
    }
}

/**
 * @param workspace The workspace in which to place this button.
 * @param targetWorkspace The flyout's target workspace.
 * @param json The JSON specifying the item.
 */
export class WorkspaceOutlineItem extends Blockly.FlyoutButton {
    constructor(
        workspace: Blockly.WorkspaceSvg,
        targetWorkspace: Blockly.WorkspaceSvg,
        json: Blockly.utils.toolbox.ButtonInfo
    ) {
        super(workspace, targetWorkspace, json, false /* isFlyoutLabel */);
    }
}

export class WorkspaceOutlineFlyout extends Blockly.VerticalFlyout {
    // override horizontalLayout: boolean = false;
    // override RTL: boolean = true;
    override autoClose: boolean = false;

    constructor(protected options: Blockly.Options) {
        super(options);
    }
}
