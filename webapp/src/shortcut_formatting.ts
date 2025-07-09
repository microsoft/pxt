import { ShortcutRegistry } from 'blockly';

const isMacPlatform = pxt.BrowserUtils.isMac();

/**
 * Default keyboard navigation shortcut names.
 * Based from blockly-keyboard-experiment constants.ts.
 * See https://github.com/google/blockly-keyboard-experimentation/blob/main/src/constants.ts
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
  DELETE = 'delete',
  CREATE_WS_CURSOR = 'to_workspace',
  LIST_SHORTCUTS = 'list_shortcuts',
  CLEAN_UP = 'clean_up_workspace',
  UNDO = 'undo',
  REDO = 'redo',
  MOVE = 'start_move',
}

export function getActionShortcut(action: string): string[] | null {
  return getActionShortcutsAsKeys(action)[0] ?? null;
}

/**
 * Find the relevant shortcuts for the given action for the current platform.
 * Keys are returned in a user facing format.
 *
 * This could be considerably simpler if we only bound shortcuts relevant to the
 * current platform or tagged them with a platform.
 * 
 * Copied from blockly-keyboard-experiment.
 * See https://github.com/google/blockly-keyboard-experimentation/blob/main/src/shortcut_formatting.ts
 *
 * @param action The action name, e.g. "cut".
 * @param modifierNames The names to use for the Meta/Control/Alt modifiers.
 * @returns The formatted shortcuts.
 */
export function getActionShortcutsAsKeys(
  action: string,
): string[][] {
  const shortcuts = ShortcutRegistry.registry.getKeyCodesByShortcutName(action);
  if (shortcuts.length === 0) {
    return [];
  }
  // See ShortcutRegistry.createSerializedKey for the starting format.
  const shortcutsAsParts = shortcuts.map(shortcut => shortcut.split("+"));

  // Prefer e.g. Cmd+Shift to Shift+Cmd.
  shortcutsAsParts.forEach(s => s.sort((a, b) => {
    const aValue = modifierOrder(a);
    const bValue = modifierOrder(b);
    return aValue - bValue;
  }))

  // Needed to prefer Command to Option where we've bound Alt.
  shortcutsAsParts.sort((a, b) => {
    const aValue = a.includes("Meta") ? 1 : 0;
    const bValue = b.includes("Meta") ? 1 : 0;
    return bValue - aValue;
  });
  let currentPlatform = shortcutsAsParts.filter((shortcut) => {
    const isMacShortcut = shortcut.includes("Meta");
    return isMacShortcut === isMacPlatform;
  });
  currentPlatform = currentPlatform.length === 0 ? shortcutsAsParts : currentPlatform;

  // Prefer simpler shortcuts. This promotes Ctrl+Y for redo.
  currentPlatform.sort((a, b) => {
    return a.length - b.length;
  });

  // If there are modifiers return only one shortcut on the assumption they are
  // intended for different platforms. Otherwise assume they are alternatives.
  const hasModifiers = currentPlatform.some((shortcut) =>
    shortcut.some(
      (key) => "Meta" === key || "Alt" === key || "Control" === key,
    ),
  );
  const chosen = hasModifiers ? [currentPlatform[0]] : currentPlatform;
  return chosen.map((shortcut) => {
    return shortcut
      .map((numericOrModifier) => shortcutRegistryKeyNames[numericOrModifier] ?? numericOrModifier)
  });
}

/**
 * Localized key names for common characters.
 * Keys are the ones used in ShortcutRegistry.createSerializedKey.
 * E.g. ['Shift+Control+90', 'Shift+Alt+90', 'Shift+Meta+90', 'Control+89']
 */
const shortcutRegistryKeyNames: Record<string | number, string> = {
  // Numeric (subset we use).
  8: lf("Backspace"),
  13: lf("Enter"),
  27: lf("Esc"),
  32: lf("Space"),
  37: '←',
  38: '↑',
  39: '→',
  40: '↓',
  46: lf("Delete"),
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
  65: 'A',
  66: 'B',
  67: 'C',
  68: 'D',
  69: 'E',
  70: 'F',
  71: 'G',
  72: 'H',
  73: 'I',
  74: 'J',
  75: 'K',
  76: 'L',
  77: 'M',
  78: 'N',
  79: 'O',
  80: 'P',
  81: 'Q',
  82: 'R',
  83: 'S',
  84: 'T',
  85: 'U',
  86: 'V',
  87: 'W',
  88: 'X',
  89: 'Y',
  90: 'Z',
  191: '/',
  // Modifiers
  'Shift': lf("Shift"),
  'Control': lf("Ctrl"),
  'Meta': '⌘',
  'Alt': isMacPlatform ? '⌥' : lf("Alt"),
};

/**
 * Preferred listing order of untranslated modifiers.
 */
const modifierOrdering: string[] = [
  'Meta',
  'Control',
  'Alt',
  'Shift'
];

function modifierOrder(key: string): number {
    const order = modifierOrdering.indexOf(key);
    // Regular keys at the end.
    return order === -1 ? Number.MAX_VALUE : order;
  }