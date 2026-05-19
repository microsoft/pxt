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
  NEXT_STACK = 'next_stack',
  PREVIOUS_STACK = 'previous_stack',
  INSERT = 'insert',
  EDIT_OR_CONFIRM = 'edit_or_confirm',
  DISCONNECT = 'disconnect',
  TOOLBOX = 'toolbox',
  EXIT = 'exit',
  MENU = 'menu',
  COPY = 'keyboard_nav_copy',
  CUT = 'keyboard_nav_cut',
  DUPLICATE = 'duplicate',
  PASTE = 'keyboard_nav_paste',
  DELETE = 'delete',
  CREATE_WS_CURSOR = 'to_workspace',
  LIST_SHORTCUTS = 'list_shortcuts',
  CLEAN_UP = 'clean_up_workspace',
  UNDO = 'undo',
  REDO = 'redo',
  MOVE = 'start_move',
}

/**
 * Mirror of Blockly's getShortcutKeysShort (core/utils/shortcut_formatting.ts).
 * Returns the primary platform shortcut as a joined display string, e.g. "⌘ V"
 * or "Ctrl + V". Used for inline shortcut hints (e.g. paste toast).
 */
export function getShortcutKeysShort(shortcutName: string): string {
  const shortcuts = getShortcutKeys(shortcutName, shortModifierNames);
  if (shortcuts.length) {
    return shortcuts[0].join(isMacPlatform ? ' ' : ' + ');
  }
  return '';
}

/**
 * Mirror of Blockly's getShortcutKeysLong. Returns every platform shortcut
 * with long-form modifier names (e.g. "Command", "Option") for the shortcut
 * help dialog.
 */
export function getShortcutKeysLong(shortcutName: string): string[][] {
  return getShortcutKeys(shortcutName, longModifierNames);
}

/**
 * Short-form variant of getShortcutKeysLong: every platform shortcut, but with
 * compact modifier glyphs (⌘, ⌥). Used by UI that renders each key in its own
 * box rather than as a joined string.
 */
export function getShortcutKeysShortAll(shortcutName: string): string[][] {
  return getShortcutKeys(shortcutName, shortModifierNames);
}

const longModifierNames: Record<string, string> = {
  'Control': lf("Ctrl"),
  'Meta': lf("Command"),
  'Alt': isMacPlatform ? lf("Option") : lf("Alt"),
};

const shortModifierNames: Record<string, string> = {
  'Control': lf("Ctrl"),
  'Meta': '⌘',
  'Alt': isMacPlatform ? '⌥' : lf("Alt"),
};

/**
 * User-facing name for a keycode. Mirrors Blockly's getKeyName but uses pxt's
 * translation function for translatable strings.
 */
function getKeyName(keyCode: number): string {
  if (keyCode >= 65 && keyCode <= 90) {
    // letters a-z
    return String.fromCharCode(keyCode);
  }

  const keyNames: Record<number, string> = {
    8: lf("Backspace"),
    9: lf("Tab"),
    13: lf("Enter"),
    16: lf("Shift"),
    17: lf("Ctrl"),
    18: lf("Alt"),
    19: lf("Pause"),
    20: lf("Caps Lock"),
    27: lf("Esc"),
    32: lf("Space"),
    33: lf("Page Up"),
    34: lf("Page Down"),
    35: lf("End"),
    36: lf("Home"),
    37: '←',
    38: '↑',
    39: '→',
    40: '↓',
    45: lf("Insert"),
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
    59: ';',
    61: '=',
    93: lf("Context Menu"),
    96: '0',
    97: '1',
    98: '2',
    99: '3',
    100: '4',
    101: '5',
    102: '6',
    103: '7',
    104: '8',
    105: '9',
    106: '×',
    107: '+',
    109: '−',
    110: '.',
    111: '÷',
    112: 'F1',
    113: 'F2',
    114: 'F3',
    115: 'F4',
    116: 'F5',
    117: 'F6',
    118: 'F7',
    119: 'F8',
    120: 'F9',
    121: 'F10',
    122: 'F11',
    123: 'F12',
    186: ';',
    187: '=',
    189: '-',
    188: ',',
    190: '.',
    191: '/',
    192: '`',
    219: '[',
    220: '\\',
    221: ']',
    222: "'",
    224: '⌘',
  };

  const keyName = keyNames[keyCode];
  if (keyName) return keyName;
  pxt.warn('Unknown key code: ' + keyCode);
  return String.fromCharCode(keyCode);
}

/**
 * Find the relevant shortcuts for the given action for the current platform.
 * Keys are returned in a user facing format.
 *
 * Mirrors Blockly's internal getShortcutKeys (core/utils/shortcut_formatting.ts).
 * Kept as a local copy because Blockly doesn't expose this on its public API
 * surface; the algorithm should track Blockly's version.
 *
 * @param shortcutName The action name, e.g. "cut".
 * @param modifierNames The names to use for the Meta/Control/Alt modifiers.
 * @returns The formatted shortcuts.
 */
function getShortcutKeys(
  shortcutName: string,
  modifierNames: Record<string, string>,
): string[][] {
  const shortcuts = ShortcutRegistry.registry.getKeyCodesByShortcutName(shortcutName);
  if (shortcuts.length === 0) {
    return [];
  }
  // See ShortcutRegistry.createSerializedKey for the starting format.
  const shortcutsAsParts = shortcuts.map(shortcut => shortcut.split("+"));

  // Prefer e.g. Cmd+Shift to Shift+Cmd.
  shortcutsAsParts.forEach(s => s.sort((a, b) => modifierOrder(a) - modifierOrder(b)));

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
  currentPlatform.sort((a, b) => a.length - b.length);

  // If there are modifiers return only one shortcut on the assumption they are
  // intended for different platforms. Otherwise assume they are alternatives.
  const hasModifiers = currentPlatform.some((shortcut) =>
    shortcut.some(
      (key) => "Meta" === key || "Alt" === key || "Control" === key,
    ),
  );
  const chosen = hasModifiers ? [currentPlatform[0]] : currentPlatform;
  return chosen.map((shortcut) =>
    shortcut
      .map((maybeNumeric) =>
        Number.isFinite(+maybeNumeric)
          ? getKeyName(+maybeNumeric)
          : maybeNumeric,
      )
      .map((k) => upperCaseFirst(modifierNames[k] ?? k)),
  );
}

function upperCaseFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.substring(1);
}

/**
 * Preferred listing order of untranslated modifiers.
 */
const modifierOrdering: string[] = ['Meta', 'Control', 'Alt', 'Shift'];

function modifierOrder(key: string): number {
  const order = modifierOrdering.indexOf(key);
  // Regular keys at the end.
  return order === -1 ? Number.MAX_VALUE : order;
}
