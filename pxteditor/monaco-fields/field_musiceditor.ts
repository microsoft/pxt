import { MonacoReactFieldEditor } from "./field_react";
import { registerMonacoFieldEditor } from "./monacoFieldEditor";

const fieldEditorId = "music-editor";

export class MonacoSongEditor extends MonacoReactFieldEditor<pxt.Song> {
    protected isPython: boolean;
    protected isAsset: boolean;
    protected text: string;
    protected editing: pxt.Asset;

    protected textToValue(text: string): pxt.Song {
        this.isPython = text.indexOf("`") === -1
        this.text = text;

        const match = pxt.parseAssetTSReference(text);
        if (match) {
            const { name: matchedName } = match;
            const name = matchedName.trim();
            const project = pxt.react.getTilemapProject();
            this.isAsset = true;
            const asset = project.lookupAssetByName(pxt.AssetType.Song, name);
            if (asset) {
                this.editing = asset;
                return asset;
            }
            else {
                const newAsset = project.createNewSong(pxt.assets.music.getEmptySong(2));

                if (name && !project.isNameTaken(pxt.AssetType.Song, name) && pxt.validateAssetName(name)) {
                    newAsset.meta.displayName = name;
                }

                this.editing = newAsset;

                return newAsset;
            }
        }

        const hexLiteralMatch = /hex\s*(?:`|\(""")\s*([a-fA-F0-9]*)\s*(?:`|"""\))\s*(?:;?)/m.exec(text);

        if (hexLiteralMatch) {
            const contents = hexLiteralMatch[1].trim();

            if (contents) {
                this.editing = createFakeAsset(pxt.assets.music.decodeSongFromHex(contents));
            }
            else {
                this.editing = createFakeAsset(pxt.assets.music.getEmptySong(2));
            }

            return this.editing;
        }

        return undefined; // never
    }

    protected resultToText(result: pxt.Song): string {
        const project = pxt.react.getTilemapProject();
        project.pushUndo();

        result = pxt.patchTemporaryAsset(this.editing, result, project) as pxt.Song;
        if (result.meta?.displayName) {
            if (this.isAsset || project.lookupAsset(result.type, result.id)) {
                result = project.updateAsset(result)
            } else {
                result = project.createNewSong(result.song, result.meta.displayName);
            }
            let out = pxt.getTSReferenceForAsset(result, this.isPython);
            if (!this.isAsset) {
                if (this.isPython) {
                    out = `music.create_song(${out})`;
                }
                else {
                    out = `music.createSong(${out})`;
                }
            }
            return out;
        }

        let hexString = pxt.assets.music.encodeSongToHex(result.song);
        if (this.isPython) {
            hexString = `hex("""${hexString}""")`;
        }
        else {
            hexString = "hex`" + hexString + "`";
        }

        return this.text.replace(/hex\s*(?:`|\(""")\s*([a-fA-F0-9]*)\s*(?:`|"""\))\s*(?:;?)/m, hexString)
    }

    protected getFieldEditorId() {
        return fieldEditorId;
    }
    protected getOptions(): any {
        return {
            blocksInfo: this.host.blocksInfo()
        };
    }
}

function createFakeAsset(song: pxt.assets.music.Song): pxt.Song {
    return {
        type: pxt.AssetType.Song,
        id: "",
        internalID: 0,
        meta: {},
        song
    }
}

const regexes = [
    // typescript
    "music\\s*\\.\\s*createSong\\s*\\(\\s*hex`[a-fA-F0-9\\s\\n]*`\\s*\\)",
    "assets\\s*\\.\\s*song\\s*`[a-zA-Z_\\s\\n]*`",

    // python
    'music\\s*\\.\\s*create_song\\s*\\(\\s*hex\\s*\\(\\s*"""[a-fA-F0-9\\s\\n]*"""\\s*\\)\\s*\\)',
    'music\\s*\\.\\s*createSong\\s*\\(\\s*hex\\s*\\(\\s*"""[a-fA-F0-9\\s\\n]*"""\\s*\\)\\s*\\)',
    'assets\\s*\\.\\s*song\\s*\\(\\s*"""[a-zA-Z_\\s\\n]*"""\\s*\\)'
];

const searchString = regexes.map(r => `(?:${r})`).join("|");

export const songEditorDefinition: pxt.editor.MonacoFieldEditorDefinition = {
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
    proto: MonacoSongEditor
};

registerMonacoFieldEditor(fieldEditorId, songEditorDefinition);