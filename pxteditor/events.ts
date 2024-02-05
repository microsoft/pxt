export type EditorType = 'blocks' | 'ts';

export interface EditorEvent {
    type: string;
    editor: EditorType;
}

export interface CreateEvent extends EditorEvent {
    type: "create";
    blockId: string;
}

export interface UIEvent extends EditorEvent {
    type: "ui";
    action: "groupHelpClicked";
    data?: pxt.Map<string>;
}