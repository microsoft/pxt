import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { Bitmap } from './ImageEditor/store/bitmap';

export interface ImageFieldEditorState {
    galleryVisible: boolean;
}

interface GalleryItem {
    qName: string;
    src: string;
    alt: string;
    tags: string[];
}

export class ImageFieldEditor extends React.Component<{}, ImageFieldEditorState> implements FieldEditorComponent {
    protected blocksInfo: pxtc.BlocksInfo;
    protected ref: ImageEditor;

    constructor(props: {}) {
        super(props);

        this.state = {
            galleryVisible: false
        };
    }

    render() {
        return <div className="image-editor-wrapper">
            <div className="gallery-editor-header">
                <div className={`gallery-editor-toggle ${this.state.galleryVisible ? "right" : "left"}`} onClick={this.toggleGallery}>
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
                <ImageEditor ref="image-editor" />
                <ImageEditorGallery
                    items={this.blocksInfo && getGalleryItems(this.blocksInfo, "Image")}
                    hidden={!this.state.galleryVisible}
                    onItemSelected={this.onGalleryItemSelect} />
            </div>
        </div>
    }

    componentDidMount() {
        this.ref = this.refs["image-editor"] as ImageEditor;
    }

    init(value: string, options?: any) {
        if (this.ref) {
            this.ref.init(value, options);
        }

        if (options) this.blocksInfo = options.blocksInfo;
    }

    getValue() {
        if (this.ref) {
            return this.ref.getValue();
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

    protected toggleGallery = () => {
        this.setState({
            galleryVisible: !this.state.galleryVisible
        });
    }

    protected onGalleryItemSelect = (item: GalleryItem) => {
        if (this.ref) {
            this.ref.setCurrentFrame(getBitmap(this.blocksInfo, item.qName));
        }

        this.setState({
            galleryVisible: false
        });
    }
}

interface ImageEditorGalleryProps {
    items?: GalleryItem[];
    hidden: boolean;
    onItemSelected: (item: GalleryItem) => void;
}

class ImageEditorGallery extends React.Component<ImageEditorGalleryProps, {}> {
    protected handlers: (() => void)[] = [];

    render() {
        const { items, hidden } = this.props;

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
                        <img src={item.src} data-value={item.qName} />
                </button>
            )}
        </div>
    }

    clickHandler(index: number) {
        if (!this.handlers[index]) {
            this.handlers[index] = () => {
                const { items, onItemSelected, hidden } = this.props;

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

    const out = new Bitmap(w, h);

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