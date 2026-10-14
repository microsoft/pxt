/** A text-language item of the editor toggle. */
export type EditorToggleLanguage = "javascript" | "python";

/** An item of the editor toggle's bar: a text language, or a simulator extension's editor tab by key. */
export type EditorToggleItem = { language: EditorToggleLanguage } | { extension: string };

/** What decides the text-language items and the language dropdown of the editor toggle. */
export interface EditorToggleLayoutInput {
    /** The target offers Python. */
    python: boolean;
    showJavaScript: boolean;
    showPython: boolean;
    showBlocks: boolean;
    /** Python is the active editor, or the saved language preference. */
    pythonIsActive: boolean;
    isJavaScriptActive: boolean;
    isPythonActive: boolean;
    /** The keys of the simulator extension editor tabs offered here, in order. */
    extensionEditors: string[];
    /** The key of the active extension editor tab, or undefined if none is active. */
    activeExtensionEditor: string | undefined;
    /** The key of the extension editor tab shown after the last text language in this project's session, or undefined if none was. */
    lastExtensionEditor: string | undefined;
}

/** The text-language items and language dropdown of the editor toggle. */
export interface EditorToggleLayout {
    /** The item after Blocks, showing the active choice among the dropdown's, or else the choice made last; undefined if none. */
    trigger: EditorToggleItem | undefined;
    /** A second item beside the trigger; undefined if none. */
    second: EditorToggleItem | undefined;
    /** True if the language dropdown is shown. */
    showDropdown: boolean;
    /** True if the trigger is active and the dropdown is attached to it. */
    dropdownActive: boolean;
    /** The text languages the dropdown lists, in order. */
    dropdownLanguages: EditorToggleLanguage[];
    /** True if a separator follows the dropdown's text languages. */
    dropdownSeparator: boolean;
    /** The keys of the extension editor tabs the dropdown lists after its text languages. */
    dropdownExtensions: string[];
}

/** What decides whether the editor toggle is shown with simulator extension editor tabs. */
export interface SimxEditorTabsShownInput {
    /** The editor is an embedded (sandbox) view. */
    sandbox: boolean;
    /** The editor is read-only, as in the time machine. */
    readOnly: boolean;
    /** A tutorial is open; its views show no editor toggle. */
    tutorial: boolean;
    /** The editor is in debug mode; its menu bar shows no editor toggle. */
    debugging: boolean;
    /** The target hides the menu bar, which holds the editor toggle. */
    hideMenuBar: boolean;
    /** The target shows Blocks only, without an editor toggle. */
    blocksOnly: boolean;
}

/**
 * Returns true if the editor toggle is shown and lists the simulator extension
 * editor tabs the open project is offered: in none of the views of `input`.
 */
export function showsSimxEditorTabs(input: SimxEditorTabsShownInput): boolean {
    return !input.sandbox && !input.readOnly && !input.tutorial && !input.debugging && !input.hideMenuBar && !input.blocksOnly;
}

/** Returns the text-language items and language dropdown of the editor toggle for `input`. */
export function getEditorToggleLayout(input: EditorToggleLayoutInput): EditorToggleLayout {
    const { showJavaScript, showPython, showBlocks, pythonIsActive, extensionEditors, activeExtensionEditor, lastExtensionEditor } = input;
    const javascript: EditorToggleItem = { language: "javascript" };
    const python: EditorToggleItem = { language: "python" };

    if (!extensionEditors.length) {
        const showDropdown = showPython && showJavaScript && showBlocks;
        let trigger: EditorToggleItem;
        let second: EditorToggleItem;
        if (showDropdown) trigger = pythonIsActive ? python : javascript;
        else if (showPython && showJavaScript) {
            trigger = javascript;
            second = python;
        }
        else if (showPython) trigger = python;
        else if (showJavaScript) trigger = javascript;
        return {
            trigger,
            second,
            showDropdown,
            dropdownActive: input.python && (input.isJavaScriptActive || input.isPythonActive),
            dropdownLanguages: showDropdown ? ["javascript", "python"] : [],
            dropdownSeparator: false,
            dropdownExtensions: [],
        };
    }

    const dropdownLanguages: EditorToggleLanguage[] = [];
    if (showJavaScript) dropdownLanguages.push("javascript");
    if (showPython) dropdownLanguages.push("python");
    let trigger: EditorToggleItem;
    const textLanguageActive = input.isJavaScriptActive || input.isPythonActive;
    if (activeExtensionEditor && extensionEditors.indexOf(activeExtensionEditor) >= 0) trigger = { extension: activeExtensionEditor };
    else if (!textLanguageActive && lastExtensionEditor && extensionEditors.indexOf(lastExtensionEditor) >= 0) trigger = { extension: lastExtensionEditor };
    else if (showPython && showJavaScript) trigger = pythonIsActive ? python : javascript;
    else if (showPython) trigger = python;
    else if (showJavaScript) trigger = javascript;
    else trigger = { extension: extensionEditors[0] };
    return {
        trigger,
        second: undefined,
        showDropdown: true,
        dropdownActive: textLanguageActive || !!activeExtensionEditor,
        dropdownLanguages,
        dropdownSeparator: dropdownLanguages.length > 0,
        dropdownExtensions: extensionEditors.slice(),
    };
}

/** What the editor toggle shows for a simulator extension's editor tab. */
export interface SimxEditorMenuItemContent {
    /** The item's text: always the tab's label. */
    text: string;
    /** The item's accessible name and tooltip: always the tab's label. */
    ariaLabel: string;
    /** The class names of the font icon shown before the text; undefined if none is. */
    icon: string | undefined;
    /** The URL of the SVG shown before the text, as a mask over the text's color; undefined if none is. */
    iconUrl: string | undefined;
}

/** Returns what the editor toggle shows for `editor`: its label, after its font icon or SVG icon, if any. */
export function getSimxEditorMenuItemContent(editor: pxt.editor.SimulatorExtensionEditorInfo): SimxEditorMenuItemContent {
    return {
        text: editor.label,
        ariaLabel: editor.label,
        icon: editor.iconUrl ? undefined : editor.icon,
        iconUrl: editor.iconUrl,
    };
}

/** The inline style that masks an SVG icon's element with the SVG at `iconUrl`; the stylesheet gives the rest of the mask and the element's box. */
export function getSimxEditorIconMaskStyle(iconUrl: string): { maskImage: string, WebkitMaskImage: string } {
    // a CSS string: quotes and backslashes in the URL are escaped
    const image = `url("${iconUrl.replace(/["\\]/g, "\\$&")}")`;
    return { maskImage: image, WebkitMaskImage: image };
}
