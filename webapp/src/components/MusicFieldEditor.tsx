import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { MusicEditor } from "./musicEditor/MusicEditor";

interface MusicFieldEditorProps {

}

interface MusicFieldEditorState {
    editingSong?: pxt.Song;
}

export class MusicFieldEditor extends React.Component<MusicFieldEditorProps, MusicFieldEditorState> implements FieldEditorComponent<pxt.Song> {
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
                <MusicEditor song={editingSong.song} onSongChanged={this.onSongChanged} />
            }
        </div>
    }

    init(value: pxt.Song, close: () => void, options?: any) {
        this.setState({
            editingSong: value
        });
    }

    getValue(): pxt.Song {
        return {
            ...this.state.editingSong,
            song: this.mostRecentValue || this.state.editingSong.song
        }
    }

    getPersistentData(): any {

    }

    restorePersistentData(value: any): void {

    }

    protected onSongChanged = (newSong: pxt.assets.music.Song) => {
        this.mostRecentValue = newSong;
    }
}