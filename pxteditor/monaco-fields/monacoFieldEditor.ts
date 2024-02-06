/// <reference path="../../localtypings/monaco.d.ts" />

export interface TextEdit {
    range: monaco.Range;
    replacement: string;
}

export interface MonacoFieldEditorHost {
    contentDiv(): HTMLDivElement;
    getText(range: monaco.Range): string;
    blocksInfo(): pxtc.BlocksInfo;

    package(): pxt.MainPackage;
    writeFileAsync(filename: string, content: string): Promise<void>;
    readFile(filename: string): string;
}

export interface MonacoFieldEditor {
    getId(): string;
    showEditorAsync(fileType: pxt.editor.FileType, editrange: monaco.Range, host: MonacoFieldEditorHost): Promise<TextEdit>;
    onClosed(): void;
    dispose(): void;
}

export interface MonacoFieldEditorDefinition {
    id: string;
    matcher: MonacoFindArguments;
    foldMatches?: boolean;
    alwaysBuildOnClose?: boolean;
    glyphCssClass?: string;
    weight?: number; // higher weight will override lower weight when on same line
    proto: { new(): MonacoFieldEditor };
    heightInPixels?: number;
}

export interface MonacoFindArguments {
    searchString: string;
    isRegex: boolean;
    matchWholeWord: boolean;
    matchCase: boolean;
    validateRange?: (range: monaco.Range, model: monaco.editor.ITextModel) => monaco.Range;
}

const definitions: pxt.Map<MonacoFieldEditorDefinition> = {};

export function registerMonacoFieldEditor(name: string, definition: MonacoFieldEditorDefinition) {
    definitions[name] = definition;
}

export function getMonacoFieldEditor(name: string) {
    return definitions[name];
}