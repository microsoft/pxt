import * as React from "react";
import { PianoRoll, PianoRollModel } from "./pianoRoll/PianoRoll";

import { AssetEditorCore } from "./ImageFieldEditor";
import { fromPXTSong, toPXTSong } from "./pianoRoll/types";

interface PianoRollAssetEditorProps {
    onDoneClicked: () => void;
    hideDoneButton?: boolean;
    fieldEditorParams?: any;
}

interface PianoRollEditorState {
    model?: PianoRollModel;
}


export class PianoRollAssetEditor extends React.Component<PianoRollAssetEditorProps, PianoRollEditorState> implements AssetEditorCore {
    protected openedAsset: pxt.Song;

    constructor(props: PianoRollAssetEditorProps) {
        super(props);
        this.state = {};
    }

    render() {
        const { fieldEditorParams, onDoneClicked } = this.props;
        const { model } = this.state;

        return (
            <>
                {model &&
                    <PianoRoll
                        model={model}
                        onDoneClicked={onDoneClicked}
                        fieldEditorParams={fieldEditorParams}
                        showEditControls={true}
                    />
                }
            </>
        )
    }

    getAsset(): pxt.Song {
        if (this.state.model) {
            const { song, assetName } = this.state.model.getCurrentValue();
            const pxtSong = toPXTSong(song);

            const result: pxt.Song = {
                ...this.openedAsset,
                song: pxtSong
            };

            if (this.openedAsset?.meta || assetName) {
                result.meta = {
                    ...(this.openedAsset?.meta || {}),
                    displayName: assetName
                }
            }

            return result;
        }

        return this.openedAsset;
    }

    openAsset(value: pxt.Song) {
        this.openedAsset = value;

        const song = fromPXTSong(value.song);
        const newValue = {
            song,
            assetName: value.meta?.displayName,
            selectedTrackIndex: 0
        };

        if (this.state.model) {
            this.state.model.updateValue(newValue, { preserveUndo: false });
        }
        else {
            this.setState({
                model: new PianoRollModel(newValue)
            });
        }
    }

    openGalleryAsset(asset: pxt.Asset): void {
        const pxtSong = pxt.cloneAsset(asset as pxt.Song);
        pxt.assets.music.inflateSong(pxtSong.song);

        const song = fromPXTSong(pxtSong.song);

        // remap the track ids to be nice
        for (let i = 0; i < song.tracks.length; i++) {
            const track = song.tracks[i];
            track.id = i + 1;
        }

        const currentValue = this.state.model!.getCurrentValue();
        this.state.model!.updateValue({
            ...currentValue,
            song,
            selectedTrackIndex: 0
        }, { preserveUndo: true, pushUndo: true });
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
        return this.state.model?.getState();
    }

    restorePersistentData(value: any): void {
        if (value) {
            let model = this.state.model;
            if (!model) {
                model = new PianoRollModel();
                this.setState({ model });
            }

            model.restoreState(value);
        }
    }
}