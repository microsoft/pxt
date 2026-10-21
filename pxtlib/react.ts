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
     * Returns true if the editor tab of a simulator extension the open project
     * includes creates the instances of the fixed-instance type `typeQName`, a
     * fully qualified name, and the editor offers that tab here.
     */
    export let canCreateSimxInstance: (typeQName: string) => boolean;
    /**
     * Shows the editor tab that creates the instances of the fixed-instance type
     * `typeQName` and asks it to create one; does nothing if
     * `canCreateSimxInstance` returns false for the type.
     */
    export let createSimxInstance: (typeQName: string) => void;
}