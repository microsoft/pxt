import * as React from "react";

import { AssetEditorCore } from "./ImageFieldEditor";
import { SongModel } from "./musicEditor/AssetModel";
import { MusicEditor } from "./musicEditor/MusicEditor";

interface MusicFieldEditorProps {
    onDoneClicked: () => void;
    hideDoneButton?: boolean;
}

interface MusicFieldEditorState {
    model?: SongModel;
}

export class MusicFieldEditor extends React.Component<MusicFieldEditorProps, MusicFieldEditorState> implements AssetEditorCore {
    protected openedAsset: pxt.Song;

    constructor(props: MusicFieldEditorProps) {
        super(props);
        this.state = {};
    }

    render() {
        const { onDoneClicked } = this.props;
        const { model } = this.state;

        return <div className="music-field-editor">
            { model &&
                <MusicEditor
                    model={model}
                    onAssetNameChanged={this.onAssetNameChanged}
                    onDoneClicked={onDoneClicked}
                    hideDoneButton={this.props.hideDoneButton} />
            }
        </div>
    }

    getAsset(): pxt.Song {
        const current = this.state.model?.getCurrentValue();
        return current || this.openedAsset;
    }

    openAsset(value: pxt.Song) {
        pxt.assets.music.inflateSong(value.song);
        this.openedAsset = value;

        if (this.state.model) {
            this.state.model.updateValue(value);
        }
        else {
            this.setState({
                model: new SongModel(value),
            });
        }
    }

    openGalleryAsset(asset: pxt.Asset): void {
        const song = pxt.cloneAsset(asset as pxt.Song);
        pxt.assets.music.inflateSong(song.song);

        this.state.model!.updateValue(song);
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
        if (this.state.model) {
            return this.state.model.getState();
        }
        return undefined;
    }

    restorePersistentData(value: any): void {
        if (value) {
            let model = this.state.model;
            if (!model) {
                model = new SongModel();
                this.setState({ model });
            }

            model.restoreState(value);
        }
    }

    protected onAssetNameChanged = (newName: string) => {
        const currentValue = this.state.model?.getCurrentValue();

        if (currentValue) {
            currentValue.meta.displayName = newName;
            this.state.model!.updateValue(currentValue);
        }
    }
}