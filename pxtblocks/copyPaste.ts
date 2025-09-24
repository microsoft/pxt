import * as Blockly from "blockly";
import { getCopyPasteHandlers } from "./external";
import { BlockContextWeight } from "./contextMenu/blockItems";
import { WorkspaceContextWeight } from "./contextMenu/workspaceItems";
import { shouldDuplicateOnDrag, updateDuplicateOnDragState } from "./plugins/duplicateOnDrag";

let oldCopy: Blockly.ShortcutRegistry.KeyboardShortcut;
let oldCut: Blockly.ShortcutRegistry.KeyboardShortcut;
let oldPaste: Blockly.ShortcutRegistry.KeyboardShortcut;

export function initCopyPaste(accessibleBlocksEnabled: boolean, forceRefresh: boolean = false) {
    if (!getCopyPasteHandlers()) return;

    if (oldCopy && !forceRefresh) return;

    const shortcuts = Blockly.ShortcutRegistry.registry.getRegistry()

    oldCopy = oldCopy || { ...shortcuts[Blockly.ShortcutItems.names.COPY] };
    oldCut = oldCut || { ...shortcuts[Blockly.ShortcutItems.names.CUT] };
    oldPaste = oldPaste || { ...shortcuts[Blockly.ShortcutItems.names.PASTE] };

    Blockly.ShortcutRegistry.registry.unregister(Blockly.ShortcutItems.names.COPY);
    Blockly.ShortcutRegistry.registry.unregister(Blockly.ShortcutItems.names.CUT);
    Blockly.ShortcutRegistry.registry.unregister(Blockly.ShortcutItems.names.PASTE);

    registerCopy();
    registerCut();
    registerPaste();

    if (!accessibleBlocksEnabled) {
        registerCopyContextMenu();
        registerPasteContextMenu();
    }
}

export function initAccessibleBlocksCopyPasteContextMenu() {
    overridePasteContextMenuItem();
    overrideCutContextMenuItem();
}

function overridePasteContextMenuItem() {
    const oldPasteOption = Blockly.ContextMenuRegistry.registry.getItem("blockPasteFromContextMenu");

    if ("separator" in oldPasteOption) {
        throw new Error(`RegistryItem ${oldPasteOption.id} is not of type ActionRegistryItem`);
    };

    const pasteOption: Blockly.ContextMenuRegistry.RegistryItem = {
        ...oldPasteOption,
        preconditionFn: pasteContextMenuPreconditionFn,
    };

    Blockly.ContextMenuRegistry.registry.unregister("blockPasteFromContextMenu");
    Blockly.ContextMenuRegistry.registry.register(pasteOption);
}

function overrideCutContextMenuItem() {
    const oldCutOption = Blockly.ContextMenuRegistry.registry.getItem("blockCutFromContextMenu");

    if ("separator" in oldCutOption) {
        throw new Error(`RegistryItem ${oldCutOption.id} is not of type ActionRegistryItem`);
    };

    const cutOption: Blockly.ContextMenuRegistry.RegistryItem = {
        ...oldCutOption,
        preconditionFn: (scope: Blockly.ContextMenuRegistry.Scope) => {
            const focused = scope.focusedNode;
            if (!focused || !Blockly.isCopyable(focused)) return "hidden";

            const workspace = focused.workspace;

            if (focused.workspace.isFlyout)
                return "hidden";

            if (!(workspace instanceof Blockly.WorkspaceSvg)) return 'hidden';

            if (
                oldCut.preconditionFn(workspace, scope)
            ) {
                return 'enabled';
            }

            return "hidden";
        },
    };

    Blockly.ContextMenuRegistry.registry.unregister("blockCutFromContextMenu");
    Blockly.ContextMenuRegistry.registry.register(cutOption);
}

function registerCopy() {
    const copyShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
        name: Blockly.ShortcutItems.names.COPY,
        preconditionFn(workspace, scope) {
            return runCopyPreconditionFunction(workspace, scope, oldCopy.preconditionFn);
        },
        callback: copy,
        keyCodes: oldCopy.keyCodes,
    };
    Blockly.ShortcutRegistry.registry.register(copyShortcut);
}

function registerCut() {
    const cutShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
        name: Blockly.ShortcutItems.names.CUT,
        preconditionFn(workspace, scope) {
            return  runCopyPreconditionFunction(workspace, scope, oldCut.preconditionFn);
        },
        callback(workspace, e, shortcut, scope) {
            const handler = getCopyPasteHandlers()?.cut;

            if (handler) {
                return handler(workspace, e, shortcut, scope);
            }

            return oldCut.callback(workspace, e, shortcut, scope);
        },
        keyCodes: oldCut.keyCodes,
    };

    Blockly.ShortcutRegistry.registry.register(cutShortcut);
}

function registerPaste() {
    const pasteShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
        name: Blockly.ShortcutItems.names.PASTE,
        preconditionFn(workspace, _scope) {
            // Override the paste precondition in core as it now checks
            // it's own clipboard for copy data.
            return (
                !workspace.isReadOnly() &&
                !workspace.isDragging() &&
                !Blockly.getFocusManager().ephemeralFocusTaken()
            );
        },
        callback: paste,
        keyCodes: oldPaste.keyCodes,
    };

    Blockly.ShortcutRegistry.registry.register(pasteShortcut);
}

