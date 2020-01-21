import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { setTelemetryFunction, GalleryTile } from './ImageEditor/store/imageReducer';

export interface TilemapFieldEditorProps {
}

export interface TilemapFieldEditorState {
    galleryVisible: boolean;
    galleryFilter?: string;
}

export class TilemapFieldEditor extends React.Component<TilemapFieldEditorProps, TilemapFieldEditorState> implements FieldEditorComponent<pxt.sprite.TilemapData> {
    protected blocksInfo: pxtc.BlocksInfo;
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
                <ImageEditor ref="image-editor" singleFrame={true} onDoneClicked={this.onDoneClick} />
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

    init(value: pxt.sprite.TilemapData, close: () => void, options?: any) {
        this.closeEditor = close;
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

    protected initTilemap(data: pxt.sprite.TilemapData, options?: any) {
        if (data.tilemap.width === 0 || data.tilemap.height === 0) {
            data.tilemap = new pxt.sprite.Tilemap(options.initWidth || 16, options.initHeight || 16)
        }

        if (!data.layers) {
            data.layers = new pxt.sprite.Bitmap(data.tilemap.width, data.tilemap.height).data();
        }

        let gallery: GalleryTile[];

        if (options) {
            this.blocksInfo = options.blocksInfo;

            gallery = pxt.sprite.filterItems(pxt.sprite.getGalleryItems(this.blocksInfo, "Image"), ["tile"])
                .map(g => ({ bitmap: pxt.sprite.getBitmap(this.blocksInfo, g.qName).data(), tags: g.tags, qualifiedName: g.qName, tileWidth: 16 }))
        }

        this.ref.initTilemap(data, gallery,);
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