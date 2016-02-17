interface JQuery {
    dropdown: any;
    popup: any;
    modal: any;
    dimmer: any;
}

declare var require: any;

declare module AceAjax {
    export interface CommandManager {
        on(eventName: string, cb: (e: { command: EditorCommand; }) => void): void;
    }
    
    export interface TextMode {
        $id: string;
    }

}