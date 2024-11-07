import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { AssetCardView } from "./assetEditor/assetCard";
import { assetToGalleryItem, getAssets } from "../assets";
import { ImageEditor } from "./ImageEditor/ImageEditor";
import { obtainShortcutLock, releaseShortcutLock } from "./ImageEditor/keyboardShortcuts";
import { GalleryTile, setTelemetryFunction } from './ImageEditor/store/imageReducer';
import { FilterPanel } from './FilterPanel';
import { fireClickOnEnter } from "../util";
import { EditorToggle, EditorToggleItem, BasicEditorToggleItem } from "../../../react-common/components/controls/EditorToggle";
import { MusicFieldEditor } from "./MusicFieldEditor";
import { classList } from "../../../react-common/components/util";

export interface ImageFieldEditorProps {
    singleFrame: boolean;
    isMusicEditor?: boolean;
    doneButtonCallback?: () => void;
    hideDoneButton?: boolean;
    includeSpecialTagsInFilter?: boolean;
}

interface ToggleOption extends BasicEditorToggleItem {
    view: string;
}

export interface ImageFieldEditorState {
    currentView: "editor" | "gallery" | "my-assets";
    filterOpen: boolean;
    gallerySelectedTags: string[];
    tileGalleryVisible?: boolean;
    headerVisible?: boolean;
    hideMyAssets?: boolean;
    galleryFilter: string;
    editingTile?: boolean;
    hideCloseButton?: boolean;
}

interface ProjectGalleryItem extends pxt.sprite.GalleryItem {
    assetType: pxt.AssetType;
    id: string;
}

export interface AssetEditorCore {
    getAsset(): pxt.Asset;
    getPersistentData(): any;
    restorePersistentData(value: any): void;
    getJres(): string;
    loadJres(value: string): void;
    openAsset(asset: pxt.Asset, gallery?: GalleryTile[], keepPast?: boolean): void;
    openGalleryAsset(asset: pxt.Asset): void;
    disableResize(): void;
    onResize(): void;
}

export class ImageFieldEditor<U extends pxt.Asset> extends React.Component<ImageFieldEditorProps, ImageFieldEditorState> implements FieldEditorComponent<U> {
    protected blocksInfo: pxtc.BlocksInfo;
    protected ref: AssetEditorCore;
    protected closeEditor: () => void;
    protected options: any;
    protected editID: string;
    protected galleryAssets: pxt.Asset[];
    protected userAssets: pxt.Asset[];
    protected shortcutLock: number;
    protected lightMode: boolean;

    protected get asset() {
        return this.ref?.getAsset();
    }

    constructor(props: ImageFieldEditorProps) {
        super(props);

        this.state = {
            currentView: "editor",
            headerVisible: true,
            filterOpen: false,
            gallerySelectedTags: [],
            galleryFilter: ""
        };
        setTelemetryFunction(tickImageEditorEvent);
    }

