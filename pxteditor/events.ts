namespace pxt.events {

    export type EditorType = 'blocks' | 'ts';

    export interface PXTEvent {
        type: string;
        editor: EditorType;
    }

    export interface CreateEvent extends PXTEvent {
        type: "create";
        blockId: string;
    }

    export interface UIEvent extends PXTEvent {
        type: "ui";
        action: "groupHelpClicked";
        data?: pxt.Map<string>;
    }
}
