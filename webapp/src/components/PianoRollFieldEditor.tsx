import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { AssetEditorCore } from "./ImageFieldEditor";
import { PianoRollFieldEditor } from "./pianoRoll/FieldEditor";

interface PianoRollAssetEditorProps {
    onDoneClicked: () => void;
    hideDoneButton?: boolean;
}

export class PianoRollAssetEditor extends React.Component<PianoRollAssetEditorProps, {}> implements AssetEditorCore {
    protected pianoRollFieldEditorRef: FieldEditorComponent<any>;
    protected openedAsset: pxt.Song;

    constructor(props: PianoRollAssetEditorProps) {
        super(props);
        this.state = {
            editRef: 0
        }
    }

    render() {
        return (
            <PianoRollFieldEditor
                handleRef={this.handlePianoFieldEditorRef}
            />
        )
    }

    getAsset(): pxt.Song {
        return this.pianoRollFieldEditorRef?.getValue();
    }

    openAsset(value: pxt.Song) {
        if (this.pianoRollFieldEditorRef) {
            this.pianoRollFieldEditorRef.init(value, this.props.onDoneClicked);
        }
        else {
            this.openedAsset = value;
        }
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
        return this.pianoRollFieldEditorRef?.getPersistentData();
    }

    restorePersistentData(value: any): void {
        this.pianoRollFieldEditorRef?.restorePersistentData(value);
    }

    protected handlePianoFieldEditorRef = (ref: FieldEditorComponent<any>) => {
        this.pianoRollFieldEditorRef = ref;
        if (this.openedAsset) {
            this.pianoRollFieldEditorRef?.init(this.openedAsset, this.props.onDoneClicked);
            this.openedAsset = undefined;
        }
    }
}