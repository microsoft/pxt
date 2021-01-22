/// <reference path="../../../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as pkg from "../../package";
import * as compiler from "../../compiler";
import * as blocklyFieldView from "../../blocklyFieldView";

import { Provider } from 'react-redux';
import store from './store/assetEditorStore'

import { dispatchUpdateUserAssets, dispatchUpdateGalleryAssets } from './actions/dispatch';

import { Editor } from "../../srceditor";
import { AssetSidebar } from "./assetSidebar";
import { AssetGallery } from "./assetGallery";

export class AssetEditor extends Editor {
    protected blocksInfo: pxtc.BlocksInfo;

    getId() {
        return "assetEditor";
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.ASSETS_FILE;
    }

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
        // force refresh to ensure we have a view

        return super.loadFileAsync(file, hc)
            .then(() => compiler.getBlocksAsync()) // make sure to load block definitions
            .then(info => {
                this.blocksInfo = info;
                this.updateGalleryAssets();
            })
            .then(() => store.dispatch(dispatchUpdateUserAssets()))
            .then(() => this.parent.forceUpdate());
    }

    unloadFileAsync(): Promise<void> {
        return pkg.mainEditorPkg().buildAssetsAsync();
    }

    undo() {
        pxt.react.getTilemapProject().undo();
        store.dispatch(dispatchUpdateUserAssets());
    }

    redo() {
        pxt.react.getTilemapProject().redo();
        store.dispatch(dispatchUpdateUserAssets());
    }


    resize(e?: Event) {
        blocklyFieldView.setEditorBounds({
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight
        });
    }

    display(): JSX.Element {
        return <Provider store={store}>
            <div className="asset-editor-outer">
                <AssetSidebar showAssetFieldView={this.showAssetFieldView} />
                <AssetGallery showAssetFieldView={this.showAssetFieldView} />
            </div>
        </Provider>
    }

    protected updateGalleryAssets() {
        store.dispatch(dispatchUpdateGalleryAssets());
    }

    protected showAssetFieldView = (asset: pxt.Asset, cb?: (result: any) => void) => {
        let fieldView: pxt.react.FieldEditorView<any>;
        switch (asset.type) {
            case pxt.AssetType.Image:
            case pxt.AssetType.Tile:
                fieldView = pxt.react.getFieldEditorView("image-editor", asset as pxt.ProjectImage, {
                    initWidth: 16,
                    initHeight: 16,
                    headerVisible: true,
                    hideMyAssets: true,
                    blocksInfo: this.blocksInfo
                });
                break;
            case pxt.AssetType.Tilemap:
                const project = pxt.react.getTilemapProject();
                // for tilemaps, fill in all project tiles
                const allTiles = project.getProjectTiles(asset.data.tileset.tileWidth, true);
                const referencedTiles = [];
                for (const tile of allTiles.tiles) {
                    if (!asset.data.tileset.tiles.some(t => t.id === tile.id)) {
                        asset.data.tileset.tiles.push(tile);
                    }
                    if (project.isAssetUsed(tile, null, [asset.id])) {
                        referencedTiles.push(tile.id);
                    }
                }

                asset.data.projectReferences = referencedTiles;

                fieldView = pxt.react.getFieldEditorView("tilemap-editor", asset as pxt.ProjectTilemap, {
                    initWidth: 16,
                    initHeight: 16,
                    headerVisible: true,
                    hideMyAssets: true,
                    blocksInfo: this.blocksInfo
                });
                break;
            case pxt.AssetType.Animation:
                fieldView = pxt.react.getFieldEditorView("animation-editor", asset as pxt.Animation, {
                    initWidth: 16,
                    initHeight: 16,
                    headerVisible: true,
                    hideMyAssets: true,
                    blocksInfo: this.blocksInfo
                });
                break;
            default:
                break;
        }

        fieldView.onHide(() => {
            const result = fieldView.getResult();
            if (asset.type == pxt.AssetType.Tilemap) result.data = this.updateTilemapTiles(result.data);

            Promise.resolve(cb(result)).then(() => {
                // for temporary (unnamed) assets, update the underlying typescript image literal
                if (!result.meta?.displayName) {
                    this.parent.saveBlocksToTypeScriptAsync().then((src) => {
                        if (src) pkg.mainEditorPkg().setContentAsync("main.ts", src)
                    })
                }
            });
        });
        fieldView.show();
    }

    protected updateTilemapTiles = (data: pxt.sprite.TilemapData): pxt.sprite.TilemapData => {
        const project = pxt.react.getTilemapProject();

        data.deletedTiles?.forEach(deleted => project.deleteTile(deleted));

        data.editedTiles?.forEach(edited => {
            const index = data.tileset.tiles.findIndex(t => t.id === edited);
            const tile = data.tileset.tiles[index];

            if (!tile) return;

            data.tileset.tiles[index] = project.updateTile(tile);
        })

        data.tileset.tiles.forEach((t, i) => {
            if (t && !t.jresData) {
                data.tileset.tiles[i] = project.resolveTile(t.id);
            }
        })

        pxt.sprite.trimTilemapTileset(data);
        return data;
    }
}