import * as Blockly from "blockly";
import { getCopyPasteHandlers } from "./external";
import { BlockContextWeight } from "./contextMenu/blockItems";
import { WorkspaceContextWeight } from "./contextMenu/workspaceItems";

let oldCopy: Blockly.ShortcutRegistry.KeyboardShortcut;
let oldCut: Blockly.ShortcutRegistry.KeyboardShortcut;
let oldPaste: Blockly.ShortcutRegistry.KeyboardShortcut;

export function initCopyPaste() {
    if (oldCopy) return;

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
    registerCopyContextMenu();
    registerPasteContextMenu();
}

function registerCopy() {
    const copyShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
        name: Blockly.ShortcutItems.names.COPY,
        preconditionFn(workspace) {
            return oldCopy.preconditionFn(workspace);
        },
        callback: copy,
        // the registered shortcut from blockly isn't an array, it's some sort
        // of serialized object so we have to convert it back to an array
        keyCodes: [oldCopy.keyCodes[0], oldCopy.keyCodes[1], oldCopy.keyCodes[2]],
    };
    Blockly.ShortcutRegistry.registry.register(copyShortcut);
}

function registerCut() {
    const cutShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
        name: Blockly.ShortcutItems.names.CUT,
        preconditionFn(workspace) {
            return oldCut.preconditionFn(workspace);
        },
        callback(workspace, e, shortcut) {
            const handler = getCopyPasteHandlers()?.cut;

            if (handler) {
                return handler(workspace, e);
            }

            return oldCut.callback(workspace, e, shortcut);
        },
        keyCodes: [oldCut.keyCodes[0], oldCut.keyCodes[1], oldCut.keyCodes[2]],
    };

    Blockly.ShortcutRegistry.registry.register(cutShortcut);
}

function registerPaste() {
    const pasteShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
        name: Blockly.ShortcutItems.names.PASTE,
        preconditionFn(workspace) {
            return oldPaste.preconditionFn(workspace);
        },
        callback: paste,
        keyCodes: [oldPaste.keyCodes[0], oldPaste.keyCodes[1], oldPaste.keyCodes[2]],
    };

    Blockly.ShortcutRegistry.registry.register(pasteShortcut);
}

function registerCopyContextMenu() {
    const copyOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText: () => lf("Copy"),
        preconditionFn: scope => {
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
            copy(block.workspace, e);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        weight: BlockContextWeight.Copy,
        id: "makecode-copy-block"
    };

    const copyCommentOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText: () => lf("Copy"),
        preconditionFn: scope => {
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
            copy(comment.workspace, e);
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
        preconditionFn: scope => {
            if (pxt.shell.isReadOnly() || scope.workspace.options.readOnly) {
                return "hidden";
            }

            const handlers = getCopyPasteHandlers();

            if (handlers) {
                return handlers.pastePrecondition(scope);
            }

            return "enabled";
        },
        callback: function (scope: Blockly.ContextMenuRegistry.Scope, e: PointerEvent): void {
            const workspace = scope.workspace;

            if (!workspace) return;
            paste(workspace, e);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        weight: WorkspaceContextWeight.Paste,
        id: "makecode-paste"
    };

    Blockly.ContextMenuRegistry.registry.register(pasteOption);
}

const copy = (workspace: Blockly.WorkspaceSvg, e: Event, shortcut?: Blockly.ShortcutRegistry.KeyboardShortcut) => {
    const handler = getCopyPasteHandlers()?.copy;

    if (handler) {
        return handler(workspace, e);
    }

    return oldCopy.callback(workspace, e, shortcut);
}

const paste = (workspace: Blockly.WorkspaceSvg, e: Event, shortcut?: Blockly.ShortcutRegistry.KeyboardShortcut) => {
    const handler = getCopyPasteHandlers()?.paste;

    if (handler) {
        return handler(workspace, e);
    }

    return oldPaste.callback(workspace, e, shortcut);
}
