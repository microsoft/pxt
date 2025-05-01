/// <reference path="../../localtypings/monaco.d.ts" />


const definitions: pxt.Map<pxt.editor.MonacoFieldEditorDefinition> = {};

export function registerMonacoFieldEditor(name: string, definition: pxt.editor.MonacoFieldEditorDefinition) {
    definitions[name] = definition;
}

export function getMonacoFieldEditor(name: string) {
    return definitions[name];
}