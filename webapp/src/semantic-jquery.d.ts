interface JQuery {
    dropdown: any;
    popup: any;
    modal: any;
    dimmer: any;
}

declare var require: any;

declare namespace AceAjax {
    export interface CommandManager {
        on(eventName: string, cb: (e: { command: EditorCommand; }) => void): void;
    }

    export interface TextMode {
        $id: string;
    }

    export interface Editor {
        on(ev: 'change', callback: (ev: EditorChangeEvent) => any): void;
        on(ev: string, callback: Function): void;
    }
}