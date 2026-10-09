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
}

/** The text-language items and language dropdown of the editor toggle. */
export interface EditorToggleLayout {
    /** The item after Blocks, showing the active choice among the dropdown's; undefined if none. */
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
    const { showJavaScript, showPython, showBlocks, pythonIsActive, extensionEditors, activeExtensionEditor } = input;
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
    if (activeExtensionEditor && extensionEditors.indexOf(activeExtensionEditor) >= 0) trigger = { extension: activeExtensionEditor };
    else if (showPython && showJavaScript) trigger = pythonIsActive ? python : javascript;
    else if (showPython) trigger = python;
    else if (showJavaScript) trigger = javascript;
    else trigger = { extension: extensionEditors[0] };
    return {
        trigger,
        second: undefined,
        showDropdown: true,
        dropdownActive: input.isJavaScriptActive || input.isPythonActive || !!activeExtensionEditor,
        dropdownLanguages,
        dropdownSeparator: dropdownLanguages.length > 0,
        dropdownExtensions: extensionEditors.slice(),
    };
}

/** What the editor toggle shows for a simulator extension's editor tab. */
export interface SimxEditorMenuItemContent {
    /** The tab's label: the item's text, or the image's alternative text. */
    text: string;
    /** The item's accessible name and tooltip: always the tab's label. */
    ariaLabel: string;
    /** The icon shown before the text; undefined if none is, or an image is shown. */
    icon: string | undefined;
    /** The URL of the image shown in place of the text and icon; undefined if none is. */
    image: string | undefined;
}

/** Returns what the editor toggle shows for `editor`: its wordmark if it has one, else its icon, if any, and label. */
export function getSimxEditorMenuItemContent(editor: pxt.editor.SimulatorExtensionEditorInfo): SimxEditorMenuItemContent {
    return {
        text: editor.label,
        ariaLabel: editor.label,
        icon: editor.wordmarkUrl ? undefined : editor.icon,
        image: editor.wordmarkUrl,
    };
}
