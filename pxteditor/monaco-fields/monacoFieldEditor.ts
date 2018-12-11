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
        showEditorAsync(editrange: monaco.Range, host: MonacoFieldEditorHost): Promise<TextEdit>;
        onClosed(): void;
        dispose(): void;
    }

    export interface MonacoFieldEditorDefinition {
        id: string;
        matcher: MonacoFindArguments;
        foldMatches?: boolean;
        glyphCssClass?: string;
        proto: { new(): MonacoFieldEditor };
    }

    export interface MonacoFindArguments {
        searchString: string;
        isRegex: boolean;
        matchWholeWord: boolean;
        matchCase: boolean;
    }
}