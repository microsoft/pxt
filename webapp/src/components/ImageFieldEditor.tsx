import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { AssetCardView } from "./assetEditor/assetCard";
import { getUserAssets } from "./assetEditor/store/assetEditorReducer";
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { setTelemetryFunction } from './ImageEditor/store/imageReducer';

export interface ImageFieldEditorProps {
    singleFrame: boolean;
    doneButtonCallback?: () => void;
    showTiles?: boolean;
}

export interface ImageFieldEditorState {
    currentView: "editor" | "gallery" | "my-assets";
    tileGalleryVisible?: boolean;
    headerVisible?: boolean;
    galleryFilter?: string;
}

interface ProjectGalleryItem extends pxt.sprite.GalleryItem {
    assetType: pxt.AssetType;
    id: string;
}

export type ImageType = pxt.ProjectImage | pxt.Animation;

export class ImageFieldEditor<U extends ImageType> extends React.Component<ImageFieldEditorProps, ImageFieldEditorState> implements FieldEditorComponent<U> {
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
        const { showTiles } = this.props;
        const { currentView, headerVisible } = this.state;

        if (this.blocksInfo) {
            if (!this.galleryAssets) {
                this.updateGalleryAssets(this.blocksInfo);
            }
        }

        if (currentView === "my-assets" && !this.userAssets) {
            this.userAssets = getUserAssets();
        }


        const toggleClass = currentView === "editor" ? "left" : (currentView === "gallery" ? "center" : "right");

        return <div className="image-editor-wrapper">
            {headerVisible && <div className="gallery-editor-header">
                <div className={`gallery-editor-toggle ${toggleClass} ${pxt.BrowserUtils.isEdge() ? "edge" : ""}`}>
                    <div className="gallery-editor-toggle-label gallery-editor-toggle-left" onClick={this.showEditor} role="button">
                        {lf("Editor")}
                    </div>
                    <div className="gallery-editor-toggle-label gallery-editor-toggle-center" onClick={this.showGallery} role="button">
                        {lf("Gallery")}
                    </div>
                    <div className="gallery-editor-toggle-label gallery-editor-toggle-right" onClick={this.showMyAssets} role="button">
                        {lf("My Assets")}
                    </div>
                    <div className="gallery-editor-toggle-handle"/>
                </div>
                { showTiles && <button className="gallery-editor-show-tiles" onClick={this.toggleTileGallery}>{lf("Tile Gallery")}</button>}
            </div>}
            <div className="image-editor-gallery-content">
                <ImageEditor ref="image-editor" singleFrame={this.props.singleFrame} onDoneClicked={this.onDoneClick} />
                <ImageEditorGallery
                    items={currentView === "my-assets" ? this.filterAssets(this.userAssets) : this.filterAssets(this.galleryAssets, null, true)}
                    hidden={currentView === "editor"}
                    onAssetSelected={this.onAssetSelected} />
                { showTiles && <ImageEditorGallery
                    items={this.filterAssets(this.galleryAssets, pxt.AssetType.Tile)}
                    hidden={currentView !== "editor" || !this.state.tileGalleryVisible}
                    onAssetSelected={this.onAssetSelected} /> }
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
        if (this.props.singleFrame) {
            let bitmap = value as pxt.ProjectImage;
            this.initSingleFrame(bitmap, options);
        }
        else {
            this.initAnimation(value as pxt.Animation, options);
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

    protected updateGalleryAssets(blocksInfo: pxtc.BlocksInfo) {
        const allImages = pxt.sprite.getGalleryItems(blocksInfo, "Image");
        const tileAssets: pxt.Asset[] = [];
        const imageAssets: pxt.Asset[] = [];

        for (const item of allImages) {
            if (item.tags.indexOf("tile") === -1) {
                const bitmapData = pxt.sprite.getBitmap(blocksInfo, item.qName).data();
                imageAssets.push({
                    internalID: -1,
                    type: pxt.AssetType.Image,
                    id: item.qName,
                    jresData: pxt.sprite.base64EncodeBitmap(bitmapData),
                    previewURI: item.src,
                    bitmap: bitmapData,
                    meta: {}
                });
            }
            else {
                const bitmapData = pxt.sprite.Bitmap.fromData(pxt.react.getTilemapProject().resolveTile(item.qName).bitmap).data();
                tileAssets.push({
                    internalID: -1,
                    type: pxt.AssetType.Tile,
                    id: item.qName,
                    jresData: pxt.sprite.base64EncodeBitmap(bitmapData),
                    previewURI: item.src,
                    bitmap: bitmapData,
                    meta: {}
                });
            }
        }

        this.galleryAssets = imageAssets.concat(tileAssets);
    }

    protected initSingleFrame(value: pxt.ProjectImage, options?: any) {
        this.asset = value;
        this.ref.openAsset(value);

        if (options.disableResize) {
            this.ref.disableResize();
        }
    }

    protected filterAssets(assets: pxt.Asset[], type: pxt.AssetType = this.asset?.type, isGallery = false) {
        if (type === undefined) {
            return assets;
        }

        if (this.asset) {
            assets = assets.filter(t => t.type !== this.asset.type || t.id !== this.asset.id)
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

    protected initAnimation(value: pxt.Animation, options?: any) {
        this.asset = value;
        this.ref.openAsset(value);

        if (options.disableResize) {
            this.ref.disableResize();
        }
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
        if (this.ref) {
            // let selectedBitmap = pxt.sprite.getBitmap(this.blocksInfo, item.qName);

            // if (!selectedBitmap) {
            //     const projectItem = item as ProjectGalleryItem;
            //     const project = pxt.react.getTilemapProject();

            //     const asset = project.lookupAsset(projectItem.assetType, projectItem.id) as pxt.Tile | pxt.ProjectImage;

            //     selectedBitmap = pxt.sprite.Bitmap.fromData(asset.bitmap);
            // }

            // this.ref.setCurrentFrame(selectedBitmap);

            this.ref.openAsset(asset, undefined, true);
        }

        tickImageEditorEvent("gallery-selection");

        this.setState({
            currentView: "editor",
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