import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { setTelemetryFunction } from './ImageEditor/store/imageReducer';

import { getBitmap, getGalleryItems, GalleryItem, filterItems } from './gallery';

export interface ImageFieldEditorProps {
    singleFrame: boolean;
}

export interface ImageFieldEditorState {
    galleryVisible: boolean;
    galleryFilter?: string;
}

export class ImageFieldEditor extends React.Component<ImageFieldEditorProps, ImageFieldEditorState> implements FieldEditorComponent {
    protected blocksInfo: pxtc.BlocksInfo;
    protected ref: ImageEditor;
    protected closeEditor: () => void;

    constructor(props: ImageFieldEditorProps) {
        super(props);

        this.state = {
            galleryVisible: false
        };
        setTelemetryFunction(tickImageEditorEvent);
    }

    render() {
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
            </div>
            <div className="image-editor-gallery-content">
                <ImageEditor ref="image-editor" singleFrame={this.props.singleFrame} onDoneClicked={this.onDoneClick} />
                <ImageEditorGallery
                    items={this.blocksInfo && getGalleryItems(this.blocksInfo, "Image")}
                    hidden={!this.state.galleryVisible}
                    filterString={this.state.galleryFilter}
                    onItemSelected={this.onGalleryItemSelect} />
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
        if (this.props.singleFrame) {
            this.initSingleFrame(value, options);
        }
        else {
            this.initAnimation(value, options);
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
            return this.props.singleFrame ? this.ref.getCurrentFrame() : (this.ref.getAllFrames() + this.ref.getInterval());
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

    protected initSingleFrame(value: string, options?: any) {
        let bitmap = pxt.sprite.imageLiteralToBitmap(value);

        if (bitmap.width === 0 || bitmap.height === 0) {
            bitmap = new pxt.sprite.Bitmap(options.initWidth || 16, options.initHeight || 16)
        }

        this.ref.initSingleFrame(bitmap);
    }

    protected initAnimation(value: string, options?: any) {
        const frameString = value.substring(0, value.lastIndexOf("]") + 1);
        const intervalString = value.substring(frameString.length);

        let frames = parseImageArrayString(frameString);

        if (!frames || !frames.length || frames[0].width === 0 && frames[0].height === 0) {
            frames = [new pxt.sprite.Bitmap(options.initWidth || 16, options.initHeight || 16)];
        }

        this.ref.initAnimation(frames, Number(intervalString));
    }

    protected toggleGallery = () => {
        if (this.state.galleryVisible) {
            tickImageEditorEvent("gallery-hide");
        }
        else {
            tickImageEditorEvent("gallery-show");
        }
        this.setState({
            galleryVisible: !this.state.galleryVisible
        });
    }

    protected onGalleryItemSelect = (item: GalleryItem) => {
        if (this.ref) {
            this.ref.setCurrentFrame(getBitmap(this.blocksInfo, item.qName));
        }

        tickImageEditorEvent("gallery-selection");

        this.setState({
            galleryVisible: false
        });
    }

    protected onDoneClick = () => {
        if (this.closeEditor) this.closeEditor();
    }
}

interface ImageEditorGalleryProps {
    items?: GalleryItem[];
    hidden: boolean;
    onItemSelected: (item: GalleryItem) => void;
    filterString?: string;
}

class ImageEditorGallery extends React.Component<ImageEditorGalleryProps, {}> {
    protected handlers: (() => void)[] = [];

    render() {
        let { items, hidden, filterString } = this.props;

        if (filterString) {
            items = filterItems(items, filterString.split(" "));
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
                    items = filterItems(items, filterString.split(" "));
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