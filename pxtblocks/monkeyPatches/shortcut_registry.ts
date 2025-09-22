import * as Blockly from "blockly";

/**
 * There are some scenarios where we attempt to add the same key mapping to the same key multiple times.
 * This ensures that doing so will no-op instead of adding duplicate entries, which don't get cleaned up properly.
 */
export function monkeyPatchAddKeyMapping() {
    const existingAdd = Blockly.ShortcutRegistry.prototype.addKeyMapping;
    Blockly.ShortcutRegistry.prototype.addKeyMapping = function (
        keyCode: string | number | Blockly.utils.KeyCodes,
        shortcutName: string,
        allowCollision?: boolean,
      ): void {
        if (Blockly.ShortcutRegistry.registry.getShortcutNamesByKeyCode(keyCode.toString()).indexOf(shortcutName) !== -1) {
            // Already have this mapping, no-op
            return;
        }

        existingAdd.call(this, keyCode, shortcutName, allowCollision);
      }
}
