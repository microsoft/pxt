import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { AssetEditorCore } from "./ImageFieldEditor";
import { MusicEditor } from "./musicEditor/MusicEditor";

interface MusicFieldEditorProps {
    onDoneClicked: () => void;
    hideDoneButton?: boolean;
}

interface MusicFieldEditorState {
    editingSong?: pxt.Song;
    editRef: number;
}

export class MusicFieldEditor extends React.Component<MusicFieldEditorProps, MusicFieldEditorState> implements AssetEditorCore {
    protected mostRecentValue: pxt.assets.music.Song;

    constructor(props: MusicFieldEditorProps) {
        super(props);
        this.state = {
            editRef: 0
        }
    }

    render() {
        const { onDoneClicked } = this.props;
        const { editingSong } = this.state;

        return <div className="music-field-editor">
            { editingSong &&
                <MusicEditor
                    asset={editingSong}
                    onSongChanged={this.onSongChanged}
                    onAssetNameChanged={this.onAssetNameChanged}
                    editRef={this.state.editRef}
                    onDoneClicked={onDoneClicked}
                    hideDoneButton={this.props.hideDoneButton} />
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
        pxt.assets.music.inflateSong(value.song)
        this.setState({
            editingSong: value,
            editRef: this.state.editRef + 1
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