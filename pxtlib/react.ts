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
    /**
     * Returns true if the editor can create an instance of the fixed-instance
     * type `typeQName`, a fully qualified name, here: a block dropdown of the
     * type's instances then ends in an entry asking for a new one.
     */
    export let canCreateInstance: (typeQName: string) => boolean;
    /**
     * Opens whatever creates instances of the fixed-instance type `typeQName`
     * and asks it to create one; does nothing if `canCreateInstance` returns
     * false for the type.
     */
    export let createInstance: (typeQName: string) => void;
}