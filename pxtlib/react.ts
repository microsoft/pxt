namespace pxt.react {
    export interface FieldEditorView<U> {
        show(): void;
        hide(): void;
        getResult(): U;
        onHide(cb: () => void): void;

        getPersistentData(): any;
        restorePersistentData(value: any): void;
    }

    export let getFieldEditorView: <U>(fieldEditorId: string, value: U, options: any) => FieldEditorView<U>;
}