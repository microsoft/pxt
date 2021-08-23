/// <reference path="./monaco.d.ts" />

/**
 * A few types used by webapp/src/tsworker.ts
 *
 * These types should be exported by monaco-typescript, but they aren't
 */
 declare namespace monaco.languages.typescript {
    export interface CustomTSWebWorkerFactory {
        (
            TSWorkerClass: typeof TSWorker,
            tsc: any,
            libs: Record<string, string>
        ): typeof TSWorker;
    }

    export interface ICreateData {
        compilerOptions: ts.CompilerOptions;
        extraLibs: IExtraLibs;
        customWorkerPath?: string;
    }

    export class TSWorker implements TypeScriptWorker {
        constructor(ctx: monaco.worker.IWorkerContext, createData: ICreateData);
        /**
         * Get diagnostic messages for any syntax issues in the given file.
         */
        getSyntacticDiagnostics(fileName: string): Promise<Diagnostic[]>;
        /**
         * Get diagnostic messages for any semantic issues in the given file.
         */
        getSemanticDiagnostics(fileName: string): Promise<Diagnostic[]>;
        /**
         * Get diagnostic messages for any suggestions related to the given file.
         */
        getSuggestionDiagnostics(fileName: string): Promise<Diagnostic[]>;
        /**
         * Get the content of a given file.
         */
        getScriptText(fileName: string): Promise<string | undefined>;
        /**
         * Get diagnostic messages related to the current compiler options.
         * @param fileName Not used
         */
        getCompilerOptionsDiagnostics(fileName: string): Promise<Diagnostic[]>;
        /**
         * Get code completions for the given file and position.
         * @returns `Promise<typescript.CompletionInfo | undefined>`
         */
        getCompletionsAtPosition(fileName: string, position: number): Promise<any | undefined>;
        /**
         * Get code completion details for the given file, position, and entry.
         * @returns `Promise<typescript.CompletionEntryDetails | undefined>`
         */
        getCompletionEntryDetails(
            fileName: string,
            position: number,
            entry: string
        ): Promise<any | undefined>;
        /**
         * Get signature help items for the item at the given file and position.
         * @returns `Promise<typescript.SignatureHelpItems | undefined>`
         */
        getSignatureHelpItems(
            fileName: string,
            position: number,
            options: any
        ): Promise<any | undefined>;
        /**
         * Get quick info for the item at the given position in the file.
         * @returns `Promise<typescript.QuickInfo | undefined>`
         */
        getQuickInfoAtPosition(fileName: string, position: number): Promise<any | undefined>;
        /**
         * Get other ranges which are related to the item at the given position in the file (often used for highlighting).
         * @returns `Promise<ReadonlyArray<typescript.ReferenceEntry> | undefined>`
         */
        getOccurrencesAtPosition(
            fileName: string,
            position: number
        ): Promise<ReadonlyArray<any> | undefined>;
        /**
         * Get the definition of the item at the given position in the file.
         * @returns `Promise<ReadonlyArray<typescript.DefinitionInfo> | undefined>`
         */
        getDefinitionAtPosition(
            fileName: string,
            position: number
        ): Promise<ReadonlyArray<any> | undefined>;
        /**
         * Get references to the item at the given position in the file.
         * @returns `Promise<typescript.ReferenceEntry[] | undefined>`
         */
        getReferencesAtPosition(fileName: string, position: number): Promise<any[] | undefined>;
        /**
         * Get outline entries for the item at the given position in the file.
         * @returns `Promise<typescript.NavigationBarItem[]>`
         */
        getNavigationBarItems(fileName: string): Promise<any[]>;
        /**
         * Get changes which should be applied to format the given file.
         * @param options `typescript.FormatCodeOptions`
         * @returns `Promise<typescript.TextChange[]>`
         */
        getFormattingEditsForDocument(fileName: string, options: any): Promise<any[]>;
        /**
         * Get changes which should be applied to format the given range in the file.
         * @param options `typescript.FormatCodeOptions`
         * @returns `Promise<typescript.TextChange[]>`
         */
        getFormattingEditsForRange(
            fileName: string,
            start: number,
            end: number,
            options: any
        ): Promise<any[]>;
        /**
         * Get formatting changes which should be applied after the given keystroke.
         * @param options `typescript.FormatCodeOptions`
         * @returns `Promise<typescript.TextChange[]>`
         */
        getFormattingEditsAfterKeystroke(
            fileName: string,
            postion: number,
            ch: string,
            options: any
        ): Promise<any[]>;
        /**
         * Get other occurrences which should be updated when renaming the item at the given file and position.
         * @returns `Promise<readonly typescript.RenameLocation[] | undefined>`
         */
        findRenameLocations(
            fileName: string,
            positon: number,
            findInStrings: boolean,
            findInComments: boolean,
            providePrefixAndSuffixTextForRename: boolean
        ): Promise<readonly any[] | undefined>;
        /**
         * Get edits which should be applied to rename the item at the given file and position (or a failure reason).
         * @param options `typescript.RenameInfoOptions`
         * @returns `Promise<typescript.RenameInfo>`
         */
        getRenameInfo(fileName: string, positon: number, options: any): Promise<any>;
        /**
         * Get transpiled output for the given file.
         * @returns `typescript.EmitOutput`
         */
        getEmitOutput(fileName: string): Promise<EmitOutput>;
        /**
         * Get possible code fixes at the given position in the file.
         * @param formatOptions `typescript.FormatCodeOptions`
         * @returns `Promise<ReadonlyArray<typescript.CodeFixAction>>`
         */
        getCodeFixesAtPosition(
            fileName: string,
            start: number,
            end: number,
            errorCodes: number[],
            formatOptions: any
        ): Promise<ReadonlyArray<any>>;
    }
}
