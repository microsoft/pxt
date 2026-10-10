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

// PR NOTE [Issue 6] -- lift into the PR description, then remove.
// Simulator extension editor tabs are entries of the existing language
// dropdown, after JavaScript and Python under a separator, never items of
// their own on the bar. While one is offered the dropdown is shown even
// where the target shows none, and the item before it shows the active
// choice, so the bar reads Blocks | <tab> while a tab is active. With no
// tab offered the layout is the toggle's own.
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
    // PR NOTE [Issue 6] -- lift into the PR description, then remove.
    // While no text language and no tab is active (Blocks, say), the trigger
    // shows the tab shown last, if it is still offered, as it shows Python
    // when Python was the text language chosen last; with no such tab it
    // shows the text language chosen last, as the toggle does.
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

// PR NOTE [Issue 6] -- lift into the PR description, then remove.
// A tab shows as MakeCode's own editors do: its label as text, with its
// icon, if any, on the text's left. The icon is a font icon's class names,
// rendered as JavaScript's and Python's are, or an SVG's URL, rendered as a
// CSS mask over the item's text color, so it follows every color theme,
// high contrast included, as the font icons do.
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
