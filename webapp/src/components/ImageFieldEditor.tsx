import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { setTelemetryFunction } from './ImageEditor/store/imageReducer';

export interface ImageFieldEditorProps {
    singleFrame: boolean;
    doneButtonCallback?: () => void;
    showTiles?: boolean;
}

export interface ImageFieldEditorState {
    galleryVisible: boolean;
    tileGalleryVisible?: boolean;
    galleryFilter?: string;
}

export type ImageType = pxt.sprite.Bitmap | pxt.sprite.ImageState;

export class ImageFieldEditor<U extends ImageType> extends React.Component<ImageFieldEditorProps, ImageFieldEditorState> implements FieldEditorComponent<U> {
    protected blocksInfo: pxtc.BlocksInfo;
    protected ref: ImageEditor;
    protected closeEditor: () => void;
    protected options: any;
    protected tileGallery: pxt.sprite.GalleryItem[];
    protected extensionGallery: pxt.sprite.GalleryItem[];

    constructor(props: ImageFieldEditorProps) {
        super(props);

        this.state = {
            galleryVisible: false
        };
        setTelemetryFunction(tickImageEditorEvent);
    }

    render() {
        const { showTiles } = this.props;

        if (this.blocksInfo && !this.extensionGallery) {
            this.extensionGallery = pxt.sprite.getGalleryItems(this.blocksInfo, "Image")
        }

        if (showTiles && !this.tileGallery) {
            this.tileGallery = this.getTileGalleryItems();
        }

        return <div className="image-editor-wrapper">
            <div className="gallery-editor-header">
                <div className={`gallery-editor-toggle ${this.state.galleryVisible ? "right" : "left"} ${pxt.BrowserUtils.isEdge() ? "edge" : ""}`} onClick={this.toggleGallery} role="button" aria-pressed={this.state.galleryVisible}>
                    <div className="gallery-editor-toggle-label gallery-editor-toggle-left">
                        {lf("Editor")}
                    </div>
                    <div className="gallery-editor-toggle-label gallery-editor-toggle-right">
                        {lf("Gallery")}
                    </div>
                    <div className="gallery-editor-toggle-handle"/>
                </div>
                { showTiles && <button className="gallery-editor-show-tiles" onClick={this.toggleTileGallery}>{lf("Tile Gallery")}</button>}
            </div>
            <div className="image-editor-gallery-content">
                <ImageEditor ref="image-editor" singleFrame={this.props.singleFrame} onDoneClicked={this.onDoneClick} />
                <ImageEditorGallery
                    items={this.extensionGallery}
                    hidden={!this.state.galleryVisible}
                    filterString={this.state.galleryFilter}
                    onItemSelected={this.onGalleryItemSelect} />
                { showTiles && <ImageEditorGallery
                    items={this.tileGallery}
                    hidden={this.state.galleryVisible || !this.state.tileGalleryVisible}
                    onItemSelected={this.onGalleryItemSelect} /> }
            </div>
        </div>
    }

    componentDidMount() {
        this.ref = this.refs["image-editor"] as ImageEditor;
        tickImageEditorEvent("image-editor-shown");
    }

    componentWillUnmount() {
        tickImageEditorEvent("image-editor-hidden");
        this.tileGallery = undefined;
    }

    init(value: U, close: () => void, options?: any) {
        this.closeEditor = close;
        this.options = options;
        if (this.props.singleFrame) {
            let bitmap = value as pxt.sprite.Bitmap;
            if (bitmap.height == 0 || bitmap.width == 0) {
                // Default to 16 x 16 if image is empty
                bitmap = new pxt.sprite.Bitmap(16, 16);
            }
            this.initSingleFrame(bitmap, options);
        }
        else {
            this.initAnimation(value as any, options);
        }

        if (options) {
            this.blocksInfo = options.blocksInfo;

            if (options.filter) {
                this.setState({
                    galleryFilter: options.filter
                });
            }
        }
    }

    getValue() {
        if (this.ref) {
            return (this.props.singleFrame ? this.ref.getCurrentFrame() : this.ref.getAnimation()) as U;
        }
        return null;
    }

    getJres() {
        if (this.ref && this.props.singleFrame) {
            const bitmapData = this.ref.getCurrentFrame().data();
            return pxt.sprite.base64EncodeBitmap(bitmapData);
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

            if (this.options && this.options.disableResize) {
                this.ref.disableResize();
            }
        }
    }

    onResize() {
        if (this.ref) {
            this.ref.onResize();
        }
    }

