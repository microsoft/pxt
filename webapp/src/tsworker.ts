/// <reference path="../../localtypings/monacoTypeScript.d.ts"/>

/**
 * This file is passed to the monaco-typescript worker in pxteditor/monaco.ts
 * It isn't used directly in the webapp.
 */
const worker: monaco.languages.typescript.CustomTSWebWorkerFactory = (TSWorkerClass, tsc, libs) => {
    return class PxtWorker extends TSWorkerClass {
        async getCompletionsAtPosition(
            fileName: string,
            position: number
        ) {
            const res: ts.CompletionInfo = await super.getCompletionsAtPosition(fileName, position)
            if (res) {
                res.entries = res.entries.filter(ent => !ent.name.startsWith("_"));
            }

            return res;
        }
    }
}

(self as any).customTSWorkerFactory = worker;