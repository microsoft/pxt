import * as React from "react";
import * as pkg from "../package";
import * as srceditor from "../srceditor"
import * as compiler from "../compiler";

import Util = pxt.Util;
import { ImageEditor } from "./ImageEditor/ImageEditor";


export interface TilemapJson {
    name: string;

    tileset: pxt.sprite.TileSet;
    tilemap: pxt.sprite.BitmapData;
    layers: pxt.sprite.BitmapData;

    nextId: number;
    projectReferences: number[];
}

export class Editor extends srceditor.Editor {
    protected file: pkg.File;
    protected editor: ImageEditor;

    getId() {
        return "imageEditor"
    }

    acceptsFile(file: pkg.File) {
        const ext = file.getExtension();
        return ext === pxt.sprite.TILEMAP_EXTENSION;
    }

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
        this.file = file;
        this.currSource = file.content;

        if (file && !this.currSource.trim()) {
            this.currSource = JSON.stringify(emptyTilemap());
        }
        return this.loadFileInEditorAsync();
    }

    getCurrentSource(): string {
        if (this.isTilemap() && this.editor) {
            const data = this.editor.getTilemap();
            if (data) return JSON.stringify(tilemapToJson(data));
        }
        return this.currSource;
    }

    display(): JSX.Element {
        return <div id="imageEditorArea">
            <div className="image-editor-wrapper">
                <div className="image-editor-gallery-content">
                    <ImageEditor ref={this.handleImageEditorRef} singleFrame={true} />
                </div>
            </div>
        </div>
    }

    resize(e?: Event) {
        if (this.editor) {
            this.editor.onResize();
        }
    }

    hasHistory() { return true; }
    hasUndo() { return true; }
    hasRedo() { return true; }
    undo() { }
    redo() { }

    zoomIn() { }
    zoomOut() { }
    setScale(scale: number) { }

    protected handleImageEditorRef = (ref: ImageEditor) => {
        if (ref) {
            this.editor = ref;
            this.editor.enableKeyboardShortcuts(false);
        }
    }

    protected loadFileInEditorAsync() {
        if (!this.editor || !this.currSource) return Promise.resolve();

        return this.getGalleryItemsAsync()
            .then(galleryItems => {
                const fileContent: TilemapJson = JSON.parse(this.currSource);

                const data = new pxt.sprite.TilemapData(pxt.sprite.Tilemap.fromData(fileContent.tilemap), fileContent.tileset, fileContent.layers);
                data.projectReferences = fileContent.projectReferences;
                data.nextId = fileContent.nextId;

                this.editor.initTilemap(data, galleryItems);
            });
    }

    protected getGalleryItemsAsync() {
        return compiler.getBlocksAsync()
            .then(blocksInfo => {
                return pxt.sprite.filterItems(pxt.sprite.getGalleryItems(blocksInfo, "Image"), ["tile"])
                    .map(g => ({
                        bitmap: pxt.sprite.getBitmap(blocksInfo, g.qName).data(),
                        tags: g.tags,
                        qualifiedName: g.qName,
                        tileWidth: 16
                    }));
            });
    }

    protected isTilemap() {
        return this.file?.getExtension() === pxt.sprite.TILEMAP_EXTENSION;
    }
}

function emptyTilemap(): TilemapJson {
    const data = new pxt.sprite.TilemapData(
        new pxt.sprite.Tilemap(16, 16),
        { tiles: [], tileWidth: 16 },
        new pxt.sprite.Bitmap(16, 16).data()
    );
    return tilemapToJson(data);
}

function tilemapToJson(data: pxt.sprite.TilemapData, name = "myTilemap") {
    return {
        name,
        tilemap: data.tilemap.data(),
        layers: data.layers,
        tileset: data.tileset,
        nextId: data.nextId,
        projectReferences: data.projectReferences
    };
}