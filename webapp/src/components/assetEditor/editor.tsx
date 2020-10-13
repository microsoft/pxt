/// <reference path="../../../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as pkg from "../../package";
import * as compiler from "../../compiler";

import { Provider } from 'react-redux';
import store from './store/assetEditorStore'

import { dispatchUpdateUserAssets } from './actions/dispatch';

import { Editor } from "../../srceditor";
import { AssetSidebar } from "./assetSidebar";
import { AssetGallery } from "./assetGallery";

export class AssetEditor extends Editor {
    protected galleryAssets: pxt.Asset[] = [];

    acceptsFile(file: pkg.File) {
        return file.name === pxt.ASSETS_FILE;
    }

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
        // force refresh to ensure we have a view
        return super.loadFileAsync(file, hc)
            .then(() => compiler.getBlocksAsync()) // make sure to load block definitions
            .then(info => this.updateGalleryAssets(info))
            .then(() => store.dispatch(dispatchUpdateUserAssets()))
            .then(() => this.parent.forceUpdate());
    }

    undo() {
        pxt.react.getTilemapProject().undo();
        store.dispatch(dispatchUpdateUserAssets());
    }

    redo() {
        pxt.react.getTilemapProject().redo();
        store.dispatch(dispatchUpdateUserAssets());
    }

    display(): JSX.Element {
        return <Provider store={store}>
            <div className="asset-editor-outer">
                <AssetSidebar />
                <AssetGallery galleryAssets={this.galleryAssets} />
            </div>
        </Provider>
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
}