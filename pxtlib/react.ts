namespace pxt.react {
    export interface FieldEditorView {
        show(): void;
        hide(): void;
        getResult(): string;
        onHide(cb: () => void): void;
    }

    export let getFieldEditorView: (fieldEditorId: string, value: string, options: any) => FieldEditorView;
}