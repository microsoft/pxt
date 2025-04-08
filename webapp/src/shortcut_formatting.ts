import { ShortcutRegistry } from 'blockly';
import { keyNames } from './keynames';

const isMacPlatform = pxt.BrowserUtils.isMac();

/**
 * Default keyboard navigation shortcut names.
 * Based from blockly-keyboard-experiment constants.ts.
 */
export enum SHORTCUT_NAMES {
  UP = 'up',
  DOWN = 'down',
  RIGHT = 'right',
  LEFT = 'left',
  INSERT = 'insert',
  EDIT_OR_CONFIRM = 'edit_or_confirm',
  DISCONNECT = 'disconnect',
  TOOLBOX = 'toolbox',
  EXIT = 'exit',
  MENU = 'menu',
  COPY = 'keyboard_nav_copy',
  CUT = 'keyboard_nav_cut',
  PASTE = 'keyboard_nav_paste',
  DELETE = 'keyboard_nav_delete',
  MOVE_WS_CURSOR_UP = 'workspace_up',
  MOVE_WS_CURSOR_DOWN = 'workspace_down',
  MOVE_WS_CURSOR_LEFT = 'workspace_left',
  MOVE_WS_CURSOR_RIGHT = 'workspace_right',
  CREATE_WS_CURSOR = 'to_workspace',
  LIST_SHORTCUTS = 'list_shortcuts',
  CLEAN_UP = 'clean_up_workspace',
  UNDO = 'undo',
  REDO = 'redo'
}

export function getActionShortcut(action: string): string[] {
  return getActionShortcutsAsKeys(action, shortModifierNames)[0]
          .map(s => displayArrowKeys[s] ?? s);
}

const displayArrowKeys: Record<string, string> = {
  "Up": "↑",
  "Down": "↓",
  "Left": "←",
  "Right": "→"
}

// Copied from blockly-keyboard-experiment.
const shortModifierNames: Record<string, string> = {
  'Control': 'Ctrl',
  'Meta': '⌘',
  'Alt': isMacPlatform ? '⌥' : 'Alt',
};

/**
 * Find the relevant shortcuts for the given action for the current platform.
 * Keys are returned in a user facing format.
 *
 * This could be considerably simpler if we only bound shortcuts relevant to the
 * current platform or tagged them with a platform.
 * 
 * Copied from blockly-keyboard-experiment.
 *
 * @param action The action name, e.g. "cut".
 * @param modifierNames The names to use for the Meta/Control/Alt modifiers.
 * @returns The formatted shortcuts.
 */
function getActionShortcutsAsKeys(
  action: string,
  modifierNames: Record<string, string>,
): string[][] {
  const shortcuts = ShortcutRegistry.registry.getKeyCodesByShortcutName(action);
  // See ShortcutRegistry.createSerializedKey for the starting format.
  const named = shortcuts.map((shortcut) => {
    return shortcut
      .split('+')
      .map((maybeNumeric) => keyNames[maybeNumeric] ?? maybeNumeric)
      .map((k) => upperCaseFirst(modifierNames[k] ?? k));
  });

  const command = modifierNames['Meta'];
  const option = modifierNames['Alt'];
  const control = modifierNames['Control'];
  // Needed to prefer Command to Option where we've bound Alt.
  named.sort((a, b) => {
    const aValue = a.includes(command) ? 1 : 0;
    const bValue = b.includes(command) ? 1 : 0;
    return bValue - aValue;
  });
  let currentPlatform = named.filter((shortcut) => {
    const isMacShortcut =
      shortcut.includes(command) || shortcut.includes(option);
    return isMacShortcut === isMacPlatform;
  });
  currentPlatform = currentPlatform.length === 0 ? named : currentPlatform;

  // If there are modifiers return only one shortcut on the assumption they are
  // intended for different platforms. Otherwise assume they are alternatives.
  const hasModifiers = currentPlatform.some((shortcut) =>
    shortcut.some(
      (key) => command === key || option === key || control === key,
    ),
  );
  return hasModifiers ? [currentPlatform[0]] : currentPlatform;
}

/**
 * Convert the first character to uppercase.
 * Copied from blockly-keyboard-experiment.
 *
 * @param str String.
 * @returns The string in title case.
 */
export function upperCaseFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.substring(1);
}
