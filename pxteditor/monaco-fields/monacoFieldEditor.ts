/// <reference path="../../localtypings/monaco.d.ts" />

namespace pxt.editor {
    export interface TextEdit {
        range: monaco.Range;
        replacement: string;
    }

    export interface MonacoFieldEditorHost {
        contentDiv(): HTMLDivElement;
        getText(range: monaco.Range): string;
        blocksInfo(): pxtc.BlocksInfo;
    }

    export interface MonacoFieldEditor {
        getId(): string;
        showEditorAsync(fileType: FileType, editrange: monaco.Range, host: MonacoFieldEditorHost): Promise<TextEdit>;
        onClosed(): void;
        dispose(): void;
    }

    export interface MonacoFieldEditorDefinition {
        id: string;
        matcher: MonacoFindArguments;
        foldMatches?: boolean;
        glyphCssClass?: string;
        proto: { new(): MonacoFieldEditor };
        heightInPixels?: number;
    }

    export interface MonacoFindArguments {
        searchString: string;
        isRegex: boolean;
        matchWholeWord: boolean;
        matchCase: boolean;
    }

    const definitions: pxt.Map<MonacoFieldEditorDefinition> = {};

    export function registerMonacoFieldEditor(name: string, definition: MonacoFieldEditorDefinition) {
        definitions[name] = definition;
    }

    export function getMonacoFieldEditor(name: string) {
        return definitions[name];
    }
}