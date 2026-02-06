/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../localtypings/pxteditor.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ImageFieldEditor } from "./components/ImageFieldEditor";
import { setTelemetryFunction } from './components/ImageEditor/store/imageReducer';
import { IFrameEmbeddedClient } from "../../pxtservices/iframeEmbeddedClient";


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

export class AssetEditor extends React.Component<{}, AssetEditorState> {
    private editor: ImageFieldEditor<pxt.Asset>;
    protected saveProject: pxt.TilemapProject;
    protected editorProject: pxt.TilemapProject;
    protected inflatedJres: pxt.Map<pxt.Map<pxt.JRes>>;
    protected commentAttrs: pxt.Map<pxtc.CommentAttrs>;
    protected files: pxt.Map<string>;
    protected galleryTiles: any[];
    protected lastValue: pxt.Asset;
    protected iframeClient: IFrameEmbeddedClient;

    constructor(props: {}) {
        super(props);
        this.state = {};
        pxt.react.getTilemapProject = () => this.editorProject;

        setTelemetryFunction(tickAssetEditorEvent);
    }

    handleMessage = (msg: MessageEvent) => {
        const request = msg.data as pxt.editor.AssetEditorRequest;

        switch (request.type) {
            case "create":
                this.setPalette(request.palette);
                this.initTilemapProject(request.files);
                const asset = this.getEmptyAsset(request.assetType, request.displayName);

                this.setState({
                    editing: asset,
                    isEmptyAsset: true
                });

                this.sendResponse({
                    id: request.id,
                    type: request.type,
                    success: true
                });
                break;
            case "open":
                this.setPalette(request.palette);
                this.initTilemapProject(request.files);
                const toOpen = this.lookupAsset(request.assetType, request.assetId);
                if (toOpen.type === pxt.AssetType.Tilemap) {
                    pxt.sprite.addMissingTilemapTilesAndReferences(this.editorProject, toOpen);
                }
                this.setState({
                    editing: toOpen
                });
                this.sendResponse({
                    id: request.id,
                    type: request.type,
                    success: true
                });
                break;
            case "duplicate":
                this.setPalette(request.palette);
                this.initTilemapProject(request.files);
                const existing = this.lookupAsset(request.assetType, request.assetId);
                this.setState({
                    editing: this.editorProject.duplicateAsset(existing)
                });
                this.sendResponse({
                    id: request.id,
                    type: request.type,
                    success: true,
                });
                break;
            case "save":
                this.sendResponse({
                    id: request.id,
                    type: request.type,
                    files: this.saveProjectFiles(),
                    success: true
                });
                break;
        }
    }

    refHandler = (e: ImageFieldEditor<pxt.Asset>) => {
        if (!e) return;
        this.editor = e;
        this.editor.init(this.state.editing, () => {}, {
            galleryTiles: this.galleryTiles,
            hideMyAssets: true,
            hideCloseButton: true
        })
    }

