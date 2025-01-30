import * as Blockly from "blockly";
import { getCopyPasteHandlers } from "./external";

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
}

function registerCopy() {
    const copyShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
        name: Blockly.ShortcutItems.names.COPY,
        preconditionFn(workspace) {
            return oldCopy.preconditionFn(workspace);
        },
        callback(workspace, e, shortcut) {
            const handler = getCopyPasteHandlers()?.copy;

            if (handler) {
                return handler(workspace, e);
            }

            return oldCopy.callback(workspace, e, shortcut);
        },
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
        callback(workspace, e, shortcut) {
            const handler = getCopyPasteHandlers()?.paste;

            if (handler) {
                return handler(workspace, e);
            }

            return oldPaste.callback(workspace, e, shortcut);
        },
        keyCodes: [oldPaste.keyCodes[0], oldPaste.keyCodes[1], oldPaste.keyCodes[2]],
    };

    Blockly.ShortcutRegistry.registry.register(pasteShortcut);
}
