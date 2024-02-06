namespace pxt.editor {
    export let initExtensionsAsync: (opts: pxt.editor.ExtensionOptions) => Promise<pxt.editor.ExtensionResult>
        = opts => Promise.resolve<pxt.editor.ExtensionResult>({});

    export let initFieldExtensionsAsync: (opts: pxt.editor.FieldExtensionOptions) => Promise<pxt.editor.FieldExtensionResult>
        = opts => Promise.resolve<pxt.editor.FieldExtensionResult>({});

    // These interfaces are extended in localtypings/pxteditor.d.ts

    export interface ExtensionOptions {
    }

    export interface FieldExtensionResult {
    }

    export interface ExtensionResult {
    }

    export interface FieldExtensionOptions {
    }
}