    render() {
        const { currentView, headerVisible, editingTile, hideMyAssets, filterOpen, hideCloseButton } = this.state;
        const filterPanelVisible = this.state.currentView === "gallery" && filterOpen;

        let showHeader = headerVisible;
        // If there is no asset, show the gallery to prevent changing shape when it's added
        let showGallery = !this.props.isMusicEditor && (!this.asset || editingTile || this.asset.type !== pxt.AssetType.Tilemap);
        const showMyAssets = !hideMyAssets && !editingTile;

        if (this.asset && !this.galleryAssets && showGallery) {
            this.updateGalleryAssets();
        }

        if (!this.galleryAssets?.length) {
            showGallery = false;
        }

        const specialTags = this.props.includeSpecialTagsInFilter ? [] : ["tile", "dialog", "background"];
        let allTags: string[] = [];
        let filteredAssets: pxt.Asset[] = [];
        switch (currentView) {
            case "my-assets":
                filteredAssets = this.filterAssetsByType(this.userAssets, editingTile ? pxt.AssetType.Tile : this.asset?.type);
                allTags = this.getAvailableTags(filteredAssets, specialTags);
                break;
            case "gallery":
                filteredAssets = this.filterAssetsByType(this.galleryAssets, editingTile ? pxt.AssetType.Tile : this.asset?.type, true, true);
                allTags = this.getAvailableTags(filteredAssets, specialTags);
                filteredAssets = this.filterAssetsByTag(filteredAssets);
                break;
            default:
                break;
        }

        const toggleOptions = [{
            label: lf("Editor"),
            title: lf("Editor"),
            focusable: true,
            icon: "fas fa-paint-brush",
            onClick: this.showEditor,
            view: "editor"
        }, {
            label: lf("Gallery"),
            title: lf("Gallery"),
            focusable: true,
            icon: "fas fa-image",
            onClick: this.showGallery,
            view: "gallery"
        }, {
            label: lf("My Assets"),
            title: lf("My Assets"),
            focusable: true,
            icon: "fas fa-folder",
            onClick: this.showMyAssets,
            view: "my-assets"
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

        return <div className={classList("image-editor-wrapper", this.props.isMusicEditor && "music-asset-editor")}>
            {showHeader && <div className="gallery-editor-header">
                <div className="image-editor-header-left" />
                <div className="image-editor-header-center">
                    <EditorToggle
                        id="image-editor-toggle"
                        className="slim tablet-compact"
                        items={toggleOptions}
                        selected={toggleOptions.findIndex(i => i.view === currentView)}
                    />
                </div>
                <div className="image-editor-header-right">
                    <div className={`gallery-filter-button ${this.state.currentView === "gallery" ? '' : "hidden"}`} role="button" onClick={this.toggleFilter} onKeyDown={fireClickOnEnter}>
                        <div className="gallery-filter-button-icon">
                            <i className="icon filter" />
                        </div>
                        <div className="gallery-filter-button-label">{lf("Filter")}</div>
                    </div>
                    {!editingTile && !hideCloseButton && <div className="image-editor-close-button" role="button" onClick={this.onDoneClick}>
                        <i className="ui icon close"/>
                    </div>}
                </div>
            </div>}
            <div className="image-editor-gallery-window">
                <div className="image-editor-gallery-content">
                    {this.props.isMusicEditor ?
                        <MusicFieldEditor
                            ref="image-editor"
                            onDoneClicked={this.onDoneClick}
                            hideDoneButton={this.props.hideDoneButton} /> :
                        <ImageEditor
                            ref="image-editor"
                            singleFrame={this.props.singleFrame}
                            onDoneClicked={this.onDoneClick}
                            onTileEditorOpenClose={this.onTileEditorOpenClose}
                            lightMode={this.lightMode}
                            hideDoneButton={this.props.hideDoneButton}
                            hideAssetName={!pxt.appTarget?.appTheme?.assetEditor}
                        />
                    }
                    <ImageEditorGallery
                        items={filteredAssets}
                        hidden={currentView === "editor"}
                        onAssetSelected={this.onAssetSelected} />
                </div>
                <div className={`filter-panel-gutter ${!filterPanelVisible ? "hidden" : ""}`}>
                    <div className={`filter-panel-container`}>
                        <FilterPanel enabledTags={this.state.gallerySelectedTags} tagClickHandler={this.tagClickHandler} clearTags={this.clearFilterTags} tagOptions={allTags}/>
                    </div>
                </div>
            </div>
        </div>
    }

    componentDidMount() {
        this.ref = this.refs["image-editor"] as any as AssetEditorCore;
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
        this.lightMode = options.lightMode;

        switch (value.type) {
            case pxt.AssetType.Image:
                this.initSingleFrame(value as pxt.ProjectImage, options);
                break;
            case pxt.AssetType.Tile:
                options.disableResize = true;
                this.initSingleFrame(value as unknown as pxt.ProjectImage, options);
                break;
            case pxt.AssetType.Animation:
                this.initAnimation(value as pxt.Animation, options);
                break;
            case pxt.AssetType.Tilemap:
                this.initTilemap(value as pxt.ProjectTilemap, options);
                break;
            case pxt.AssetType.Song:
                this.ref.openAsset(value);
                break;
        }

        this.editID = value.id;
        let didUpdate = false;

        if (options) {
            this.blocksInfo = options.blocksInfo;

            if (options.filter) {
                this.setState({
                    galleryFilter: options.filter
                });
                didUpdate = true;
            }

            if (options.headerVisible != undefined) {
                this.setState({ headerVisible: options.headerVisible })
                didUpdate = true;
            }

            if (options.hideMyAssets != undefined) {
                this.setState({ hideMyAssets: options.hideMyAssets });
                didUpdate = true;
            }

            if (options.hideCloseButton != undefined) {
                this.setState({ hideCloseButton: options.hideCloseButton });
                didUpdate = true;
            }
        }

        // Always update, because we might need to remove the gallery toggle
        if (!didUpdate) this.forceUpdate();
    }

    getValue() {
        if (this.ref) {
            return this.ref.getAsset() as U;
        }
        return null;
    }

    getJres() {
        return this.ref ? this.ref.getJres() : "";
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

    protected getAvailableTags(filterAssets: pxt.Asset[], ignoredTags: string[]) {
        let collectedTags: string[] = [];
        // Pixel Art Categories -- Add new categories here!
        // lf("People")
        // lf("Animals")
        // lf("Food")
        // lf("Dungeon")
        // lf("Forest")
        // lf("Space")
        // lf("Aquatic")
        // lf("Buildings")
        // lf("Furniture")
        // lf("Electronics")
        // lf("Transportation")
        // lf("Swamp")
        // lf("Sports")
        // lf("Background")
        // lf("tile")
        // lf("dialog")

        if (this.galleryAssets) {
            filterAssets.forEach( (asset) => {
                asset.meta.tags?.forEach(t => {
                    const sanitizedTag = sanitize(t);
                    if (ignoredTags.indexOf(sanitizedTag) < 0 && collectedTags.indexOf(sanitizedTag) < 0) {
                        collectedTags.push(sanitizedTag);
                    }
                });
            })

            return collectedTags;
        }
        return [];

        function sanitize(tag: string) {
            let sanitizedTag = (tag.indexOf("?") === 0) && tag.length > 1 ? tag.substring(1) : tag;
            sanitizedTag = sanitizedTag.toLowerCase();

            return sanitizedTag;
        }

    }

    protected tagClickHandler = (tag: string) => {
        let selectedTags = this.state.gallerySelectedTags;
        const sanitizedTag = tag.toLowerCase();
        const index = selectedTags.indexOf(sanitizedTag);
        if (index < 0) {
            selectedTags.push(sanitizedTag);
        } else {
            selectedTags.splice(index, 1);
        }
        this.setState({
            gallerySelectedTags: selectedTags
        })
    }

    protected clearFilterTags = () => {
        this.setState({
            gallerySelectedTags: []
        });
    }

    protected toggleFilter = () => {
        this.setState({
            filterOpen: !this.state.filterOpen
        });
    }

    protected filterAssetsByTag(assets: pxt.Asset[]) {
        if (this.state.gallerySelectedTags.length > 0 && this.state.filterOpen) {
            assets = assets.filter((asset) => {
                return !!asset.meta.tags?.find(t => this.state.gallerySelectedTags.indexOf(t) >= 0);
            })
        }
        return assets;
    }

    protected filterAssetsByType(assets: pxt.Asset[], type?: pxt.AssetType, isGallery = false, useTags?: boolean) {
        if (type === undefined) {
            type = this.asset?.type;
        }
        if (type === undefined) {
            return assets;
        }

        if (this.asset && !isGallery) {
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

        if (useTags) {
            assets.forEach(a => {
                if (!a.meta.tags && this.options) {
                    a.meta.tags = this.blocksInfo?.apis.byQName[a.id]?.attributes.tags?.split(" ") || [];
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
                case pxt.AssetType.Song:
                    return assets.filter(t => t.type === pxt.AssetType.Song);
            }
        }
        else {
            switch (type) {
                case pxt.AssetType.Animation:
                    return assets.filter(t => t.type === pxt.AssetType.Animation);
                case pxt.AssetType.Image:
                    return assets.filter(t => t.type === pxt.AssetType.Image);
                case pxt.AssetType.Tile:
                    return assets.filter(t => t.type === pxt.AssetType.Tile);
                case pxt.AssetType.Tilemap:
                    return assets.filter(t => t.type === pxt.AssetType.Tilemap);
                case pxt.AssetType.Song:
                    return assets.filter(t => t.type === pxt.AssetType.Song);
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
        if (options?.blocksInfo) {
            this.blocksInfo = options.blocksInfo;

            gallery = pxt.sprite.filterItems(pxt.sprite.getGalleryItems(this.blocksInfo, "Image"), ["tile"])
                .map(g => {
                    const bitmap = pxt.sprite.getBitmap(this.blocksInfo, g.qName).data();
                    let tileWidth: number;
                    if (bitmap.width === 8 || bitmap.width === 32) {
                        tileWidth = bitmap.width;
                    }
                    else {
                        tileWidth = 16;
                    }

                    return (
                        {
                            bitmap,
                            tags: g.tags,
                            qualifiedName: g.qName,
                            tileWidth
                        }
                    );
                })
        }

        if (options?.galleryTiles) {
            gallery = options.galleryTiles
                .map((g: any) => ({ bitmap: g.bitmap, tags: g.tags, qualifiedName: g.qName, tileWidth: g.bitmap.width }))
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
        this.userAssets = getAssets(undefined, undefined, this.options.temporaryAssets);
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
                (this.ref as ImageEditor).openInTileEditor(pxt.sprite.Bitmap.fromData((asset as pxt.Tile).bitmap))
            }
            else if (this.state.currentView === "gallery") {
                this.ref.openGalleryAsset(asset as pxt.Tile | pxt.ProjectImage | pxt.Animation);
            }
            else {
                const project = pxt.react.getTilemapProject();
                if (this.asset?.type === pxt.AssetType.Tilemap) {
                    pxt.sprite.updateTilemapReferencesFromResult(project, this.asset);
                }

                if (this.asset.meta.displayName) {
                    project.updateAsset(this.asset);
                }
                else if (!asset.meta.displayName) {
                    // If both are temporary, copy by value
                    asset = {
                        ...pxt.cloneAsset(asset),
                        id: this.asset.id,
                        meta: this.asset.meta
                    }
                }

                if (asset.type === pxt.AssetType.Tilemap) {
                    pxt.sprite.addMissingTilemapTilesAndReferences(project, asset);
                }

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
        if (this.ref) {
            this.ref.loadJres(jres);
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
    icon?: string;
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
                {left.icon && <i className={`ui icon ${left.icon}`} />}
                <span>{left.label}</span>
            </div>
            {center && <div className="gallery-editor-toggle-label gallery-editor-toggle-center" onClick={center.onClick} role="button">
                {center.icon && <i className={`ui icon ${center.icon}`} />}
                <span>{center.label}</span>
            </div>}
            <div className="gallery-editor-toggle-label gallery-editor-toggle-right" onClick={right.onClick} role="button">
                {right.icon && <i className={`ui icon ${right.icon}`} />}
                <span>{right.label}</span>
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