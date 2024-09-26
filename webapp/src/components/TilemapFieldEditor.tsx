import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { setTelemetryFunction, GalleryTile } from './ImageEditor/state';

export interface TilemapFieldEditorProps {
}

export interface TilemapFieldEditorState {
    galleryVisible: boolean;
    galleryFilter?: string;
}

export class TilemapFieldEditor extends React.Component<TilemapFieldEditorProps, TilemapFieldEditorState> implements FieldEditorComponent<pxt.ProjectTilemap> {
    protected blocksInfo: pxtc.BlocksInfo;
    protected lightMode: boolean;
    protected ref: ImageEditor;
    protected closeEditor: () => void;

    constructor(props: TilemapFieldEditorProps) {
        super(props);

        this.state = {
            galleryVisible: false
        };
        setTelemetryFunction(tickImageEditorEvent);
    }

    render() {
        return <div className="image-editor-wrapper">
            <div className="image-editor-gallery-content">
                <ImageEditor ref="image-editor" singleFrame={true} onDoneClicked={this.onDoneClick} hideAssetName={!pxt.appTarget?.appTheme?.assetEditor} />
            </div>
        </div>
    }

    componentDidMount() {
        this.ref = this.refs["image-editor"] as ImageEditor;
        tickImageEditorEvent("image-editor-shown");
    }

    componentWillUnmount() {
        tickImageEditorEvent("image-editor-hidden");
    }

    init(value: pxt.ProjectTilemap, close: () => void, options?: any) {
        this.closeEditor = close;
        this.lightMode = options.lightMode;
        this.initTilemap(value, options);
    }

    getValue() {
        if (this.ref) {
            return this.ref.getTilemap();
        }
        return null;
    }

    getPersistentData() {
        if (this.ref) {
            return this.ref.getPersistentData();
        }

        return null;
    }

    restorePersistentData(oldValue: any) {
        if (this.ref) {
            this.ref.restorePersistentData(oldValue);
        }
    }

    onResize() {
        if (this.ref) {
            this.ref.onResize();
        }
    }

    shouldPreventHide() {
        if (this.ref?.state.editingTile) {
            this.ref.closeNestedEditor();
            return true;
        }
        return false;
    }

    protected initTilemap(asset: pxt.ProjectTilemap, options?: any) {
        let gallery: GalleryTile[];

        if (options) {
            this.blocksInfo = options.blocksInfo;

            gallery = pxt.sprite.filterItems(pxt.sprite.getGalleryItems(this.blocksInfo, "Image"), ["tile"])
                .map(g => ({ bitmap: pxt.sprite.getBitmap(this.blocksInfo, g.qName).data(), tags: g.tags, qualifiedName: g.qName, tileWidth: 16 }))
        }

        this.ref.openAsset(asset, gallery);
    }

    protected onDoneClick = () => {
        if (this.closeEditor) this.closeEditor();
    }
}

function tickImageEditorEvent(event: string) {
    pxt.tickEvent("image.editor", {
        action: event
    });
}
