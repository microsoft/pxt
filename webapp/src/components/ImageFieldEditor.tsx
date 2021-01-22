import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { AssetCardView } from "./assetEditor/assetCard";
import { assetToGalleryItem, getAssets } from "./assetEditor/store/assetEditorReducer";
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { obtainShortcutLock, releaseShortcutLock } from "./ImageEditor/keyboardShortcuts";
import { GalleryTile, setTelemetryFunction } from './ImageEditor/store/imageReducer';

export interface ImageFieldEditorProps {
    singleFrame: boolean;
    doneButtonCallback?: () => void;
}

export interface ImageFieldEditorState {
    currentView: "editor" | "gallery" | "my-assets";
    tileGalleryVisible?: boolean;
    headerVisible?: boolean;
    hideMyAssets?: boolean;
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
    protected shortcutLock: number;

    protected get asset() {
        return this.ref?.getAsset();
    }

    constructor(props: ImageFieldEditorProps) {
        super(props);

        this.state = {
            currentView: "editor",
            headerVisible: true
        };
        setTelemetryFunction(tickImageEditorEvent);
    }

    render() {
        const { currentView, headerVisible, editingTile, hideMyAssets } = this.state;

        let showHeader = headerVisible;
        // If there is no asset, show the gallery to prevent changing shape when it's added
        const showGallery = !this.asset || editingTile || this.asset.type !== pxt.AssetType.Tilemap;;
        const showMyAssets = !hideMyAssets && !editingTile;

        if (this.asset && !this.galleryAssets) {
            this.updateGalleryAssets();
        }

        const toggleOptions = [{
            label: lf("Editor"),
            view: "editor",
            onClick: this.showEditor
        }, {
            label: lf("Gallery"),
            view: "gallery",
            onClick: this.showGallery
        }, {
            label: lf("My Assets"),
            view: "my-assets",
            onClick: this.showMyAssets
        }];

        if (!showGallery && !showMyAssets) {
            showHeader = false;
        }
        else if (!showGallery) {
            toggleOptions.splice(1, 1);
        }
        else if (!showMyAssets) {
            toggleOptions.splice(2, 1);
        }

        return <div className="image-editor-wrapper">
            {showHeader && <div className="gallery-editor-header">
                <ImageEditorToggle options={toggleOptions} view={currentView} />
            </div>}
            <div className="image-editor-gallery-content">
                <ImageEditor ref="image-editor" singleFrame={this.props.singleFrame} onDoneClicked={this.onDoneClick} onTileEditorOpenClose={this.onTileEditorOpenClose} />
                <ImageEditorGallery
                    items={currentView === "my-assets" ? this.filterAssets(this.userAssets, editingTile ? pxt.AssetType.Tile : this.asset?.type) :
                                                         this.filterAssets(this.galleryAssets, editingTile ? pxt.AssetType.Tile : this.asset?.type, true, true)}
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

            if (options.hideMyAssets != undefined) {
                this.setState({ hideMyAssets: options.hideMyAssets });
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

    protected filterAssets(assets: pxt.Asset[], type: pxt.AssetType = this.asset?.type, isGallery = false, useTags?: boolean) {
        if (type === undefined) {
            return assets;
        }

        if (this.asset) {
            assets = assets.map(t => (t.type !== this.asset.type || t.id !== this.asset.id) ? t : assetToGalleryItem(this.getValue()))

            if (this.state.editingTile) {
                const tilemap = this.ref.getAsset() as pxt.ProjectTilemap;
                assets = assets.map(a => {
                    if (tilemap.data.editedTiles?.indexOf(a.id) >= 0) {
                        return assetToGalleryItem(tilemap.data.tileset.tiles.find(t => t.id === a.id))
                    }
                    return a;
                });
            }
        }

        if (this.state.galleryFilter && useTags) {
            assets.forEach(a => {
                if (!a.meta.tags && this.options) {
                    a.meta.tags = this.blocksInfo.apis.byQName[a.id]?.attributes.tags?.split(" ") || [];
                }})

        // Keep tag filtering unified with pxtlib/spriteutils:filterItems
            const tags = this.state.galleryFilter.split(" ")
                .filter(el => !!el)
                .map(el => el.toLowerCase());
            const includeTags = tags
                .filter(tag => tag.indexOf("!") !== 0);
            const excludeTags = tags
                .filter(tag => tag.indexOf("!") === 0 && tag.length > 1)
                .map(tag => tag.substring(1));

            assets = assets.filter(t => checkInclude(t, includeTags) && checkExclude(t, excludeTags))
        }
        function checkInclude(item: pxt.Asset, includeTags: string[]) {
            const tags = item.meta.tags ? item.meta.tags : [];
            return includeTags.every(filterTag => {
                const optFilterTag = `?${filterTag}`;
                return tags.some(tag =>
                    tag === filterTag || tag === optFilterTag
                )
            });
        }

        function checkExclude(item: pxt.Asset, excludeTags: string[]) {
            const tags = item.meta.tags ? item.meta.tags : [];
            return excludeTags.every(filterTag =>
                !tags.some(tag => tag === filterTag)
            );
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
        this.ref.openAsset(value);

        if (options.disableResize) {
            this.ref.disableResize();
        }
    }

    protected initAnimation(value: pxt.Animation, options?: any) {
        this.ref.openAsset(value);

        if (options.disableResize) {
            this.ref.disableResize();
        }
    }

    protected initTilemap(asset: pxt.ProjectTilemap, options?: any) {
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
        this.setImageEditorShortcutsEnabled(true);
        tickImageEditorEvent("gallery-editor");
        this.setState({
            currentView: "editor",
            tileGalleryVisible: false
        });
    }

    protected showGallery = () => {
        this.setImageEditorShortcutsEnabled(false);
        tickImageEditorEvent("gallery-builtin");
        this.setState({
            currentView: "gallery",
            tileGalleryVisible: false
        });
    }

    protected showMyAssets = () => {
        this.setImageEditorShortcutsEnabled(false);
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
                pxt.react.getTilemapProject().updateAsset(this.asset);
                this.ref.openAsset(asset, undefined, true);
            }
        }

        tickImageEditorEvent("gallery-selection");

        this.setState({
            currentView: "editor",
            tileGalleryVisible: false
        });
        this.setImageEditorShortcutsEnabled(true);
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

    protected setImageEditorShortcutsEnabled(enabled: boolean) {
        if (enabled && this.shortcutLock) {
            releaseShortcutLock(this.shortcutLock);
            this.shortcutLock = undefined;
        }
        else if (!enabled && !this.shortcutLock) {
            this.shortcutLock = obtainShortcutLock();
        }
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

interface ImageEditorToggleOption {
    label: string;
    view: string;
    onClick: () => void;
}

interface ImageEditorToggleProps {
    options: ImageEditorToggleOption[];
    view: string;
}


class ImageEditorToggle extends React.Component<ImageEditorToggleProps> {
    render() {
        const { options, view } = this.props;

        const threeOptions = options.length > 2;
        const selected = options.findIndex(o => o.view === view)

        const left = options[0];
        const center = threeOptions ? options[1] : undefined;
        const right = threeOptions ? options[2] : options[1];

        let toggleClass: string;
        if (threeOptions) {
            toggleClass = ["left", "center", "right"][selected];
        }
        else {
            toggleClass = ["left", "right"][selected] + " no-gallery";
        }

        return <div className={`gallery-editor-toggle ${toggleClass} ${pxt.BrowserUtils.isEdge() ? "edge" : ""}`}>
            <div className="gallery-editor-toggle-label gallery-editor-toggle-left" onClick={left.onClick} role="button">
                {left.label}
            </div>
            {center && <div className="gallery-editor-toggle-label gallery-editor-toggle-center" onClick={center.onClick} role="button">
                {center.label}
            </div>}
            <div className="gallery-editor-toggle-label gallery-editor-toggle-right" onClick={right.onClick} role="button">
                {right.label}
            </div>
            <div className="gallery-editor-toggle-handle"/>
    </div>
    }
}

function tickImageEditorEvent(event: string) {
    pxt.tickEvent("image.editor", {
        action: event
    });
}