    protected getTileGalleryItems() {
        if (!this.extensionGallery) return null;

        const libraryTiles = pxt.sprite.filterItems(this.extensionGallery, ["tile"]);

        const project = pxt.react.getTilemapProject();
        const imgConv = new pxt.ImageConverter();

        const tilesToGalleryItems = (tiles: pxt.TileSet) => tiles ? tiles.tiles.map(t => ({
            qName: t.id,
            src: imgConv.convert("data:image/x-mkcd-f," + t.data),
            alt: t.id,
            tags: []
        } as pxt.sprite.GalleryItem)) : [];

        return [
            ...tilesToGalleryItems(project.getProjectTiles(8, false)),
            ...tilesToGalleryItems(project.getProjectTiles(16, false)),
            ...tilesToGalleryItems(project.getProjectTiles(32, false)),
            ...libraryTiles
        ];
    }

    protected initSingleFrame(value: pxt.sprite.Bitmap, options?: any) {
        this.ref.initSingleFrame(value);

        if (options.disableResize) {
            this.ref.disableResize();
        }
    }

    protected initAnimation(value: pxt.sprite.AnimationData, options?: any) {
        if (!value) {
            value = {
                frames: [new pxt.sprite.Bitmap(16, 16).data()],
                interval: 100
            };
        }

        this.ref.initAnimation(value.frames.map(b => pxt.sprite.Bitmap.fromData(b)), value.interval);

        if (options.disableResize) {
            this.ref.disableResize();
        }
    }

    protected toggleGallery = () => {
        if (this.state.galleryVisible) {
            tickImageEditorEvent("gallery-hide");
        }
        else {
            tickImageEditorEvent("gallery-show");
        }
        this.setState({
            galleryVisible: !this.state.galleryVisible,
            tileGalleryVisible: false
        });
    }

    protected toggleTileGallery = () => {
        if (this.state.tileGalleryVisible) {
            this.setState({
                tileGalleryVisible: false
            });
        }
        else {
            this.setState({
                tileGalleryVisible: true,
                galleryVisible: false
            });
        }
    }

    protected onGalleryItemSelect = (item: pxt.sprite.GalleryItem) => {
        if (this.ref) {
            let selectedBitmap = pxt.sprite.getBitmap(this.blocksInfo, item.qName);

            if (!selectedBitmap) {
                selectedBitmap = pxt.sprite.Bitmap.fromData(pxt.react.getTilemapProject().resolveTile(item.qName).bitmap);
            }

            this.ref.setCurrentFrame(selectedBitmap);
        }

        tickImageEditorEvent("gallery-selection");

        this.setState({
            galleryVisible: false,
            tileGalleryVisible: false
        });
    }

    loadJres(jres: string) {
        if (jres) {
            try {
                this.ref.setCurrentFrame(pxt.sprite.getBitmapFromJResURL(jres));
            } catch (e) {
                return
            }
        }
    }

    protected onDoneClick = () => {
        if (this.closeEditor) this.closeEditor();
        if (this.props.doneButtonCallback) this.props.doneButtonCallback();
    }
}

interface ImageEditorGalleryProps {
    items?: pxt.sprite.GalleryItem[];
    hidden: boolean;
    onItemSelected: (item: pxt.sprite.GalleryItem) => void;
    filterString?: string;
}

class ImageEditorGallery extends React.Component<ImageEditorGalleryProps, {}> {
    protected handlers: (() => void)[] = [];

    render() {
        let { items, hidden, filterString } = this.props;

        if (filterString) {
            items = pxt.sprite.filterItems(items, filterString.split(" "));
        }

        return <div className={`image-editor-gallery ${items && !hidden ? "visible" : ""}`}>
            {items && items.map((item, index) =>
                <button
                    key={index}
                    id={`:${index}`}
                    role="menuitem"
                    className="sprite-gallery-button sprite-editor-card"
                    title={item.alt}
                    data-value={item.qName}
                    onClick={this.clickHandler(index)}>
                        <img src={item.src} data-value={item.qName} alt={item.alt}/>
                </button>
            )}
        </div>
    }

    clickHandler(index: number) {
        if (!this.handlers[index]) {
            this.handlers[index] = () => {
                let { items, onItemSelected, filterString, hidden } = this.props;

                if (filterString) {
                    items = pxt.sprite.filterItems(items, filterString.split(" "));
                }

                if (!hidden && items && items[index]) {
                    onItemSelected(items[index]);
                }
            }
        }

        return this.handlers[index];
    }
}

function tickImageEditorEvent(event: string) {
    pxt.tickEvent("image.editor", {
        action: event
    });
}

function parseImageArrayString(str: string) {
    str = str.replace(/[\[\]]/mg, "");
    return str.split(",").map(s => pxt.sprite.imageLiteralToBitmap(s));
}