import { ShortcutRegistry } from 'blockly';

const isMacPlatform = pxt.BrowserUtils.isMac();

/**
 * Default keyboard navigation shortcut names.
 * Based from blockly-keyboard-experiment constants.ts.
 */
export enum ShortcutNames {
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
  REDO = 'redo',
  // This name style doesn't match the others and is likely a plugin bug.
  MOVE = 'Start move',
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
function upperCaseFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.substring(1);
}

/**
 * Key names for common characters.
 * 
 * Copied from goog.events.keynames in blockly-keyboard-experimentation so we
 * can interpret the shortcuts.
 */
const keyNames: Record<string, string> = {
  /* eslint-disable @typescript-eslint/naming-convention */
  8: 'backspace',
  9: 'tab',
  13: 'enter',
  16: 'shift',
  17: 'ctrl',
  18: 'alt',
  19: 'pause',
  20: 'caps-lock',
  27: 'esc',
  32: 'space',
  33: 'pg-up',
  34: 'pg-down',
  35: 'end',
  36: 'home',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  45: 'insert',
  46: 'delete',
  48: '0',
  49: '1',
  50: '2',
  51: '3',
  52: '4',
  53: '5',
  54: '6',
  55: '7',
  56: '8',
  57: '9',
  59: 'semicolon',
  61: 'equals',
  65: 'a',
  66: 'b',
  67: 'c',
  68: 'd',
  69: 'e',
  70: 'f',
  71: 'g',
  72: 'h',
  73: 'i',
  74: 'j',
  75: 'k',
  76: 'l',
  77: 'm',
  78: 'n',
  79: 'o',
  80: 'p',
  81: 'q',
  82: 'r',
  83: 's',
  84: 't',
  85: 'u',
  86: 'v',
  87: 'w',
  88: 'x',
  89: 'y',
  90: 'z',
  93: 'context',
  96: 'num-0',
  97: 'num-1',
  98: 'num-2',
  99: 'num-3',
  100: 'num-4',
  101: 'num-5',
  102: 'num-6',
  103: 'num-7',
  104: 'num-8',
  105: 'num-9',
  106: 'num-multiply',
  107: 'num-plus',
  109: 'num-minus',
  110: 'num-period',
  111: 'num-division',
  112: 'f1',
  113: 'f2',
  114: 'f3',
  115: 'f4',
  116: 'f5',
  117: 'f6',
  118: 'f7',
  119: 'f8',
  120: 'f9',
  121: 'f10',
  122: 'f11',
  123: 'f12',
  186: 'semicolon',
  187: 'equals',
  189: 'dash',
  188: ',',
  190: '.',
  191: '/',
  192: '`',
  219: 'open-square-bracket',
  220: '\\',
  221: 'close-square-bracket',
  222: 'single-quote',
  224: 'win',
};