    handleKeydown = (e: KeyboardEvent) => {
        if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
            this.sendSaveRequest();
        }
    }

    pollingInterval: number;
    componentDidMount() {
        this.iframeClient = new IFrameEmbeddedClient(this.handleMessage);

        window.addEventListener("keydown", this.handleKeydown, null);
        this.sendEvent({
            type: "event",
            kind: "ready"
        });
        tickAssetEditorEvent("asset-editor-shown");
        this.pollingInterval = setInterval(this.pollForUpdates, 200);
        // TODO: one of these? Probably would need it to directly save
        // & send up message instead of sending a 'save now' type msg
        // window.addEventListener("unload", this.pollForUpdates)
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.handleMessage, null);
        window.removeEventListener("keydown", this.handleKeydown, null);
        window.clearInterval(this.pollingInterval);
    }

    pollForUpdates = () => {
        if (this.state.editing) this.updateAsset();
    }

    componentDidUpdate(prevProps: Readonly<{}>, prevState: Readonly<AssetEditorState>, snapshot?: any): void {
        if (!!prevState?.editing && prevState.editing !== this.state.editing) {
            this.saveProject.removeChangeListener(
                prevState.editing.type,
                this.sendSaveRequest
            );
        }
        if (this.state?.editing) {
            this.saveProject.addChangeListener(
                this.state.editing,
                this.sendSaveRequest
            );
        }
    }

    sendSaveRequest = () => {
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
                doneButtonCallback={this.sendSaveRequest}
                hideDoneButton={true}
                includeSpecialTagsInFilter={true}
            />
        }

        return <div></div>
    }

    protected sendResponse(response: pxt.editor.AssetEditorResponse) {
        this.postMessage(response);
    }

    protected sendEvent(event: pxt.editor.AssetEditorEvent) {
        this.postMessage(event);
    }

    protected postMessage(message: any) {
        this.iframeClient.postMessage(message);
    }

    protected updateAsset() {
        const editorAsset = this.editor.getValue();

        // We have to clone the asset so that we don't break the editor
        // by modifying it out from underneath it
        const currentValue = pxt.cloneAsset(editorAsset);
        if (this.lastValue && pxt.assetEquals(this.lastValue, currentValue)) {
            return;
        }
        this.lastValue = pxt.cloneAsset(editorAsset);

        // Clone asset doesn't clone the tilemap metadata. We need to update
        // all of the referenced tiles, so clone it here
        if (currentValue.type === pxt.AssetType.Tilemap && editorAsset.type === currentValue.type) {
            currentValue.data.deletedTiles = editorAsset.data.deletedTiles?.slice();
            currentValue.data.editedTiles = editorAsset.data.editedTiles?.slice();
            currentValue.data.projectReferences = editorAsset.data.projectReferences?.slice();
            currentValue.data.tileOrder = editorAsset.data.tileOrder?.slice();
        }

        // Create a clone of the tilemap project and update the asset. The clone
        // is mostly for tilemaps; they are actually several assets (the map + tiles)
        // and things can get weird if they are overwritten in the tilemap project
        // while still being edited in the tilemap editor
        this.saveProject = this.editorProject.clone();
        if (this.state.isEmptyAsset) {
            const name = currentValue.meta?.displayName;
            let newAsset: pxt.Asset;
            switch (currentValue.type) {
                case pxt.AssetType.Image:
                    newAsset = this.saveProject.createNewProjectImage(currentValue.bitmap, name);
                    break;
                case pxt.AssetType.Tile:
                    newAsset = this.saveProject.createNewTile(currentValue.bitmap, null, name);
                    break;
                case pxt.AssetType.Tilemap:
                    pxt.sprite.updateTilemapReferencesFromResult(this.saveProject, currentValue);
                    const [newName, data] = this.saveProject.createNewTilemapFromData(currentValue.data, name);
                    newAsset = this.saveProject.lookupAssetByName(pxt.AssetType.Tilemap, newName);
                    break;
                case pxt.AssetType.Animation:
                    newAsset = this.saveProject.createNewAnimationFromData(currentValue.frames, currentValue.interval, name);
                    break;
                case pxt.AssetType.Song:
                    newAsset = this.saveProject.createNewSong(currentValue.song, name);
                    break;
            }
        }
        else {
            if (currentValue.type === pxt.AssetType.Tilemap) {
                pxt.sprite.updateTilemapReferencesFromResult(this.saveProject, currentValue);
            }
            this.saveProject.updateAsset(currentValue);
        }

        this.sendSaveRequest();
    }

    protected saveProjectFiles() {
        this.updateAsset();

        const assetJRes = pxt.inflateJRes(this.saveProject.getProjectAssetsJRes());
        const tileJRes = pxt.inflateJRes(this.saveProject.getProjectTilesetJRes());

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

    protected setPalette(palette: string[]) {
        if (!palette || !Array.isArray(palette) || !palette.length) return;
        pxt.appTarget.runtime.palette = palette.slice();
    }

    protected initTilemapProject(files: pxt.Map<string>) {
        const projectTilemaps: pxt.Map<pxt.JRes> = {};
        const galleryTilemaps: pxt.Map<pxt.JRes> = {};
        const projectAssets: pxt.Map<pxt.JRes> = {};
        const galleryAssets: pxt.Map<pxt.JRes> = {};
        this.editorProject = new pxt.TilemapProject();
        this.inflatedJres = {};
        this.commentAttrs = {};

        for (const fileName of Object.keys(files).filter(file => !file.endsWith(".jres"))) {
            const comments = parseCommentAttrsFromTs(files[fileName]);

            for (const id of Object.keys(comments)) {
                this.commentAttrs[id] = comments[id];
            }
        }

        for (const filename of Object.keys(files).filter(file => file.endsWith(".jres"))) {
            const isGallery = filename.indexOf("pxt_modules") !== -1 || filename.indexOf("node_modules") !== -1;

            const inflated = pxt.inflateJRes(JSON.parse(files[filename]));
            this.inflatedJres[filename] = inflated;

            for (const id of Object.keys(inflated)) {
                if (this.commentAttrs[id]?.tags) {
                    const tags = this.commentAttrs[id].tags.split(" ").filter(el => !!el);
                    if (tags.length) {
                        inflated[id].tags = tags;
                    }
                }
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

        this.editorProject.loadAssetsJRes(galleryAssets, true);
        this.editorProject.loadAssetsJRes(projectAssets);
        this.editorProject.loadTilemapJRes(galleryTilemaps, false, true);
        this.editorProject.loadTilemapJRes(projectTilemaps);

        this.galleryTiles = this.editorProject.getGalleryAssets(pxt.AssetType.Tile)
            .map(tile => {
                const comments = this.commentAttrs[tile.id];
                if (!comments) return undefined;

                const splitTags = tile.meta.tags
                    ?.map(tag => pxt.Util.startsWith(tag, "category-") ? tag : tag.toLowerCase());

                if (!splitTags || splitTags.indexOf("tile") === -1) return undefined;


                return {
                    qName: tile.id,
                    bitmap: tile.bitmap,
                    alt: tile.id,
                    tags: splitTags
                };
            })
            .filter(gt => !!gt);

        this.saveProject = this.editorProject.clone();
    }

    protected locateFileForAsset(assetId: string) {
        for (const filename of Object.keys(this.inflatedJres)) {
            if (this.inflatedJres[filename][assetId]) return filename;
        }

        return undefined;
    }

    protected getEmptyAsset(type: pxt.AssetType, displayName?: string): pxt.Asset {
        const project = pxt.react.getTilemapProject();

        const newName = project.generateNewName(type, displayName);

        const asset = { type, id: "", internalID: 0, meta: { displayName: newName } } as pxt.Asset;
        switch (type) {
            case pxt.AssetType.Image:
            case pxt.AssetType.Tile:
                (asset as pxt.ProjectImage).bitmap = new pxt.sprite.Bitmap(16, 16).data(); break
            case pxt.AssetType.Tilemap:
                const tilemap = asset as pxt.ProjectTilemap;
                tilemap.data = project.blankTilemap(16, 16, 16);
                pxt.sprite.addMissingTilemapTilesAndReferences(project, tilemap);
                break;
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
        const res = this.saveProject.lookupAsset(type, id);

        if (res) return res;

        const idParts = id.split(".")

        return this.saveProject.lookupAsset(type, idParts[idParts.length - 1]);
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