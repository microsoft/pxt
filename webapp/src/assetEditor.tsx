/// <reference path="../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ImageFieldEditor } from "./components/ImageFieldEditor";
import { setTelemetryFunction } from './components/ImageEditor/store/imageReducer';


document.addEventListener("DOMContentLoaded", () => {
    init();
})

function init() {
    const assetDiv = document.getElementById("asset-editor-field-div") as HTMLDivElement;
    ReactDOM.render(<AssetEditor />, assetDiv);
}

interface AssetEditorState {
    editing?: pxt.Asset;
    isEmptyAsset?: boolean;
}

interface BaseAssetEditorRequest {
    id?: number;
    files: pxt.Map<string>;
}

interface OpenAssetEditorRequest extends BaseAssetEditorRequest {
    type: "open";
    assetId: string;
    assetType: pxt.AssetType;
}

interface CreateAssetEditorRequest extends BaseAssetEditorRequest {
    type: "create";
    assetType: pxt.AssetType;
}

interface SaveAssetEditorReqeust extends BaseAssetEditorRequest {
    type: "save";
}

interface DuplicateAssetEditorRequest extends BaseAssetEditorRequest {
    type: "duplicate";
    assetId: string;
    assetType: pxt.AssetType;
}

type AssetEditorRequest = OpenAssetEditorRequest | CreateAssetEditorRequest | SaveAssetEditorReqeust | DuplicateAssetEditorRequest;

interface BaseAssetEditorResponse {
    id?: number;
}

interface OpenAssetEditorResponse extends BaseAssetEditorResponse {
    type: "open";
}

interface CreateAssetEditorResponse extends BaseAssetEditorResponse {
    type: "create";
}

interface SaveAssetEditorResponse extends BaseAssetEditorResponse {
    type: "save";
    files: pxt.Map<string>;
}

interface DuplicateAssetEditorResponse extends BaseAssetEditorResponse {
    type: "duplicate";
}

type AssetEditorResponse = OpenAssetEditorResponse | CreateAssetEditorResponse | SaveAssetEditorResponse | DuplicateAssetEditorResponse;

interface AssetEditorDoneClickedEvent {
    type: "event";
    kind: "done-clicked"
}

interface AssetEditorReadyEvent {
    type: "event";
    kind: "ready";
}

type AssetEditorEvent = AssetEditorDoneClickedEvent | AssetEditorReadyEvent;


export class AssetEditor extends React.Component<{}, AssetEditorState> {
    private editor: ImageFieldEditor<pxt.Asset>;
    protected tilemapProject: pxt.TilemapProject;
    protected inflatedJres: pxt.Map<pxt.Map<pxt.JRes>>;
    protected commentAttrs: pxt.Map<pxtc.CommentAttrs>;
    protected files: pxt.Map<string>;
    protected galleryTiles: any[];

    constructor(props: {}) {
        super(props);
        this.state = {};
        pxt.react.getTilemapProject = () => this.tilemapProject;

        setTelemetryFunction(tickAssetEditorEvent);
    }

    handleMessage = (msg: MessageEvent)  => {
        const request = msg.data as AssetEditorRequest;

        switch (request.type) {
            case "create":
                this.initTilemapProject(request.files);
                const asset = this.getEmptyAsset(request.assetType);

                this.setState({
                    editing: asset,
                    isEmptyAsset: true
                });

                this.sendResponse({
                    id: request.id,
                    type: request.type
                });
                break;
            case "open":
                this.initTilemapProject(request.files);
                this.setState({
                    editing: this.lookupAsset(request.assetType, request.assetId)
                });
                this.sendResponse({
                    id: request.id,
                    type: request.type
                });
                break;
            case "duplicate":
                this.initTilemapProject(request.files);
                const existing = this.lookupAsset(request.assetType, request.assetId);
                this.setState({
                    editing: this.tilemapProject.duplicateAsset(existing)
                });
                this.sendResponse({
                    id: request.id,
                    type: request.type
                });
                break;
            case "save":
                this.sendResponse({
                    id: request.id,
                    type: request.type,
                    files: this.saveProjectFiles()
                });
                break;
        }
    }

    refHandler = (e: ImageFieldEditor<pxt.Asset>) => {
        if (!e) return;
        this.editor = e;
        this.editor.init(this.state.editing, () => {}, {
            galleryTiles: this.galleryTiles
        })
    }

