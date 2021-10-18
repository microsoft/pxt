/// <reference path="../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";

import { setTelemetryFunction } from './components/ImageEditor/store/imageReducer';
import { ImageEditor } from "./components/ImageEditor/ImageEditor";


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
    asset?: pxt.Asset;
}

export interface Message {
    data: IncomingMessageData;
}

export interface BaseMessage {
    _fromVscode?: boolean;
    type: string;
    message?: string;
    name?: string;
    tileWidth?: number;
}

type IncomingMessageData = OpenAssetMessage | SaveAssetMessage | LegacyInitializeMessage | LegacyUpdateMessage;

interface OpenAssetMessage extends BaseMessage {
    type: "open-asset";
    asset: pxt.Asset;
}

interface SaveAssetMessage extends BaseMessage {
    type: "save-asset";
    asset?: pxt.Asset;
}

interface LegacyInitializeMessage extends BaseMessage {
    type: "initialize";
    message: string;
    name?: string;
    tileWidth?: number;
}

interface LegacyUpdateMessage extends BaseMessage {
    type: "update";
}

type OutgoingMessageData =  ReadyMessage | SaveAssetMessage | LegacyUpdateMessage;

interface ReadyMessage extends BaseMessage {
    type: "ready";
}

const DEFAULT_NAME = "tilemap_asset";
const DEFAULT_TILE_WIDTH = 16;

export class AssetEditor extends React.Component<{}, AssetEditorState> {
    private editor: ImageEditor;
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

        this.tilemapProject = new pxt.TilemapProject();
        pxt.react.getTilemapProject = () => this.tilemapProject;
    }

    handleMessage = (msg: Message)  => {
        const data = msg.data;
        if (data._fromVscode) {
            switch (data.type) {
                case "open-asset":
                    this.tilemapProject = new pxt.TilemapProject();
                    const asset = data.asset;

                    if (asset.type === pxt.AssetType.Tilemap) {
                        // Need to rehydrate after being passed between frames
                        const oldData = asset.data;
                        const newTm = new pxt.sprite.Tilemap(oldData.tilemap.width, oldData.tilemap.height, 0, 0, (oldData.tilemap as any).buf);
                        asset.data = new pxt.sprite.TilemapData(newTm, oldData.tileset, oldData.layers);

                        for (const tile of asset.data.tileset.tiles) {
                            const newTile = this.tilemapProject.createNewTile(tile.bitmap, tile.id, tile.meta.displayName);
                            tile.internalID = newTile.internalID;
                        }
                    }

                    this.setState({ asset: asset }, () => this.editor.openAsset(asset))
                    break;
                case "save-asset":
                    this.saveAsset();
                    break;
                default:
                    this.handleLegacyMessage(msg);
                    break;
            }
        }
    }

    postMessage(msgData: OutgoingMessageData) {
        window.parent.postMessage(msgData, "*");
    }

    initTilemap(s?: string) {
        this.tilemapProject.loadTilemapJRes(s ? this.parseJres(s) : {});
        let project = this.tilemapProject.getTilemap(this.tilemapName);

        if (!project) {
            const [ name, map ] = this.tilemapProject.createNewTilemap(this.tilemapName, this.tileWidth, 16, 16);
            project = this.tilemapProject.getTilemap(name);
            this.tilemapName = name;
        }

        this.editor.openAsset(project);
    }

    updateTilemapProject() {
        const data = this.editor.getAsset() as pxt.ProjectTilemap;
        pxt.sprite.updateTilemapReferencesFromResult(this.tilemapProject, data);
        this.tilemapProject.updateAsset(data);
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

    saveAsset() {
        const asset = this.editor.getAsset();
        this.postMessage({
            type: "save-asset",
            asset
        });
    }

    sendJres() {
        let message: string;
        const asset = this.editor.getAsset();

        switch (asset.type) {
            case pxt.AssetType.Image:
            case pxt.AssetType.Tile:
            case pxt.AssetType.Animation:
                message = JSON.stringify(pxt.serializeAsset(asset));
                break;
            case pxt.AssetType.Tilemap:
                this.updateTilemapProject();
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
        const { asset } = this.state;

        return <ImageEditor
            ref={this.handleImageEditorRef}
            singleFrame={asset?.type !== pxt.AssetType.Animation}
            onDoneClicked={this.handleDoneButtonClick}
            onChange={this.handleAssetChange}/>
    }

    protected handleDoneButtonClick = () => {
        this.sendJres();
        this.saveAsset();
    }

    protected handleImageEditorRef = (ref: ImageEditor) => {
        if (ref) {
            this.editor = ref;
            this.postMessage({
                type: "ready"
            });
        }
    }

    protected handleLegacyMessage = (msg: Message) => {
        if (msg.data.type === "initialize") {
            switch (this.state.viewType) {
                case "sprite":
                    this.editor.setCurrentFrame(pxt.sprite.getBitmapFromJResURL(msg.data.message), true);
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

    protected handleAssetChange = pxt.U.throttle(() => {
        this.saveAsset();
    }, 500)
}

function tickAssetEditorEvent(event: string) {
    pxt.tickEvent("asset.editor", {
        action: event
    });
}

