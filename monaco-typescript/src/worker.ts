/// <reference path="../lib/typescriptServices.d.ts"/>
/// <reference path="../../built/pxtlib.d.ts"/>

/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
'use strict';

import typescript = require('../lib/typescriptServices');
import {contents as libdts} from '../lib/lib-ts';
import {contents as libes6ts} from '../lib/lib-es6-ts';

import Promise = monaco.Promise;
import IWorkerContext = monaco.worker.IWorkerContext;

const DEFAULT_LIB = {
    NAME: 'defaultLib:lib.d.ts',
    CONTENTS: libdts
};

const ES6_LIB = {
    NAME: 'defaultLib:lib.es6.d.ts',
    CONTENTS: libes6ts
};

export class TypeScriptWorker implements typescript.LanguageServiceHost {

    // --- model sync -----------------------

    private _ctx: IWorkerContext;
    private _extraLibs: { [fileName: string]: string } = Object.create(null);
    private _languageService = typescript.createLanguageService(this);
    private _compilerOptions: typescript.CompilerOptions;

    constructor(ctx: IWorkerContext, createData: ICreateData) {
        this._ctx = ctx;
        this._compilerOptions = createData.compilerOptions;
        this._extraLibs = createData.extraLibs;
    }

    // --- language service host ---------------

    getCompilationSettings(): typescript.CompilerOptions {
        return this._compilerOptions;
    }

    getScriptFileNames(): string[] {
        let models = this._ctx.getMirrorModels().map(model => model.uri.toString());
        return models.concat(Object.keys(this._extraLibs));
    }

    private _getModel(fileName: string): monaco.worker.IMirrorModel {
        let models = this._ctx.getMirrorModels();
        for (let i = 0; i < models.length; i++) {
            if (models[i].uri.toString() === fileName) {
                return models[i];
            }
        }
        return null;
    }

    getScriptVersion(fileName: string): string {
        let model = this._getModel(fileName);
        if (model) {
            return model.version.toString();
        } else if (this.isDefaultLibFileName(fileName) || fileName in this._extraLibs) {
            // extra lib and default lib are static
            return '1';
        }
        return null;
    }

    getScriptSnapshot(fileName: string): typescript.IScriptSnapshot {
        let text: string;
        let model = this._getModel(fileName);
        if (model) {
            // a true editor model
            text = model.getValue();

        } else if (fileName in this._extraLibs) {
            // static extra lib
            text = this._extraLibs[fileName];

        } else if (fileName === DEFAULT_LIB.NAME) {
            text = DEFAULT_LIB.CONTENTS;
        } else if (fileName === ES6_LIB.NAME) {
            text = ES6_LIB.CONTENTS;
        } else {
            return;
        }

        return <typescript.IScriptSnapshot>{
            getText: (start, end) => text.substring(start, end),
            getLength: () => text.length,
            getChangeRange: () => undefined
        };
    }

    getCurrentDirectory(): string {
        return '';
    }

    getDefaultLibFileName(options: typescript.CompilerOptions): string {
        // TODO@joh support lib.es7.d.ts
        return options.target > typescript.ScriptTarget.ES5 ? DEFAULT_LIB.NAME : ES6_LIB.NAME;
    }

    isDefaultLibFileName(fileName: string): boolean {
        return fileName === this.getDefaultLibFileName(this._compilerOptions);
    }

    // --- language features

    getSyntacticDiagnostics(fileName: string): Promise<typescript.Diagnostic[]> {
        const diagnostics = this._languageService.getSyntacticDiagnostics(fileName);
        diagnostics.forEach(diag => diag.file = undefined); // diag.file cannot be JSON'yfied
        return Promise.as(diagnostics);
    }

    getSemanticDiagnostics(fileName: string): Promise<typescript.Diagnostic[]> {
        const diagnostics = this._languageService.getSemanticDiagnostics(fileName);
        diagnostics.forEach(diag => diag.file = undefined); // diag.file cannot be JSON'yfied
        return Promise.as(diagnostics);
    }

