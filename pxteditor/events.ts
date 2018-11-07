namespace pxt.events {

    export type EditorType = 'blocks' | 'ts';

    export interface Event {
        type: string;
        editor: EditorType;
    }

    export interface CreateEvent extends Event {
        type: "create";
        blockId: string;
    }

    export class UIEvent extends Event {
        type: 'ui';
        action: 'groupHelpClicked';
        data?: pxt.Map<string>;
    }
}
