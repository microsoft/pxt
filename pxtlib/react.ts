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
    /**
     * Returns true if the editor can open the fixed instance `instanceQName`, a
     * fully qualified name, here: a block dropdown holding the instance then
     * offers an entry asking to edit it.
     */
    export let canOpenInstance: (instanceQName: string) => boolean;
    /**
     * Opens whatever edits the fixed instance `instanceQName` and asks it to
     * open the instance; does nothing if `canOpenInstance` returns false for
     * the instance.
     */
    export let openInstance: (instanceQName: string) => void;
}