    getCompilerOptionsDiagnostics(fileName: string): Promise<typescript.Diagnostic[]> {
        const diagnostics = this._languageService.getCompilerOptionsDiagnostics();
        diagnostics.forEach(diag => diag.file = undefined); // diag.file cannot be JSON'yfied
        return Promise.as(diagnostics);
    }

    getCompletionsAtPosition(fileName: string, position: number): Promise<typescript.CompletionInfo> {
        return Promise.as(this._languageService.getCompletionsAtPosition(fileName, position));
    }

    getCompletionEntryDetails(fileName: string, position: number, entry: string): Promise<typescript.CompletionEntryDetails> {
        return Promise.as(this._languageService.getCompletionEntryDetails(fileName, position, entry));
    }

    getSignatureHelpItems(fileName: string, position: number): Promise<typescript.SignatureHelpItems> {
        return Promise.as(this._languageService.getSignatureHelpItems(fileName, position));
    }

    getQuickInfoAtPosition(fileName: string, position: number): Promise<typescript.QuickInfo> {
        return Promise.as(this._languageService.getQuickInfoAtPosition(fileName, position));
    }

    getOccurrencesAtPosition(fileName: string, position: number): Promise<typescript.ReferenceEntry[]> {
        return Promise.as(this._languageService.getOccurrencesAtPosition(fileName, position));
    }

    getDefinitionAtPosition(fileName: string, position: number): Promise<typescript.DefinitionInfo[]> {
        return Promise.as(this._languageService.getDefinitionAtPosition(fileName, position));
    }

    getReferencesAtPosition(fileName: string, position: number): Promise<typescript.ReferenceEntry[]> {
        return Promise.as(this._languageService.getReferencesAtPosition(fileName, position));
    }

    getNavigationBarItems(fileName: string): Promise<typescript.NavigationBarItem[]> {
        return Promise.as(this._languageService.getNavigationBarItems(fileName));
    }

    getNavigateToItems(searchValue: string, maxResultCount?: number): Promise<typescript.NavigateToItem[]> {
        return Promise.as(this._languageService.getNavigateToItems(searchValue, maxResultCount));
    }

    getFormattingEditsForDocument(fileName: string, options: typescript.FormatCodeOptions): Promise<typescript.TextChange[]> {
        return Promise.as(this._languageService.getFormattingEditsForDocument(fileName, options));
    }

    getFormattingEditsForRange(fileName: string, start: number, end: number, options: typescript.FormatCodeOptions): Promise<typescript.TextChange[]> {
        return Promise.as(this._languageService.getFormattingEditsForRange(fileName, start, end, options));
    }

    getFormattingEditsAfterKeystroke(fileName: string, postion: number, ch: string, options: typescript.FormatCodeOptions): Promise<typescript.TextChange[]> {
        return Promise.as(this._languageService.getFormattingEditsAfterKeystroke(fileName, postion, ch, options));
    }

    getEmitOutput(fileName: string): Promise<typescript.EmitOutput> {
        return Promise.as(this._languageService.getEmitOutput(fileName));
    }

    getEncodedSyntacticClassifications(fileName: string, textSpan: typescript.TextSpan): Promise<typescript.Classifications> {
        return Promise.as(this._languageService.getEncodedSyntacticClassifications(fileName, textSpan));
    }

    getEncodedSemanticClassifications(fileName: string, textSpan: typescript.TextSpan): Promise<typescript.Classifications> {
        return Promise.as(this._languageService.getEncodedSemanticClassifications(fileName, textSpan));
    }
}

export interface ICreateData {
    compilerOptions: typescript.CompilerOptions;
    extraLibs: { [path: string]: string };
}

export function create(ctx: IWorkerContext, createData: ICreateData): TypeScriptWorker {
    return new TypeScriptWorker(ctx, createData);
}
