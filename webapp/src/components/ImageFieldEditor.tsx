import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { setTelemetryFunction } from './ImageEditor/store/imageReducer';

export interface ImageFieldEditorProps {
    singleFrame: boolean;
}

export interface ImageFieldEditorState {
    galleryVisible: boolean;
    galleryFilter?: string;
}

interface GalleryItem {
    qName: string;
    src: string;
    alt: string;
    tags: string[];
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
                <ImageEditor ref="image-editor" singleFrame={this.props.singleFrame} />
                <ImageEditorGallery
                    items={this.blocksInfo && getGalleryItems(this.blocksInfo, "Image")}
                    hidden={!this.state.galleryVisible}
                    filterString={this.state.galleryFilter}
                    onItemSelected={this.onGalleryItemSelect} />
                {!this.state.galleryVisible && <button
                    className={`image-editor-confirm ui small button ${this.props.singleFrame ? "" : "animation"}`}
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

function getBitmap(blocksInfo: pxtc.BlocksInfo, qName: string) {
    const sym = blocksInfo.apis.byQName[qName];
    const jresURL = sym.attributes.jresURL;
    let data = atob(jresURL.slice(jresURL.indexOf(",") + 1))
    let magic = data.charCodeAt(0);
    let w = data.charCodeAt(1);
    let h = data.charCodeAt(2);

    if (magic === 0x87) {
        magic = 0xe0 | data.charCodeAt(1);
        w = data.charCodeAt(2) | (data.charCodeAt(3) << 8);
        h = data.charCodeAt(4) | (data.charCodeAt(5) << 8);
        data = data.slice(4);
    }

    const out = new pxt.sprite.Bitmap(w, h);

    let index = 4
    if (magic === 0xe1) {
        // Monochrome
        let mask = 0x01
        let v = data.charCodeAt(index++)
        for (let x = 0; x < w; ++x) {
            for (let y = 0; y < h; ++y) {
                out.set(x, y, (v & mask) ? 1 : 0);
                mask <<= 1
                if (mask == 0x100) {
                    mask = 0x01
                    v = data.charCodeAt(index++)
                }
            }
        }
    }
    else {
        // Color
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y += 2) {
                let v = data.charCodeAt(index++)
                out.set(x, y, v & 0xf);
                if (y != h - 1) {
                    out.set(x, y + 1, (v >> 4) & 0xf);
                }
            }
            while (index & 3) index++
        }
    }

    return out;
}

function filterItems(target: GalleryItem[], tags: string[]) {
    tags = tags
        .filter(el => !!el)
        .map(el => el.toLowerCase());
    const includeTags = tags
        .filter(tag => tag.indexOf("!") !== 0);
    const excludeTags = tags
        .filter(tag => tag.indexOf("!") === 0 && tag.length > 1)
        .map(tag => tag.substring(1));

    return target.filter(el => checkInclude(el) && checkExclude(el));

    function checkInclude(item: GalleryItem) {
        return includeTags.every(filterTag => {
            const optFilterTag = `?${filterTag}`;
            return item.tags.some(tag =>
                tag === filterTag || tag === optFilterTag
            )
        });
    }

    function checkExclude(item: GalleryItem) {
        return excludeTags.every(filterTag =>
            !item.tags.some(tag => tag === filterTag)
        );
    }
}

function getGalleryItems(blocksInfo: pxtc.BlocksInfo, qName: string): GalleryItem[] {
    const syms = getFixedInstanceDropdownValues(blocksInfo.apis, qName);
    generateIcons(syms);

    return syms.map(sym => {
        const splitTags = (sym.attributes.tags || "")
            .toLowerCase()
            .split(" ")
            .filter(el => !!el);

        return {
            qName: sym.qName,
            src: sym.attributes.iconURL,
            alt: sym.qName,
            tags: splitTags
        };
    });
}

function getFixedInstanceDropdownValues(apis: pxtc.ApisInfo, qName: string) {
    return pxt.Util.values(apis.byQName).filter(sym => sym.kind === pxtc.SymbolKind.Variable
        && sym.attributes.fixedInstance
        && isSubtype(apis, sym.retType, qName));
}

function isSubtype(apis: pxtc.ApisInfo, specific: string, general: string) {
    if (specific == general) return true
    let inf = apis.byQName[specific]
    if (inf && inf.extendsTypes)
        return inf.extendsTypes.indexOf(general) >= 0
    return false
}

function generateIcons(instanceSymbols: pxtc.SymbolInfo[]) {
    const imgConv = new pxt.ImageConverter();
    instanceSymbols.forEach(v => {
        if (v.attributes.jresURL && !v.attributes.iconURL && v.attributes.jresURL.indexOf("data:image/x-mkcd-f") == 0) {
            v.attributes.iconURL = imgConv.convert(v.attributes.jresURL)
        }
    });
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