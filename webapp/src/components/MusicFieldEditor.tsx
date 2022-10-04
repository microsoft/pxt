import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { AssetEditorCore } from "./ImageFieldEditor";
import { MusicEditor } from "./musicEditor/MusicEditor";

interface MusicFieldEditorProps {

}

interface MusicFieldEditorState {
    editingSong?: pxt.Song;
}

export class MusicFieldEditor extends React.Component<MusicFieldEditorProps, MusicFieldEditorState> implements AssetEditorCore {
    protected mostRecentValue: pxt.assets.music.Song;

    constructor(props: MusicFieldEditorProps) {
        super(props);
        this.state = {
        }
    }

    render() {
        const { editingSong } = this.state;

        return <div className="music-field-editor">
            { editingSong &&
                <MusicEditor
                    song={editingSong.song}
                    onSongChanged={this.onSongChanged}
                    assetName={editingSong.meta.displayName}
                    onAssetNameChanged={this.onAssetNameChanged} />
            }
        </div>
    }

    getAsset(): pxt.Song {
        if (!this.state.editingSong) return undefined;
        return {
            ...this.state.editingSong,
            song: this.mostRecentValue || this.state.editingSong.song
        }
    }

    openAsset(value: pxt.Song) {
        this.setState({
            editingSong: value
        })
    }

    openGalleryAsset(asset: pxt.Asset): void {
        // TODO
    }

    getJres(): string {
        return "";
    }

    loadJres(value: string): void {

    }

    disableResize(): void {

    }

    onResize(): void {

    }

    getPersistentData(): any {

    }

    restorePersistentData(value: any): void {

    }

    protected onSongChanged = (newSong: pxt.assets.music.Song) => {
        this.mostRecentValue = newSong;
    }

    protected onAssetNameChanged = (newName: string) => {
        this.setState({
            editingSong: {
                ...this.state.editingSong,
                meta: {
                    ...this.state.editingSong.meta,
                    displayName: newName
                }
            }
        })
    }
}