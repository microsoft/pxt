import * as Blockly from "blockly";

const MAX_CACHED_FLYOUTS = 20;

export class VerticalFlyout implements Blockly.IFlyout {
    horizontalLayout = false;
    RTL: boolean;
    targetWorkspace: Blockly.WorkspaceSvg;
    MARGIN: number;
    autoClose = true;
    CORNER_RADIUS: number;

    protected cached: CachedFlyout[] = [];
    protected element: SVGElement;
    protected activeFlyout: CachedFlyout;
    protected visible: boolean;

    protected dummyWorkspace: Blockly.WorkspaceSvg;
    protected containerVisible: boolean;

    constructor(protected options: Blockly.Options) {
        this.dummyWorkspace = new Blockly.WorkspaceSvg(options);
    }

    createDom(tagName: string | Blockly.utils.Svg<SVGSVGElement> | Blockly.utils.Svg<SVGGElement>): SVGElement {
        if (this.element) {
            return this.element;
        }

        this.dummyWorkspace.createDom();

        this.element = Blockly.utils.dom.createSvgElement(
            tagName,
            {
                class: "blocklyFlyout"
            }
        );

        this.element.id = "multiFlyout";
        this.element.style.display = "none";

        return this.element;
    }

    init(targetWorkspace: Blockly.WorkspaceSvg): void {
        this.targetWorkspace = targetWorkspace;
    }

    dispose(): void {
        for (const entry of this.cached) {
            entry.dispose();
        }
    }

    getWidth(): number {
        if (this.activeFlyout) {
            return this.activeFlyout.getWidth();
        }

        return 0;
    }

    getHeight(): number {
        if (this.activeFlyout) {
            return this.activeFlyout.getHeight();
        }

        return 0;
    }

    getWorkspace(): Blockly.WorkspaceSvg {
        if (this.activeFlyout) {
            return this.activeFlyout.getWorkspace();
        }

        return this.dummyWorkspace;
    }

    isVisible(): boolean {
        return this.visible;
    }

    setVisible(visible: boolean): void {
        if (visible === this.visible) return;

        this.visible = visible;
        this.element.style.display = visible ? "block" : "none";

        for (const flyout of this.cached) {
            if (flyout !== this.activeFlyout && flyout.isVisible()) {
                flyout.setVisible(false);
            }
        }

        if (this.activeFlyout) {
            this.activeFlyout.setVisible(visible);
        }
    }

    setContainerVisible(visible: boolean): void {
        if (this.containerVisible === visible) return;

        this.containerVisible = visible;

        for (const entry of this.cached) {
            entry.setContainerVisible(visible);
        }
    }

    hide(): void {
        if (this.activeFlyout) {
            this.activeFlyout.hide();
        }

        this.setVisible(false);
    }

    show(flyoutDef: string | Blockly.utils.toolbox.FlyoutDefinition, cacheKey?: string): void {
        const hash = cacheKey || this.hashBlocks(flyoutDef as Element[]);

        if (this.activeFlyout) {
            this.activeFlyout.hide();
        }

        const existing = this.cached.find(e => e.key === hash);

        this.element.style.display = "block";
        this.visible = true;

        if (existing) {
            this.activeFlyout = existing;
            this.activeFlyout.autoClose = this.autoClose;
            this.activeFlyout.setContainerVisible(this.containerVisible);
            this.activeFlyout.show(flyoutDef);

            // move to most recently used in the cache
            this.cached.splice(this.cached.indexOf(existing), 1);
            this.cached.push(existing);
            return;
        }

        this.activeFlyout = new CachedFlyout(this.options);
        this.cached.push(this.activeFlyout);

        if (this.cached.length >= MAX_CACHED_FLYOUTS) {
            this.cached.shift().dispose();
        }

        this.element.appendChild(this.activeFlyout.createDom("g"));
        this.activeFlyout.init(this.targetWorkspace);

        this.activeFlyout.key = hash;
        this.activeFlyout.autoClose = this.autoClose;
        this.activeFlyout.setContainerVisible(this.containerVisible);
        this.activeFlyout.show(flyoutDef);
    }

    createBlock(originalBlock: Blockly.BlockSvg): Blockly.BlockSvg {
        if (this.activeFlyout) {
            return this.activeFlyout.createBlock(originalBlock);
        }

        return undefined;
    }

    reflow(): void {
        if (this.activeFlyout) {
            this.activeFlyout.reflow();
        }
    }

    isScrollable(): boolean {
        if (this.activeFlyout) {
            return this.activeFlyout.isScrollable();
        }

        return true;
    }

    getX(): number {
        if (this.activeFlyout) {
            return this.activeFlyout.getX();
        }
        return 0;
    }

    getY(): number {
        if (this.activeFlyout) {
            return this.activeFlyout.getY();
        }
        return 0;
    }

    position(): void {
        if (this.activeFlyout) {
            this.activeFlyout.position();
        }
    }

    isDragTowardWorkspace(currentDragDeltaXY: Blockly.utils.Coordinate): boolean {
        if (this.activeFlyout) {
            return this.activeFlyout.isDragTowardWorkspace(currentDragDeltaXY);
        }

        return false;
    }

    isBlockCreatable(block: Blockly.BlockSvg): boolean {
        if (this.activeFlyout) {
            return this.activeFlyout.isBlockCreatable(block);
        }

        return false;
    }

    scrollToStart(): void {
        if (this.activeFlyout) {
            this.activeFlyout.scrollToStart();
        }
    }

    getContents() {
        return this.activeFlyout?.getContents() || [];
    }

    protected blocksToString(xmlList: Element[]): string {
        let xmlSerializer: XMLSerializer = null;
        const serialize = (e: Element) => {
            if (!e)
                return "<!-- invalid block here! -->"
            if (e.outerHTML)
                return e.outerHTML
            // The below code is only needed for IE 11 where outerHTML occassionally returns undefined :/
            if (!xmlSerializer)
                xmlSerializer = new XMLSerializer()
            return xmlSerializer.serializeToString(e);
        }
        return xmlList
            .map(serialize)
            .reduce((p, c) => p + c, "")
    }

    protected hashBlocks(xmlList: Element[]): number {
        if (!Array.isArray(xmlList)) return undefined;
        return pxt.Util.codalHash16(this.blocksToString(xmlList));
    }
}

export class CachedFlyout extends Blockly.VerticalFlyout {
    protected def: Element[];
    protected buttonListeners: Blockly.browserEvents.Data[] = [];

    key: string | number;

    constructor(protected options: Blockly.Options) {
        super(options);
    }

    show(flyoutDef: string | Blockly.utils.toolbox.FlyoutDefinition): void {
        if (Array.isArray(flyoutDef)) {
            this.def = (flyoutDef as Element[]).slice();
        }

        super.show(flyoutDef);
    }

    protected blockIsRecyclable_(block: Blockly.BlockSvg) {
        switch (block.type) {
            case "variables_get":
            case "variables_set":
            case "variables_change":
                return false;
        }
        return true;
    }
}
