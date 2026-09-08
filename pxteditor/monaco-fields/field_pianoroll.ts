import { MonacoSongEditor } from "./field_musiceditor";
import { registerMonacoFieldEditor } from "./monacoFieldEditor";

const fieldEditorId = "piano-roll-editor";

export class MonacoPianoRollEditor extends MonacoSongEditor {
    protected wrapCreateSong(text: string): string {
        if (this.isPython) {
            return `pianoRoll.create_song(${text})`;
        }
        else {
            return `pianoRoll.createSong(${text})`;
        }
    }

    protected getOptions(): any {
        const opts = super.getOptions();
        opts.showTimeSignature = true;
        opts.showSnapControls = true;
        return opts;
    }

    protected getFieldEditorId() {
        return fieldEditorId;
    }
}

const regexes = [
    // typescript
    "pianoRoll\\s*\\.\\s*createSong\\s*\\(\\s*hex`[a-fA-F0-9\\s\\n]*`\\s*\\)",

    // python
    'pianoRoll\\s*\\.\\s*create_song\\s*\\(\\s*hex\\s*\\(\\s*"""[a-fA-F0-9\\s\\n]*"""\\s*\\)\\s*\\)',
    'pianoRoll\\s*\\.\\s*createSong\\s*\\(\\s*hex\\s*\\(\\s*"""[a-fA-F0-9\\s\\n]*"""\\s*\\)\\s*\\)',
];

const searchString = regexes.map(r => `(?:${r})`).join("|");

export const pianoRollEditorDefinition: pxt.editor.MonacoFieldEditorDefinition = {
    id: fieldEditorId,
    foldMatches: true,
    glyphCssClass: "fas fa-music sprite-focus-hover",
    heightInPixels: 510,
    matcher: {
        searchString: searchString,
        isRegex: true,
        matchCase: true,
        matchWholeWord: false
    },
    proto: MonacoPianoRollEditor
};

registerMonacoFieldEditor(fieldEditorId, pianoRollEditorDefinition);