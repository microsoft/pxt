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
                pxt.blocks.initializeAndInject(info);
                this.blocksInfo = info;
                this.updateGalleryAssets();
            })
            .then(() => store.dispatch(dispatchUpdateUserAssets()))
            .then(() => {
                this.parent.forceUpdate()
                // Do Not Remove: This is used by the skillmap
                this.parent.onEditorContentLoaded();
            });
    }

    unloadFileAsync(): Promise<void> {
        blocklyFieldView.dismissIfVisible();
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
        const container = this.getAssetEditorDiv();
        // In tutorial view, the image editor is smaller and has no padding
        if (container && this.parent.isTutorial() && !pxt.BrowserUtils.isTabletSize()) {
            const containerRect = container.getBoundingClientRect();
            const editorTools = document.getElementById("editortools");
            blocklyFieldView.setEditorBounds({
                top: containerRect.top,
                left: containerRect.left,
                width: containerRect.width,
                height: containerRect.height + (editorTools ? editorTools.getBoundingClientRect().height : 0),
                horizontalPadding: 0,
                verticalPadding: 0
            });
        } else {
            blocklyFieldView.setEditorBounds({
                top: 0,
                left: 0,
                width: window.innerWidth,
                height: window.innerHeight
            });
        }
    }

    display(): JSX.Element {
        const updateProject = async () => {
            await this.parent.reloadHeaderAsync();
            this.parent.openAssets();
        }

        // TODO: re-enable the create asset button in tutorials when we add
        // the ability to switch editors inside a tutorial
        return <Provider store={store}>
            <div className="asset-editor-outer">
                <AssetSidebar showAssetFieldView={this.showAssetFieldView} updateProject={updateProject}/>
                <AssetGallery showAssetFieldView={this.showAssetFieldView} disableCreateButton={this.parent.isTutorial()} />
            </div>
        </Provider>
    }

    protected getAssetEditorDiv() {
        return document.getElementById("assetEditor");
    }

    protected getTutorialCardDiv() {
        return document.getElementById("tutorialcard");
    }

    protected getTutorialMenuDiv() {
        return  document.getElementsByClassName("tutorial-menuitem")?.[0];
    }

    protected handleTutorialClick(ev: MouseEvent) {
        ev.stopPropagation();
        ev.preventDefault();
    }

    protected bindTutorialEvents() {
        const tutorialCard = this.getTutorialCardDiv();
        tutorialCard?.addEventListener("mousedown", this.handleTutorialClick);

        const tutorialMenu = this.getTutorialMenuDiv();
        tutorialMenu?.addEventListener("mousedown", this.handleTutorialClick);

        pxt.BrowserUtils.addClass(document.getElementById("maineditor"), "image-editor-open");
    }

    protected unbindTutorialEvents() {
        const tutorialCard = this.getTutorialCardDiv();
        tutorialCard?.removeEventListener("mousedown", this.handleTutorialClick);

        const tutorialMenu = this.getTutorialMenuDiv();
        tutorialMenu?.removeEventListener("mousedown", this.handleTutorialClick);

        pxt.BrowserUtils.removeClass(document.getElementById("maineditor"), "image-editor-open");
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
                pxt.sprite.addMissingTilemapTilesAndReferences(project, asset);

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
            case pxt.AssetType.Song:
                fieldView = pxt.react.getFieldEditorView("music-editor", asset as pxt.Song, {});
                break;
            default:
                break;
        }

        if (this.parent.isTutorial()) {
            blocklyFieldView.setContainerClass("asset-editor-tutorial");
        }

        fieldView.onHide(() => {
            if (this.parent.isTutorial()) this.unbindTutorialEvents();

            const result = fieldView.getResult();
            if (asset.type == pxt.AssetType.Tilemap) {
                pxt.sprite.updateTilemapReferencesFromResult(pxt.react.getTilemapProject(), result);
            }

            Promise.resolve(cb(result)).then(() => {
                // for temporary (unnamed) assets, update the underlying typescript image literal
                if (!asset.meta?.displayName) {
                    this.parent.saveBlocksToTypeScriptAsync().then((src) => {
                        if (src) pkg.mainEditorPkg().setContentAsync(pxt.MAIN_TS, src)
                    })
                }
            });

            blocklyFieldView.setContainerClass(null);
        });

        // Do not close image editor when clicking on previous/next in the tutorial, or menu dots
        if (this.parent.isTutorial()) this.bindTutorialEvents();

        fieldView.show();
    }
}