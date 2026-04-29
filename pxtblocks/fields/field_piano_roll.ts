import { FieldMusicEditor } from "./field_musiceditor";

export class FieldPianoRoll extends FieldMusicEditor {
    protected override getEditorKind() {
        return "piano-roll-editor";
    }
}