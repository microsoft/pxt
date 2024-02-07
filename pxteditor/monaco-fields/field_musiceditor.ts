import { MonacoReactFieldEditor } from "./field_react";
import { MonacoFieldEditorDefinition, registerMonacoFieldEditor } from "./monacoFieldEditor";

const fieldEditorId = "music-editor";

export class MonacoSongEditor extends MonacoReactFieldEditor<pxt.Song> {
    protected isPython: boolean;
    protected isAsset: boolean;
    protected text: string;

    protected textToValue(text: string): pxt.Song {
        this.isPython = text.indexOf("`") === -1
        this.text = text;

        const match = pxt.parseAssetTSReference(text);
        if (match) {
            const { type, name: matchedName } = match;
            const name = matchedName.trim();
            const project = pxt.react.getTilemapProject();
            this.isAsset = true;
            const asset = project.lookupAssetByName(pxt.AssetType.Song, name);
            if (asset) {
                return asset;
            }
            else {
                const newAsset = project.createNewSong(pxt.assets.music.getEmptySong(2));

                if (name && !project.isNameTaken(pxt.AssetType.Song, name) && pxt.validateAssetName(name)) {
                    newAsset.meta.displayName = name;
                }

                return newAsset;
            }
        }

        const hexLiteralMatch = /hex\s*(?:`|\(""")\s*([a-fA-F0-9]*)\s*(?:`|"""\))\s*(?:;?)/m.exec(text);

        if (hexLiteralMatch) {
            const contents = hexLiteralMatch[1].trim();

            if (contents) {
                return createFakeAsset(pxt.assets.music.decodeSongFromHex(contents));
            }

            return createFakeAsset(pxt.assets.music.getEmptySong(2));
        }

        return undefined; // never
    }

    protected resultToText(result: pxt.Song): string {
        if (result.meta?.displayName) {
            const project = pxt.react.getTilemapProject();
            if (this.isAsset || project.lookupAsset(result.type, result.id)) {
                result = project.updateAsset(result)
            } else {
                result = project.createNewSong(result.song, result.meta.displayName);
            }
            this.isAsset = true;
            return pxt.getTSReferenceForAsset(result, this.isPython);
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

export const songEditorDefinition: MonacoFieldEditorDefinition = {
    id: fieldEditorId,
    foldMatches: true,
    glyphCssClass: "fas fa-music sprite-focus-hover",
    heightInPixels: 510,
    matcher: {
        /**
         * This is horrendous-looking regex matches both the asset reference syntax:
         *     assets.song`name`
         *     assets.song("""name""")
         *
         * and the hex-literal syntax:
         *     music.createSong(hex`01234`
         *     music.create_song(hex("""01234""")
         *
         * For the hex literal matches, it includes the call to music.createSong since
         * hex buffers can also be used for other things
         */
        searchString: "(?:(?:assets\\s*\\.\\s*song)|(?:music\\s*\\.\\s*create(?:S|_s)ong\\s*\\(\\s*hex))\\s*(?:`|\\(\\s*\"\"\")(?:(?:[^(){}:\\[\\]\"';?/,+\\-=*&|^%!`~]|\\n)*)\\s*(?:`|\"\"\"\\s*\\))",
        isRegex: true,
        matchCase: true,
        matchWholeWord: false
    },
    proto: MonacoSongEditor
};

registerMonacoFieldEditor(fieldEditorId, songEditorDefinition);