/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
'use strict';

import {LanguageServiceDefaultsImpl} from './monaco.contribution';
import {TypeScriptWorker} from './worker';

import Promise = monaco.Promise;
import IDisposable = monaco.IDisposable;
import Uri = monaco.Uri;

export class WorkerManager {

    private _defaults: LanguageServiceDefaultsImpl;
    private _configChangeListener: IDisposable;

    private _worker: monaco.editor.MonacoWebWorker<TypeScriptWorker>;
    private _client: Promise<TypeScriptWorker>;

    constructor(defaults: LanguageServiceDefaultsImpl) {
        this._defaults = defaults;
        this._worker = null;
        this._configChangeListener = this._defaults.onDidChange(() => this._stopWorker());
    }

    private _stopWorker(): void {
        if (this._worker) {
            this._worker.dispose();
            this._worker = null;
        }
        this._client = null;
    }

    dispose(): void {
        this._configChangeListener.dispose();
        this._stopWorker();
    }

    private _getClient(): Promise<TypeScriptWorker> {
        if (!this._client) {
            this._worker = monaco.editor.createWebWorker<TypeScriptWorker>({

                // module that exports the create() method and returns a `TypeScriptWorker` instance
                moduleId: 'vs/language/typescript/src/worker',

                // passed in to the create() method
                createData: {
                    compilerOptions: this._defaults.compilerOptions,
                    extraLibs: this._defaults.extraLibs
                }
            });

            this._client = this._worker.getProxy();
        }

        return this._client;
    }

    getLanguageServiceWorker(...resources: Uri[]): Promise<TypeScriptWorker> {
        let _client: TypeScriptWorker;
        return toShallowCancelPromise(
            this._getClient().then((client) => {
                _client = client
            }).then(_ => {
                return this._worker.withSyncedResources(resources)
            }).then(_ => _client)
        );
    }
}

function toShallowCancelPromise<T>(p: Promise<T>): Promise<T> {
    let completeCallback: (value: T) => void;
    let errorCallback: (err: any) => void;

    let r = new Promise<T>((c, e) => {
        completeCallback = c;
        errorCallback = e;
    }, () => { });

    p.then(completeCallback, errorCallback);

    return r;
}
