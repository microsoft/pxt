import * as Blockly from "blockly";
import { isBackpackBlock } from "./backpack";


export interface BackpackDragTargetOptions {
    /** Return the visible drop target element, or undefined to disable this target. */
    getElement: () => HTMLElement | undefined;
    openOnHover?: boolean;
}

export interface BackpackWorkspaceOptions {
    isEnabled: () => boolean;
    canSave?: (block: Blockly.Block) => boolean;
    save: (block: Blockly.BlockSvg) => void;
    /** Open Backpack without taking keyboard focus away from the block being dragged. */
    open: () => void;
    dragTargets: BackpackDragTargetOptions[];
    hoverClass: string;
}

interface WorkspaceRegistration {
    options: BackpackWorkspaceOptions;
    targets: BackpackDragTarget[];
    dispose: () => void;
}

const registrations = new Map<Blockly.Workspace, WorkspaceRegistration>();

class BackpackDragTarget extends Blockly.DragTarget {
    private hovered: HTMLElement;
    private timer: ReturnType<typeof setTimeout>;
    private frame: number;

    constructor(
        private workspace: Blockly.WorkspaceSvg,
        private options: BackpackWorkspaceOptions,
        private target: BackpackDragTargetOptions
    ) {
        super();
        this.id = Blockly.utils.idGenerator.genUid();
    }

    private element(): HTMLElement | undefined {
        return this.options.isEnabled() ? this.target.getElement() : undefined;
    }

    private accepts(draggable: Blockly.IDraggable): draggable is Blockly.BlockSvg {
        return draggable instanceof Blockly.BlockSvg && draggable.workspace === this.workspace
            && isBackpackBlock(draggable) && (!this.options.canSave || this.options.canSave(draggable));
    }

    getClientRect(): Blockly.utils.Rect | null {
        const rect = this.element()?.getBoundingClientRect();
        return rect ? new Blockly.utils.Rect(rect.top, rect.bottom, rect.left, rect.right) : null;
    }

    onDragEnter(draggable: Blockly.IDraggable): void {
        this.clear();
        if (!this.accepts(draggable)) return;
        const element = this.element();
        if (!element) return;

        this.hovered = element;
        element.classList.add(this.options.hoverClass);
        if (this.target.openOnHover) {
            this.timer = setTimeout(() => {
                this.timer = undefined;
                if (this.hovered !== element || this.element() !== element || !this.accepts(draggable)) {
                    this.clear();
                    return;
                }
                try {
                    this.options.open();
                } catch (error) {
                    pxt.reportException(error);
                }

                // Opening can change the layout even if the pointer remains stationary.
                this.frame = requestAnimationFrame(() => {
                    this.frame = undefined;
                    refreshBackpackDragTargets(this.workspace);
                });
            }, 500);
        }
    }

    onDragOver(draggable: Blockly.IDraggable): void {
        if (!this.accepts(draggable) || this.hovered !== this.element()) this.clear();
    }

    onDragExit(_draggable: Blockly.IDraggable): void {
        this.clear();
    }

    onDrop(draggable: Blockly.IDraggable): void {
        try {
            if (this.options.isEnabled() && this.accepts(draggable)) this.options.save(draggable);
        } catch (error) {
            // Do not interrupt native revertDrag if storage or the host callback fails.
            pxt.reportException(error);
        } finally {
            this.clear();
        }
    }

    shouldPreventMove(draggable: Blockly.IDraggable): boolean {
        // A save callback may disable the feature. The original must still be restored.
        return this.accepts(draggable);
    }

    clear(): void {
        if (this.timer !== undefined) clearTimeout(this.timer);
        if (this.frame !== undefined) cancelAnimationFrame(this.frame);

        this.timer = undefined;
        this.frame = undefined;
        this.hovered?.classList.remove(this.options.hoverClass);
        this.hovered = undefined;
    }
}

export function refreshBackpackDragTargets(workspace: Blockly.WorkspaceSvg): boolean {
    if (!registrations.has(workspace)) return false;
    workspace.recordDragTargets();
    return true;
}

/** Clear hover state even when a drag ends without onDragExit. */
export function clearBackpackDragState(workspace: Blockly.WorkspaceSvg): void {
    registrations.get(workspace)?.targets.forEach(target => target.clear());
}

export function registerBackpackWorkspace(
    workspace: Blockly.WorkspaceSvg,
    options: BackpackWorkspaceOptions
): () => void {
    registrations.get(workspace)?.dispose();
    const registry = Blockly.ContextMenuRegistry.registry;
    if (!registry.getItem("pxtBackpackSave")) {
        registry.register({
            id: "pxtBackpackSave",
            weight: 16,
            scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
            displayText: () => lf("Add to Backpack"),
            preconditionFn: scope => {
                const registration = registrations.get(scope.block?.workspace);
                if (!registration?.options.isEnabled()) return "hidden";
                if (registration.options.canSave && !registration.options.canSave(scope.block)) return "hidden";
                return isBackpackBlock(scope.block) ? "enabled" : "disabled";
            },
            callback: (scope: Blockly.ContextMenuRegistry.Scope) => {
                const registration = registrations.get(scope.block?.workspace);
                if (registration?.options.isEnabled() && isBackpackBlock(scope.block)
                    && (!registration.options.canSave || registration.options.canSave(scope.block))) {
                    registration.options.save(scope.block);
                }
            },
        });
    }

    const manager = workspace.getComponentManager();
    const targets = options.dragTargets.map(target => new BackpackDragTarget(workspace, options, target));
    for (const target of targets) {
        manager.addComponent({
            component: target,
            capabilities: [Blockly.ComponentManager.Capability.DRAG_TARGET],
            weight: -1
        });
    }

    const clear = (): void => targets.forEach(target => target.clear());
    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") clear();
    };
    // Defer pointer-up cleanup until Blockly's synchronous drop processing has completed.
    const onPointerUp = (): void => {
        Promise.resolve().then(clear);
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointercancel", clear, true);
    document.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("blur", clear);

    let disposed = false;
    const dispose = (): void => {
        if (disposed) return;
        disposed = true;
        clear();
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("pointercancel", clear, true);
        document.removeEventListener("pointerup", onPointerUp, true);
        window.removeEventListener("blur", clear);
        targets.forEach(target => manager.removeComponent(target.id));
        registrations.delete(workspace);
        workspace.recordDragTargets();
    };

    registrations.set(workspace, { options, targets, dispose });
    workspace.recordDragTargets();
    return dispose;
}