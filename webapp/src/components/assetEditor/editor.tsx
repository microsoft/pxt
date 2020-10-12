/// <reference path="../../../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as pkg from "../../package";
import * as compiler from "../../compiler";

import { Provider } from 'react-redux';
import store from './store/assetEditorStore'

import { Editor } from "../../srceditor";
import { AssetCardList } from "./assetCardList";
import { AssetSidebar } from "./assetSidebar";
import { AssetTopbar } from "./assetTopbar";
import { GalleryView } from "./store/assetEditorReducer";

export class AssetEditor extends Editor {
    protected projectAssets: pxt.Asset[] = [];
    protected galleryAssets: pxt.Asset[] = [];
    protected galleryView: GalleryView;

    constructor(parent: pxt.editor.IProjectView) {
        super(parent);
        store.subscribe(this.onStoreChange);
    }

    acceptsFile(file: pkg.File) {
        return file.name === "assets.jres";
    }

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
        // force refresh to ensure we have a view
        return super.loadFileAsync(file, hc)
            .then(() => compiler.getBlocksAsync()) // make sure to load block definitions
            .then(info => this.updateGalleryAssets(info))
            .then(() => this.updateProjectAssets())
            .then(() => this.parent.forceUpdate());
    }

    display(): JSX.Element {
        const state = store.getState();
        return <Provider store={store}>
            <div className="asset-editor-outer">
                <AssetSidebar />
                <div className="asset-editor-gallery">
                    <AssetTopbar />
                    <AssetCardList assets={state.view == GalleryView.Gallery ? this.galleryAssets : this.projectAssets} />
                </div>
            </div>
        </Provider>
    }

    protected updateProjectAssets() {
        const project = pxt.react.getTilemapProject();
        const imgConv = new pxt.ImageConverter();

        const imageToGalleryItem = (image: pxt.ProjectImage | pxt.Tile) => {
            let asset = image as pxt.Asset;
            asset.previewURI = imgConv.convert("data:image/x-mkcd-f," + image.jresData);
            return asset;
        };

        this.projectAssets = project.getAssets(pxt.AssetType.Image).map(imageToGalleryItem)
            .concat(project.getAssets(pxt.AssetType.Tile).map(imageToGalleryItem));
    }

    protected updateGalleryAssets(blocksInfo: pxtc.BlocksInfo) {
        const allImages = pxt.sprite.getGalleryItems(blocksInfo, "Image");
        const tileAssets: pxt.Asset[] = [];
        const imageAssets: pxt.Asset[] = [];

        for (const item of allImages) {
            if (item.tags.indexOf("tile") === -1) {
                imageAssets.push({
                    internalID: -1,
                    type: pxt.AssetType.Image,
                    id: item.qName,
                    jresData: "",
                    previewURI: item.src,
                    bitmap: pxt.sprite.getBitmap(blocksInfo, item.qName).data(),
                    meta: {}
                });
            }
            else {
                tileAssets.push({
                    internalID: -1,
                    type: pxt.AssetType.Tile,
                    id: item.qName,
                    jresData: "",
                    previewURI: item.src,
                    bitmap: pxt.sprite.Bitmap.fromData(pxt.react.getTilemapProject().resolveTile(item.qName).bitmap).data(),
                    meta: {}
                });
            }
        }

        this.galleryAssets = imageAssets.concat(tileAssets);
    }

    protected onStoreChange = () => {
        const state = store.getState();
        if (state.view != this.galleryView) {
            this.galleryView = state.view;
            this.parent.forceUpdate();
        }
    }
}