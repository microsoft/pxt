namespace pxt.events {

    export type EditorType = 'blocks' | 'js';

    export interface Event {
        type: string;
        editor: EditorType;
    }

    export abstract class AbstractEvent implements Event {
        abstract type: string;
        editor: EditorType;

        constructor(editor: EditorType) {
            this.editor = editor;
        }
    }

    export class CreateEvent extends AbstractEvent {
        type = 'create';

        constructor(editor: EditorType, private blockId: string) {
            super(editor);
        }

        getBlockId() {
            return this.blockId;
        }
    }

    export class UIEvent extends AbstractEvent {
        type = 'ui';

        constructor(editor: EditorType, private action: string, private data: pxt.Map<string>) {
            super(editor);
        }

        getAction() {
            return this.action;
        }

        getData() {
            return this.data;
        }
    }
}
