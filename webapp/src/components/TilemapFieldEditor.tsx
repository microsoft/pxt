import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { setTelemetryFunction } from './ImageEditor/store/imageReducer';

import { getBitmap, getGalleryItems, GalleryItem, filterItems } from './gallery';

export interface TilemapFieldEditorProps {
}

export interface TilemapFieldEditorState {
    galleryVisible: boolean;
    galleryFilter?: string;
}

export class TilemapFieldEditor extends React.Component<TilemapFieldEditorProps, TilemapFieldEditorState> implements FieldEditorComponent {
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
                <ImageEditor ref="image-editor" singleFrame={true} />
                {!this.state.galleryVisible && <button
                    className={`image-editor-confirm ui small button`}
                    title={lf("Done")}
                    onClick={this.onDoneClick}>
                        {lf("Done")}
                </button>}
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

    init(value: string, close: () => void, options?: any) {
        this.closeEditor = close;
        this.initTilemap(value, options);
    }

    getValue() {
        if (this.ref) {
            return this.ref.getTilemap();
        }
        return "";
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

    protected initTilemap(value: string, options?: any) {
        let tilemap = pxt.sprite.tilemapLiteralToTilemap(value);

        if (tilemap.width === 0 || tilemap.height === 0) {
            tilemap = new pxt.sprite.Tilemap(options.initWidth || 16, options.initHeight || 16)
        }

        const tileset: pxt.sprite.TileSet = {
            tileWidth: 16,
            tiles: []
        };

        if (options) {
            this.blocksInfo = options.blocksInfo;

            tileset.tiles = filterItems(getGalleryItems(this.blocksInfo, "Image"), ["tile"])
                .map(g => getBitmap(this.blocksInfo, g.qName).data());

        }

        this.ref.initTilemap(tilemap, tileset);
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