function registerCopyContextMenu() {
    const copyOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText: () => lf("Copy"),
        preconditionFn: (scope: Blockly.ContextMenuRegistry.Scope) => {
            const block = scope.block;
            if (block.isInFlyout || !block.isMovable() || !block.isEditable()) {
                return "hidden";
            }

            const handlers = getCopyPasteHandlers();

            if (handlers) {
                return handlers.copyPrecondition(scope);
            }

            return "enabled";
        },
        callback: function (scope: Blockly.ContextMenuRegistry.Scope, e: PointerEvent): void {
            const block = scope.block;

            if (!block) return;

            block.select();
            copy(block.workspace, e, undefined, scope);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        weight: BlockContextWeight.Copy,
        id: "makecode-copy-block"
    };

    const copyCommentOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText: () => lf("Copy"),
        preconditionFn: (scope: Blockly.ContextMenuRegistry.Scope) => {
            const comment = scope.comment;
            if (!comment.isMovable() || !comment.isEditable()) {
                return "hidden";
            }

            const handlers = getCopyPasteHandlers();

            if (handlers) {
                return handlers.copyPrecondition(scope);
            }

            return "enabled";
        },
        callback: function (scope: Blockly.ContextMenuRegistry.Scope, e: PointerEvent): void {
            const comment = scope.comment;

            if (!comment) return;

            comment.select();
            copy(comment.workspace, e, undefined, scope);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.COMMENT,
        weight: BlockContextWeight.Copy,
        id: "makecode-copy-comment"
    };

    if (Blockly.ContextMenuRegistry.registry.getItem(copyOption.id)) {
        Blockly.ContextMenuRegistry.registry.unregister(copyOption.id);
    }
    if (Blockly.ContextMenuRegistry.registry.getItem(copyCommentOption.id)) {
        Blockly.ContextMenuRegistry.registry.unregister(copyCommentOption.id);
    }

    Blockly.ContextMenuRegistry.registry.register(copyOption);
    Blockly.ContextMenuRegistry.registry.register(copyCommentOption);
}

function registerPasteContextMenu() {
    const pasteOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText: () => lf("Paste"),
        preconditionFn: pasteContextMenuPreconditionFn,
        callback: function (scope: Blockly.ContextMenuRegistry.Scope, e: PointerEvent): void {
            const workspace = scope.workspace;

            if (!workspace) return;
            paste(workspace, e, undefined, scope);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        weight: WorkspaceContextWeight.Paste,
        id: "makecode-paste"
    };

    if (Blockly.ContextMenuRegistry.registry.getItem(pasteOption.id)) {
        Blockly.ContextMenuRegistry.registry.unregister(pasteOption.id);
    }

    Blockly.ContextMenuRegistry.registry.register(pasteOption);
}

const pasteContextMenuPreconditionFn = (scope: Blockly.ContextMenuRegistry.Scope) => {
    if (pxt.shell.isReadOnly() || scope.workspace?.options.readOnly) {
        return "hidden";
    }

    const handlers = getCopyPasteHandlers();

    if (handlers) {
        return handlers.pastePrecondition(scope);
    }

    return "enabled";
}

const copy = (workspace: Blockly.WorkspaceSvg, e: Event, shortcut?: Blockly.ShortcutRegistry.KeyboardShortcut, scope?: Blockly.ContextMenuRegistry.Scope) => {
    const handler = getCopyPasteHandlers()?.copy;

    if (handler) {
        return handler(workspace, e, shortcut, scope);
    }

    return oldCopy.callback(workspace, e, shortcut, scope);
}

const paste = (workspace: Blockly.WorkspaceSvg, e: Event, shortcut?: Blockly.ShortcutRegistry.KeyboardShortcut, scope?: Blockly.ContextMenuRegistry.Scope) => {
    const handler = getCopyPasteHandlers()?.paste;

    if (handler) {
        return handler(workspace, e, shortcut, scope);
    }

    return oldPaste.callback(workspace, e, shortcut, scope);
}

/**
 * This is hack to get around the fact that Blockly's isCopyable logic doesn't
 * allow blocks that are not deletable to be copied. Our duplicateOnDrag blocks
 * are not deletable, but we still want to allow them to be copied.
 */
function runCopyPreconditionFunction(
    workspace: Blockly.WorkspaceSvg,
    scope: Blockly.ContextMenuRegistry.Scope,
    func: (workspace: Blockly.WorkspaceSvg, scope: Blockly.ContextMenuRegistry.Scope) => boolean
): boolean {
    const toCopy = Blockly.getFocusManager().getFocusedNode();
    if (toCopy instanceof Blockly.BlockSvg) {
        if (shouldDuplicateOnDrag(toCopy)) {
            toCopy.setDeletable(true);
        }
    }
    const result = func(workspace, scope);

    updateDuplicateOnDragState(toCopy as Blockly.BlockSvg);
    return result;
}