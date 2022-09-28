/// <reference path="../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ImageFieldEditor } from "./components/ImageFieldEditor";
import { FieldEditorComponent } from "./blocklyFieldView";
import { TilemapFieldEditor } from "./components/TilemapFieldEditor";
import { setTelemetryFunction } from './components/ImageEditor/store/imageReducer';
import { MusicEditor } from "./components/musicEditor/MusicEditor";


document.addEventListener("DOMContentLoaded", () => {
    init();
})

function init() {
    const assetDiv = document.getElementById("asset-editor-field-div") as HTMLDivElement;
    ReactDOM.render(<AssetEditor />, assetDiv);
}

type AssetType = "sprite" | "tilemap";

interface AssetEditorState {
    viewType: AssetType;
}

export interface Message {
    data: MessageData;
}
export interface MessageData {
    _fromVscode?: boolean;
    type: string;
    message?: string;
    name?: string;
    tileWidth?: number;
}

const DEFAULT_NAME = "tilemap_asset";
const DEFAULT_TILE_WIDTH = 16;

export class AssetEditor extends React.Component<{}, AssetEditorState> {
    private editor: FieldEditorComponent<any>;
    protected tilemapProject: pxt.TilemapProject;
    protected tilemapName: string = DEFAULT_NAME;
    protected tileWidth: number = DEFAULT_TILE_WIDTH;

    constructor(props: {}) {
        super(props);

        let view: AssetType = "sprite";
        const v = /view(?:[:=])([a-zA-Z]+)/i.exec(window.location.href)
        if (v && v[1] === "tilemap") {
            view = "tilemap";
        }
        this.state = { viewType: view };

        setTelemetryFunction(tickAssetEditorEvent);
    }

    handleMessage = (msg: Message)  => {
        if (msg.data._fromVscode) {
            if (msg.data.type === "initialize") {
                switch (this.state.viewType) {
                    case "sprite":
                        this.editor.loadJres(msg.data.message);
                        break;
                    case "tilemap":
                        this.tilemapName = msg.data.name;
                        this.tileWidth = msg.data.tileWidth;
                        this.initTilemap(msg.data.message);
                        break;
                }
            } else if (msg.data.type === "update") {
                this.sendJres();
            }
        }
    }

    postMessage(msgData: MessageData) {
        window.parent.postMessage(msgData, "*");
    }

    refHandler = (e: FieldEditorComponent<any>) => {
        this.editor = e;
        if (this.state.viewType === "tilemap") {
            this.initTilemap();
        }
    }

    initTilemap(s?: string) {
        this.tilemapProject = new pxt.TilemapProject();
        this.tilemapProject.loadTilemapJRes(s ? this.parseJres(s) : {});
        let project = this.tilemapProject.getTilemap(this.tilemapName).data;

        if (!project) {
            const [ name, map ] = this.tilemapProject.createNewTilemap(this.tilemapName, this.tileWidth, 16, 16);
            project = map;
            this.tilemapName = name;
        }

        this.editor.init(project, this.callbackOnDoneClick);
    }

    updateTilemap() {
        const data = this.editor.getValue() as pxt.sprite.TilemapData;

        // reference pxteditor/monaco-fields/field_tilemap.ts
        if (data.deletedTiles) {
            for (const deleted of data.deletedTiles) {
                this.tilemapProject.deleteTile(deleted);
            }
        }

        if (data.editedTiles) {
            for (const edit of data.editedTiles) {
                const editedIndex = data.tileset.tiles.findIndex(t => t.id === edit);
                const edited = data.tileset.tiles[editedIndex];

                // New tiles start with *. We haven't created them yet so ignore
                if (!edited || edited.id.startsWith("*")) continue;

                data.tileset.tiles[editedIndex] = this.tilemapProject.updateTile(edited)
            }
        }

        for (let i = 0; i < data.tileset.tiles.length; i++) {
            const tile = data.tileset.tiles[i];

            if (tile.id.startsWith("*")) {
                const newTile = this.tilemapProject.createNewTile(tile.bitmap);
                data.tileset.tiles[i] = newTile;
            }
            else if (!tile.jresData) {
                data.tileset.tiles[i] = this.tilemapProject.resolveTile(tile.id);
            }
        }

        this.tilemapProject.updateTilemap(this.tilemapName, data);

    }

    componentDidMount() {
        window.addEventListener("message", this.handleMessage, null);
        this.postMessage({type: "ready", message: this.state.viewType});
        tickAssetEditorEvent("asset-editor-shown");
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.handleMessage, null);
    }

    callbackOnDoneClick = () => {
        this.sendJres();
    }

    sendJres() {
        let message: string;
        switch (this.state.viewType) {
            case "sprite":
                message = this.editor.getJres();
                break;
            case "tilemap":
                this.updateTilemap();
                const jres = this.tilemapProject.getProjectTilesetJRes()
                const tilemapFiles = { jres, ts: pxt.emitTilemapsFromJRes(jres) }
                message = JSON.stringify(tilemapFiles);
                break;
        }

        this.postMessage({
            type: "update",
            message
        });
    }

    parseJres(jres: string) {
        const allres: pxt.Map<pxt.JRes> = {}
        let js: pxt.Map<pxt.JRes> = JSON.parse(jres)
        pxt.inflateJRes(js, allres);
        return allres;
    }

    render() {
        // if (this.state.viewType === "tilemap") {
        //     return <TilemapFieldEditor ref={ this.refHandler } />
        // }
        // return <ImageFieldEditor ref={this.refHandler} singleFrame={true} doneButtonCallback={this.callbackOnDoneClick} />
        return <MusicEditor song={pxt.assets.music.getEmptySong(2)} />
    }

}

function tickAssetEditorEvent(event: string) {
    pxt.tickEvent("asset.editor", {
        action: event
    });
}
