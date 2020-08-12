import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { setTelemetryFunction, GalleryTile } from './ImageEditor/store/imageReducer';

export interface TilemapFieldEditorProps {
    doneButtonCallback?: () => void;
}

export interface TilemapFieldEditorState {
    galleryVisible: boolean;
    galleryFilter?: string;
}

export class TilemapFieldEditor extends React.Component<TilemapFieldEditorProps, TilemapFieldEditorState> implements FieldEditorComponent<pxt.sprite.TilemapData> {
    protected blocksInfo: pxtc.BlocksInfo;
    protected ref: ImageEditor;
    protected closeEditor: () => void;
    protected tmProject: pxt.TilemapProject;
    protected tmName: string;

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

    shouldPreventHide() {
        if (this.ref?.state.editingTile) {
            this.ref.closeNestedEditor();
            return true;
        }
        return false;
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

    loadJres(jres: string, name: string) {
        const parsed = parseJResFromString(JSON.stringify(jres));
        this.tmProject = new pxt.TilemapProject(parsed);
        const tm = this.tmProject.getTilemap(name);
        this.tmName = name;
        this.initTilemap(tm);
    }

    getJres() {
        const tmData = this.getValue();
        const encodedtm = this.tmProject.encodeTilemap(tmData, this.tmName);
        return JSON.stringify(encodedtm);
    }

    protected onDoneClick = () => {
        if (this.closeEditor) this.closeEditor();
        if (this.props.doneButtonCallback) this.props.doneButtonCallback();
    }
}

function tickImageEditorEvent(event: string) {
    pxt.tickEvent("image.editor", {
        action: event
    });
}

function parseJResFromString(JResString: string) {
    const allres: pxt.Map<pxt.JRes> = {}
    let js: pxt.Map<pxt.JRes> = JSON.parse(JResString)
    console.log(js);
    let base: pxt.JRes = js["*"] || {} as any
    for (let k of Object.keys(js)) {
        if (k == "*") continue
        let v = js[k]
        if (typeof v == "string") {
            // short form
            v = { data: v } as any
        }
        let ns = v.namespace || base.namespace || ""
        if (ns) ns += "."
        let id = v.id || ns + k
        let icon = v.icon
        let mimeType = v.mimeType || base.mimeType
        let dataEncoding = v.dataEncoding || base.dataEncoding || "base64"
        if (!icon && dataEncoding == "base64" && (mimeType == "image/png" || mimeType == "image/jpeg")) {
            icon = "data:" + mimeType + ";base64," + v.data
        }
        allres[id] = {
            id,
            data: v.data,
            dataEncoding: v.dataEncoding || base.dataEncoding || "base64",
            icon,
            namespace: ns,
            mimeType,
            tilemapTile: v.tilemapTile,
            tileset: v.tileset
        }
    }
    console.log(allres);
    return allres;
}