    componentDidMount() {
        window.addEventListener("message", this.handleMessage, null);
        this.sendEvent({
            type: "event",
            kind: "ready"
        });
        tickAssetEditorEvent("asset-editor-shown");
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.handleMessage, null);
    }

    callbackOnDoneClick = () => {
        this.sendEvent({
            type: "event",
            kind: "done-clicked"
        })
    }

    render() {
        if (this.state.editing) {
            return <ImageFieldEditor
                ref={this.refHandler}
                singleFrame={this.state.editing.type !== "animation"}
                isMusicEditor={this.state.editing.type === "song"}
                doneButtonCallback={this.callbackOnDoneClick} />
        }

        return <div></div>
    }

    protected sendResponse(response: AssetEditorResponse) {
        this.postMessage(response);
    }

    protected sendEvent(event: AssetEditorEvent) {
        this.postMessage(event);
    }

    protected postMessage(message: any) {
        if ((window as any).acquireVsCodeApi) {
            (window as any).acquireVsCodeApi().postMessage(message)
        }
        else {
            window.parent.postMessage(message, "*");
        }
    }

    protected saveProjectFiles() {
        const currentValue = this.editor.getValue();
        if (this.state.isEmptyAsset) {
            const name = currentValue.meta?.displayName;
            let newAsset: pxt.Asset;
            switch (currentValue.type) {
                case pxt.AssetType.Image:
                    newAsset = this.tilemapProject.createNewProjectImage(currentValue.bitmap, name); break;
                case pxt.AssetType.Tile:
                    newAsset = this.tilemapProject.createNewTile(currentValue.bitmap, null, name); break;
                case pxt.AssetType.Tilemap:
                    const [newName, data] = this.tilemapProject.createNewTilemapFromData(currentValue.data, name);
                    newAsset = this.tilemapProject.lookupAssetByName(pxt.AssetType.Tilemap, newName);
                    break;
                case pxt.AssetType.Animation:
                    newAsset = this.tilemapProject.createNewAnimationFromData(currentValue.frames, currentValue.interval, name); break;
                case pxt.AssetType.Song:
                    newAsset = this.tilemapProject.createNewSong(currentValue.song, name); break;
            }

            this.setState({
                isEmptyAsset: false,
                editing: newAsset
            });
            this.editor.init(this.state.editing, () => {}, {
                galleryTiles: this.galleryTiles
            });
        }
        else {
            this.tilemapProject.updateAsset(currentValue);
        }

        const assetJRes = pxt.inflateJRes(this.tilemapProject.getProjectAssetsJRes());
        const tileJRes = pxt.inflateJRes(this.tilemapProject.getProjectTilesetJRes());

        const newFileJRes: pxt.Map<pxt.Map<pxt.JRes>> = {};

        for (const id of Object.keys(assetJRes)) {
            const filename = this.locateFileForAsset(id) || pxt.IMAGES_JRES;
            if (!newFileJRes[filename]) newFileJRes[filename] = {};

            newFileJRes[filename][id] = assetJRes[id];
        }

        for (const id of Object.keys(tileJRes)) {
            const filename = this.locateFileForAsset(id) || pxt.TILEMAP_JRES;
            if (!newFileJRes[filename]) newFileJRes[filename] = {};

            newFileJRes[filename][id] = tileJRes[id];
        }

        const outFiles = {
            ...this.files
        };

        for (const filename of Object.keys(newFileJRes)) {
            outFiles[filename] = JSON.stringify(newFileJRes[filename], null, 4);
            const generatedFile = filename.substring(0, filename.length - "jres".length) + "ts";
            if (outFiles[generatedFile] || filename === pxt.IMAGES_JRES || filename === pxt.TILEMAP_JRES) {
                outFiles[generatedFile] = pxt.emitProjectImages(newFileJRes[filename]) + "\n" + pxt.emitTilemapsFromJRes(newFileJRes[filename]);
            }
        }

        return outFiles;
    }

    protected initTilemapProject(files: pxt.Map<string>) {
        const projectTilemaps: pxt.Map<pxt.JRes> = {};
        const galleryTilemaps: pxt.Map<pxt.JRes> = {};
        const projectAssets: pxt.Map<pxt.JRes> = {};
        const galleryAssets: pxt.Map<pxt.JRes> = {};
        this.tilemapProject = new pxt.TilemapProject();
        this.inflatedJres = {};
        this.commentAttrs = {};

        for (const filename of Object.keys(files)) {
            if (!filename.endsWith(".jres")) {
                const comments = parseCommentAttrsFromTs(files[filename]);

                for (const id of Object.keys(comments)) {
                    this.commentAttrs[id] = comments[id];
                }
                continue;
            }

            const isGallery = filename.indexOf("pxt_modules") !== -1 || filename.indexOf("node_modules") !== -1;

            const inflated = pxt.inflateJRes(JSON.parse(files[filename]));
            this.inflatedJres[filename] = inflated;

            for (const id of Object.keys(inflated)) {
                if (inflated[id].mimeType === pxt.TILEMAP_MIME_TYPE || inflated[id].tilemapTile) {
                    if (isGallery) {
                        galleryTilemaps[id] = inflated[id];
                    }
                    else {
                        projectTilemaps[id] = inflated[id];
                    }
                }
                else {
                    if (isGallery) {
                        galleryAssets[id] = inflated[id];
                    }
                    else {
                        projectAssets[id] = inflated[id];
                    }
                }
            }
        }

        this.tilemapProject.loadAssetsJRes(galleryAssets, true);
        this.tilemapProject.loadAssetsJRes(projectAssets);
        this.tilemapProject.loadTilemapJRes(galleryTilemaps, false, true);
        this.tilemapProject.loadTilemapJRes(projectTilemaps);

        this.galleryTiles = this.tilemapProject.getGalleryAssets(pxt.AssetType.Tile)
            .map(tile => {
                const comments = this.commentAttrs[tile.id];
                if (!comments) return undefined;

                const splitTags = (comments.tags || "")
                    .split(" ")
                    .filter(el => !!el)
                    .map(tag => pxt.Util.startsWith(tag, "category-") ? tag : tag.toLowerCase());

                if (splitTags.indexOf("tile") === -1) return undefined;


                return {
                    qName: tile.id,
                    bitmap: tile.bitmap,
                    alt: tile.id,
                    tags: splitTags
                };
            })
            .filter(gt => !!gt)
    }

    protected locateFileForAsset(assetId: string) {
        for (const filename of Object.keys(this.inflatedJres)) {
            if (this.inflatedJres[filename][assetId]) return filename;
        }

        return undefined;
    }

    protected getEmptyAsset(type: pxt.AssetType): pxt.Asset {
        const project = pxt.react.getTilemapProject();
        const asset = { type, id: "", internalID: 0, meta: { displayName: pxt.getDefaultAssetDisplayName(type) } } as pxt.Asset;
        switch (type) {
            case pxt.AssetType.Image:
            case pxt.AssetType.Tile:
                (asset as pxt.ProjectImage).bitmap = new pxt.sprite.Bitmap(16, 16).data(); break
            case pxt.AssetType.Tilemap:
                const tilemap = asset as pxt.ProjectTilemap;
                tilemap.data = project.blankTilemap(16, 16, 16);
            case pxt.AssetType.Animation:
                const animation = asset as pxt.Animation;
                animation.frames = [new pxt.sprite.Bitmap(16, 16).data()];
                animation.interval = 200;
                break;
            case pxt.AssetType.Song:
                (asset as pxt.Song).song = pxt.assets.music.getEmptySong(2);
                break;

        }
        return asset;
    }

    protected lookupAsset(type: pxt.AssetType, id: string) {
        const res = this.tilemapProject.lookupAsset(type, id);

        if (res) return res;

        const idParts = id.split(".")

        return this.tilemapProject.lookupAsset(type, idParts[idParts.length - 1]);
    }
}

function tickAssetEditorEvent(event: string) {
    pxt.tickEvent("asset.editor", {
        action: event
    });
}

function parseCommentAttrsFromTs(contents: string) {
    const lines = contents.split("\n");
    const result: pxt.Map<pxtc.CommentAttrs> = {};

    let currentNamespace: string;
    let currentComments = "";

    for (const line of lines) {
        const namespaceMatch = /^namespace\s+([^\}]+)\s+\{$/.exec(line);
        if (namespaceMatch) {
            currentNamespace = namespaceMatch[1];
            currentComments = "";
            continue;
        }
        if (/^\s+\/\/%\s/.test(line)) {
            currentComments += line + "\n";
            continue;
        }

        const varMatch = /^\s*export\s+const\s+([^\s]+)\s*=/.exec(line);

        if (varMatch) {
            const id = currentNamespace + "." + varMatch[1];
            result[id] = pxtc.parseCommentString(currentComments);
            currentComments = "";
        }
    }
    return result;
}