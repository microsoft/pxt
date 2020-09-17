/// <reference path="../../../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as pkg from "../../package";
import * as compiler from "../../compiler";

import { Editor } from "../../srceditor";
import { AssetCardList } from "./assetCardList";
import { AssetSidebar } from "./assetSidebar";
import { AssetTopbar } from "./assetTopbar";



export class AssetEditor extends Editor {
    protected galleryAssets: pxt.Asset[] = [];

    acceptsFile(file: pkg.File) {
        return file.name === "assets.jres";
    }

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
        // force refresh to ensure we have a view
        return super.loadFileAsync(file, hc)
            .then(() => compiler.getBlocksAsync()) // make sure to load block definitions
            .then(info => this.updateGalleryAssets(info))
            .then(() => this.parent.forceUpdate());
    }

    display(): JSX.Element {
        return <div className="asset-editor-outer">
            <AssetTopbar />
            <div className="asset-editor-inner">
                <AssetSidebar />
                <AssetCardList assets={this.galleryAssets} />
            </div>
        </div>
    }

    protected updateGalleryAssets(blocksInfo: pxtc.BlocksInfo) {
        const allImages = pxt.sprite.getGalleryItems(blocksInfo, "Image");
        const tileAssets: pxt.Asset[] = [];
        const imageAssets: pxt.Asset[] = [];

        for (const item of allImages) {
            if (item.tags.indexOf("tile") === -1) {
                imageAssets.push({
                    type: pxt.AssetType.Image,
                    id: item.qName,
                    previewURI: item.src
                });
            }
            else {
                tileAssets.push({
                    type: pxt.AssetType.Tile,
                    id: item.qName,
                    previewURI: item.src
                });
            }
        }

        this.galleryAssets = imageAssets.concat(tileAssets);
    }
}