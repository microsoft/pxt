import * as Blockly from "blockly";
import { getCopyPasteHandlers } from "./external";
import { BlockContextWeight } from "./contextMenu/blockItems";
import { WorkspaceContextWeight } from "./contextMenu/workspaceItems";

let oldCopy: Blockly.ShortcutRegistry.KeyboardShortcut;
let oldCut: Blockly.ShortcutRegistry.KeyboardShortcut;
let oldPaste: Blockly.ShortcutRegistry.KeyboardShortcut;

export function initCopyPaste(accessibleBlocksEnabled: boolean) {
    if (oldCopy || !getCopyPasteHandlers()) return;

    const shortcuts = Blockly.ShortcutRegistry.registry.getRegistry()

    oldCopy = { ...shortcuts[Blockly.ShortcutItems.names.COPY] };
    oldCut = { ...shortcuts[Blockly.ShortcutItems.names.CUT] };
    oldPaste = { ...shortcuts[Blockly.ShortcutItems.names.PASTE] };

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

            if (
                workspace.isReadOnly() &&
                (Blockly.isDeletable(focused) &&
                !focused.isDeletable()) ||
                (Blockly.isDraggable(focused) &&
                !focused.isMovable())
            )
                return "disabled";

            const handlers = getCopyPasteHandlers();

            if (handlers) {
                return handlers.copyPrecondition(scope);
            }

            return "enabled";
        },
    };

    Blockly.ContextMenuRegistry.registry.unregister("blockCutFromContextMenu");
    Blockly.ContextMenuRegistry.registry.register(cutOption);
}

function registerCopy() {
    const copyShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
        name: Blockly.ShortcutItems.names.COPY,
        preconditionFn(workspace, scope) {
            return oldCopy.preconditionFn(workspace, scope);
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
            return oldCut.preconditionFn(workspace, scope);
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
        preconditionFn(workspace, scope) {
            return oldPaste.preconditionFn(workspace, scope);
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
