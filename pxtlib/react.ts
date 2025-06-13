namespace pxt.react {
    export interface FieldEditorView<U> {
        show(): void;
        hide(): void;
        getResult(): U;
        onHide(cb: () => void): void;

        getPersistentData(): any;
        restorePersistentData(value: any): void;
    }

    export let isFieldEditorViewVisible: () => boolean;
    export let getFieldEditorView: <U>(fieldEditorId: string, value: U, options: any, container?: HTMLDivElement, keyboardTriggered?: boolean) => FieldEditorView<U>;
    export let getTilemapProject: () => TilemapProject;
}