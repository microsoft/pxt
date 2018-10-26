/// <reference path="../localtypings/monaco.d.ts" />

namespace pxtblockly {
    export interface TextEdit {
        range: monaco.Range;
        replacement: string;
    }

    export interface MonacoRangeInfo {
        icon: string;
        fold?: boolean;
    }

    export interface MonacoFieldEditorHost {
        contentDiv(): HTMLDivElement;
        getText(range: monaco.Range): string;
        blocksInfo(): pxtc.BlocksInfo;
    }

    export interface MonacoFieldEditor {
        getId(): string;
        getRangeInfo(range: monaco.Range, host: MonacoFieldEditorHost): MonacoRangeInfo;
        showEditorAsync(editrange: monaco.Range, host: MonacoFieldEditorHost): Promise<TextEdit>;
        dispose(): void;
    }

    export interface MonacoFieldEditorDefinition {
        id: string;
        matcher: pxtc.service.SymbolMatcher;
        proto: { new(): MonacoFieldEditor };
    }
}