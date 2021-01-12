import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { AssetCardView } from "./assetEditor/assetCard";
import { assetToGalleryItem, getAssets } from "./assetEditor/store/assetEditorReducer";
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { GalleryTile, setTelemetryFunction } from './ImageEditor/store/imageReducer';

export interface ImageFieldEditorProps {
    singleFrame: boolean;
    doneButtonCallback?: () => void;
}

export interface ImageFieldEditorState {
    currentView: "editor" | "gallery" | "my-assets";
    tileGalleryVisible?: boolean;
    headerVisible?: boolean;
    galleryFilter?: string;
    editingTile?: boolean;
}

interface ProjectGalleryItem extends pxt.sprite.GalleryItem {
    assetType: pxt.AssetType;
    id: string;
}

export class ImageFieldEditor<U extends pxt.Asset> extends React.Component<ImageFieldEditorProps, ImageFieldEditorState> implements FieldEditorComponent<U> {
    protected blocksInfo: pxtc.BlocksInfo;
    protected ref: ImageEditor;
    protected closeEditor: () => void;
    protected options: any;
    protected editID: string;
    protected galleryAssets: pxt.Asset[];
    protected userAssets: pxt.Asset[];
    protected asset: pxt.Asset;

    constructor(props: ImageFieldEditorProps) {
        super(props);

        this.state = {
            currentView: "editor",
            headerVisible: true
        };
        setTelemetryFunction(tickImageEditorEvent);
    }

    render() {
        const { currentView, headerVisible, editingTile } = this.state;

        if (this.asset && !this.galleryAssets) {
            this.updateGalleryAssets();
        }

        // if there isn't an asset, default to showing three so that we don't change shape
        const hasGallery = !this.asset || editingTile || this.asset.type !== pxt.AssetType.Tilemap;

        let toggleClass = currentView === "editor" ? "left" : (currentView === "gallery" ? "center" : "right");

        if (!hasGallery) toggleClass += " no-gallery"

        return <div className="image-editor-wrapper">
            {headerVisible && <div className="gallery-editor-header">
                <div className={`gallery-editor-toggle ${toggleClass} ${pxt.BrowserUtils.isEdge() ? "edge" : ""}`}>
                    <div className="gallery-editor-toggle-label gallery-editor-toggle-left" onClick={this.showEditor} role="button">
                        {lf("Editor")}
                    </div>
                    {hasGallery && <div className="gallery-editor-toggle-label gallery-editor-toggle-center" onClick={this.showGallery} role="button">
                        {lf("Gallery")}
                    </div>}
                    <div className="gallery-editor-toggle-label gallery-editor-toggle-right" onClick={this.showMyAssets} role="button">
                        {lf("My Assets")}
                    </div>
                    <div className="gallery-editor-toggle-handle"/>
                </div>
            </div>}
            <div className="image-editor-gallery-content">
                <ImageEditor ref="image-editor" singleFrame={this.props.singleFrame} onDoneClicked={this.onDoneClick} onTileEditorOpenClose={this.onTileEditorOpenClose} />
                <ImageEditorGallery
                    items={currentView === "my-assets" ? this.filterAssets(this.userAssets) : this.filterAssets(this.galleryAssets, editingTile ? pxt.AssetType.Tile : this.asset?.type, true)}
                    hidden={currentView === "editor"}
                    onAssetSelected={this.onAssetSelected} />
            </div>
        </div>
    }

    componentDidMount() {
        this.ref = this.refs["image-editor"] as ImageEditor;
        tickImageEditorEvent("image-editor-shown");
    }

    componentWillUnmount() {
        tickImageEditorEvent("image-editor-hidden");
        this.galleryAssets = undefined;
        this.userAssets = undefined;
    }

    init(value: U, close: () => void, options?: any) {
        this.closeEditor = close;
        this.options = options;

        switch (value.type) {
            case pxt.AssetType.Image:
                this.initSingleFrame(value as pxt.ProjectImage, options);
                break;
            case pxt.AssetType.Tile:
                options.disableResize = true;
                this.initSingleFrame(value as pxt.ProjectImage, options);
                break;
            case pxt.AssetType.Animation:
                this.initAnimation(value as pxt.Animation, options);
                break;
            case pxt.AssetType.Tilemap:
                this.initTilemap(value as pxt.ProjectTilemap, options);
                break;

        }

        this.editID = value.id;

        if (options) {
            this.blocksInfo = options.blocksInfo;

            if (options.filter) {
                this.setState({
                    galleryFilter: options.filter
                });
            }

            if (options.headerVisible != undefined) {
                this.setState({ headerVisible: options.headerVisible })
            }
        }
    }

