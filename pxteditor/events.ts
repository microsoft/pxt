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

        private blockId: string;

        constructor(editor: EditorType, blockId: string) {
            super(editor);
            this.blockId = blockId;
        }

        getBlockId() {
            return this.blockId;
        }
    }

    export function fire(ev: pxt.events.Event) {
        if (!isEnabled()) return;
        if (eventListener) eventListener(ev);
        console.log('pxt event: ', ev);
    }

    let disabled_ = 0;

    export function disable() {
        disabled_++;
    }

    export function enable() {
        disabled_--;
    }

    export function isEnabled() {
        return disabled_ == 0;
    }

    // Overriden by targets
    export let eventListener: (ev: pxt.events.Event) => void = undefined;
}

