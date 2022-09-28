/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="./field_asset.ts" />


namespace pxtblockly {
    export interface FieldMusicEditorOptions {
    }

    interface ParsedFieldMusicEditorOptions {
    }

    export class FieldMusicEditor extends FieldAssetEditor<FieldMusicEditorOptions, ParsedFieldMusicEditorOptions> {
        protected getAssetType(): pxt.AssetType {
            return pxt.AssetType.Song;
        }

        protected createNewAsset(text?: string): pxt.Asset {
            const project = pxt.react.getTilemapProject();
            if (text) {
                const asset = pxt.lookupProjectAssetByTSReference(text, project);

                if (asset) return asset;
            }

            if (this.getBlockData()) {
                return project.lookupAsset(pxt.AssetType.Song, this.getBlockData());
            }

            let song: pxt.assets.music.Song;

            if (text) {
                const match = /^\s*hex\s*`([a-fA-F0-9]+)`\s*(?:;?)\s*$/.exec(text);

                if (match) {
                    song = pxt.assets.music.decodeSongFromHex(match[1]);
                }
            }
            else {
                song = pxt.assets.music.getEmptySong(2);
            }

            if (!song) {
                this.isGreyBlock = true;
                this.valueText = text;
                return undefined;
            }
            else {
                // Restore all of the unused tracks
                inflateSong(song);
            }

            const newAsset: pxt.Song = {
                internalID: -1,
                id: this.sourceBlock_.id,
                type: pxt.AssetType.Song,
                meta: {
                },
                song
            };

            return newAsset;
        }

        protected getValueText(): string {
            if (this.asset && !this.isTemporaryAsset()) {
                return pxt.getTSReferenceForAsset(this.asset);
            }
            return this.asset ? `hex\`${pxt.assets.music.encodeSongToHex((this.asset as pxt.Song).song)}\`` : "";
        }

        protected parseFieldOptions(opts: FieldMusicEditorOptions): ParsedFieldMusicEditorOptions {
            return {};
        }
    }

    function inflateSong(song: pxt.assets.music.Song) {
        const base = pxt.assets.music.getEmptySong(1);

        song.tracks = base.tracks.map((track, index) => {
            const existing = song.tracks.find(t => t.id === index);
            if (existing) track.notes = existing.notes;
            return track;
        })
    }
}