    getValue() {
        if (this.ref) {
            return this.ref.getAsset() as U;
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

    protected updateGalleryAssets() {
        this.galleryAssets = getAssets(true, this.asset.type);
    }

    protected filterAssets(assets: pxt.Asset[], type: pxt.AssetType = this.asset?.type, isGallery = false) {
        if (type === undefined) {
            return assets;
        }

        if (this.asset) {
            assets = assets.map(t => (t.type !== this.asset.type || t.id !== this.asset.id) ? t : assetToGalleryItem(this.getValue()))
        }

        if (isGallery) {
            switch (type) {
                case pxt.AssetType.Animation:
                    return assets.filter(t => t.type === pxt.AssetType.Animation || t.type === pxt.AssetType.Tile || t.type === pxt.AssetType.Image);
                case pxt.AssetType.Image:
                    return assets.filter(t => t.type === pxt.AssetType.Tile || t.type === pxt.AssetType.Image);
                case pxt.AssetType.Tile:
                    return assets.filter(t => t.type === pxt.AssetType.Tile);
                case pxt.AssetType.Tilemap:
                    return assets.filter(t => t.type === pxt.AssetType.Tilemap);
            }
        }
        else {
            switch (type) {
                case pxt.AssetType.Animation:
                    return assets.filter(t => t.type === pxt.AssetType.Animation);
                case pxt.AssetType.Image:
                    return assets.filter(t => t.type === pxt.AssetType.Tile || t.type === pxt.AssetType.Image);
                case pxt.AssetType.Tile:
                    return assets.filter(t => t.type === pxt.AssetType.Tile);
                case pxt.AssetType.Tilemap:
                    return assets.filter(t => t.type === pxt.AssetType.Tilemap);
            }
        }
    }

    protected initSingleFrame(value: pxt.ProjectImage, options?: any) {
        this.asset = value;
        this.ref.openAsset(value);

        if (options.disableResize) {
            this.ref.disableResize();
        }
    }

    protected initAnimation(value: pxt.Animation, options?: any) {
        this.asset = value;
        this.ref.openAsset(value);

        if (options.disableResize) {
            this.ref.disableResize();
        }
    }

    protected initTilemap(asset: pxt.ProjectTilemap, options?: any) {
        this.asset = asset;
        let gallery: GalleryTile[];

        // FIXME (riknoll): don't use blocksinfo, use tilemap project instead
        if (options) {
            this.blocksInfo = options.blocksInfo;

            gallery = pxt.sprite.filterItems(pxt.sprite.getGalleryItems(this.blocksInfo, "Image"), ["tile"])
                .map(g => ({ bitmap: pxt.sprite.getBitmap(this.blocksInfo, g.qName).data(), tags: g.tags, qualifiedName: g.qName, tileWidth: 16 }))
        }

        this.ref.openAsset(asset, gallery);
    }

    protected showEditor = () => {
        tickImageEditorEvent("gallery-editor");
        this.setState({
            currentView: "editor",
            tileGalleryVisible: false
        });
    }

    protected showGallery = () => {
        tickImageEditorEvent("gallery-builtin");
        this.setState({
            currentView: "gallery",
            tileGalleryVisible: false
        });
    }

    protected showMyAssets = () => {
        tickImageEditorEvent("gallery-my-assets");
        this.userAssets = getAssets();
        this.setState({
            currentView: "my-assets",
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
                currentView: "editor"
            });
        }
    }

    protected onAssetSelected = (asset: pxt.Asset) => {
        if (this.ref && asset.id !== this.asset?.id) {
            if (this.state.editingTile) {
                this.ref.openInTileEditor(pxt.sprite.Bitmap.fromData((asset as pxt.Tile).bitmap))
            }
            else if (this.state.currentView === "gallery") {
                this.ref.openGalleryAsset(asset as pxt.Tile | pxt.ProjectImage | pxt.Animation);
            }
            else {
                this.ref.openAsset(asset, undefined, true);
            }
        }

        tickImageEditorEvent("gallery-selection");

        this.setState({
            currentView: "editor",
            tileGalleryVisible: false
        });
    }

    protected onTileEditorOpenClose = (open: boolean) => {
        this.setState({
            editingTile: open
        });
    }

    loadJres(jres: string) {
        if (jres) {
            try {
                this.ref.setCurrentFrame(pxt.sprite.getBitmapFromJResURL(jres), true);
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
    items?: pxt.Asset[];
    hidden: boolean;
    onAssetSelected: (item: pxt.Asset) => void;
}

class ImageEditorGallery extends React.Component<ImageEditorGalleryProps, {}> {
    render() {
        let { items, hidden } = this.props;

        return <div className={`image-editor-gallery ${items && !hidden ? "visible" : ""}`}>
            {!hidden && items && items.map((item, index) =>
                <AssetCardView key={index} asset={item} selected={false} onClick={this.clickHandler} />
            )}
        </div>
    }

    clickHandler = (asset: pxt.Asset) => {
        this.props.onAssetSelected(asset);
    }
}

function tickImageEditorEvent(event: string) {
    pxt.tickEvent("image.editor", {
        action: event
    });
}