import * as Blockly from "blockly";
import { FieldTilemap } from "./field_tilemap";
import { FieldAnimationEditor } from "./field_animation";
import { FieldMusicEditor } from "./field_musiceditor";
import { FieldSpriteEditor } from "./field_sprite";
import { FieldTileset } from "./field_tileset";

export interface FieldCustom {
    isFieldCustom_: boolean;
    saveOptions?(): pxt.Map<string | number | boolean>;
    restoreOptions?(map: pxt.Map<string | number | boolean>): void;

    /**
     * Returns a human-readable description of the field's current value.
     */
    getFieldDescription(): string;
}

export interface FieldCustomOptions {
    blocksInfo: any;
    colour?: string | number;
    label?: string;
    type?: string;
}

export interface FieldCustomDropdownOptions extends FieldCustomOptions {
    data?: any;
}

export interface FieldCustomConstructor {
    new(text: string, options: FieldCustomOptions, validator?: Function): FieldCustom & Blockly.Field;
}

// Parsed format of data stored in the .data attribute of blocks
export interface PXTBlockData {
    commentRefs: string[];
    fieldData: pxt.Map<string>;
}

export interface AssetSaveState {
    version: number;
    assetType: pxt.AssetType;
    jres: pxt.Map<pxt.JRes>;
    assetId: string;
}


export namespace svg {
    export function hasClass(el: SVGElement, cls: string): boolean {
        return pxt.BrowserUtils.containsClass(el, cls);
    }

    export function addClass(el: SVGElement, cls: string) {
        pxt.BrowserUtils.addClass(el, cls);
    }

    export function removeClass(el: SVGElement, cls: string) {
        pxt.BrowserUtils.removeClass(el, cls);
    }
}

export function parseColour(colour: string | number): string {
    const hue = Number(colour);
    if (!isNaN(hue)) {
        return Blockly.utils.colour.hueToHex(hue);
    } else if (typeof colour === "string" && colour.match(/^#[0-9a-fA-F]{6}$/)) {
        return colour as string;
    } else {
        return '#000';
    }
}

/**
 * Converts a bitmap into a square image suitable for display. In light mode the preview
 * is drawn with no transparency (alpha is filled with background color)
 */
export function bitmapToImageURI(frame: pxt.sprite.Bitmap, sideLength: number, lightMode: boolean) {
    const colors = pxt.appTarget.runtime.palette.slice(1);
    const canvas = document.createElement("canvas");
    canvas.width = sideLength;
    canvas.height = sideLength;

    // Works well for all of our default sizes, does not work well if the size is not
    // a multiple of 2 or is greater than 32 (i.e. from the decompiler)
    const cellSize = Math.min(sideLength / frame.width, sideLength / frame.height);

    // Center the image if it isn't square
    const xOffset = Math.max(Math.floor((sideLength * (1 - (frame.width / frame.height))) / 2), 0);
    const yOffset = Math.max(Math.floor((sideLength * (1 - (frame.height / frame.width))) / 2), 0);

    let context: CanvasRenderingContext2D;
    if (lightMode) {
        context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#dedede";
        context.fillRect(0, 0, sideLength, sideLength);
    }
    else {
        context = canvas.getContext("2d");
    }

    for (let c = 0; c < frame.width; c++) {
        for (let r = 0; r < frame.height; r++) {
            const color = frame.get(c, r);

            if (color) {
                context.fillStyle = colors[color - 1];
                context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
            }
            else if (lightMode) {
                context.fillStyle = "#dedede";
                context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
            }
        }
    }

    return canvas.toDataURL();
}

export function tilemapToImageURI(data: pxt.sprite.TilemapData, sideLength: number, lightMode: boolean) {
    const colors = pxt.appTarget.runtime.palette.slice();
    const canvas = document.createElement("canvas");
    canvas.width = sideLength;
    canvas.height = sideLength;

    // Works well for all of our default sizes, does not work well if the size is not
    // a multiple of 2 or is greater than 32 (i.e. from the decompiler)
    const cellSize = Math.min(sideLength / data.tilemap.width, sideLength / data.tilemap.height);

    // Center the image if it isn't square
    const xOffset = Math.max(Math.floor((sideLength * (1 - (data.tilemap.width / data.tilemap.height))) / 2), 0);
    const yOffset = Math.max(Math.floor((sideLength * (1 - (data.tilemap.height / data.tilemap.width))) / 2), 0);

    let context: CanvasRenderingContext2D;
    if (lightMode) {
        context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#dedede";
        context.fillRect(0, 0, sideLength, sideLength);
    }
    else {
        context = canvas.getContext("2d");
    }

    let tileColors: string[] = [];

    for (let c = 0; c < data.tilemap.width; c++) {
        for (let r = 0; r < data.tilemap.height; r++) {
            const tile = data.tilemap.get(c, r);

            if (tile) {
                if (!tileColors[tile]) {
                    const tileInfo = data.tileset.tiles[tile];
                    tileColors[tile] = tileInfo ? pxt.sprite.computeAverageColor(pxt.sprite.Bitmap.fromData(tileInfo.bitmap), colors) : "#dedede";
                }

                context.fillStyle = tileColors[tile];
                context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
            }
            else if (lightMode) {
                context.fillStyle = "#dedede";
                context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
            }
        }
    }

    return canvas.toDataURL();
}

export function songToDataURI(song: pxt.assets.music.Song, width: number, height: number, lightMode: boolean, maxMeasures?: number) {
    const colors = pxt.appTarget.runtime.palette.slice();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    let context: CanvasRenderingContext2D;
    if (lightMode) {
        context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#dedede";
        context.fillRect(0, 0, width, height);
    }
    else {
        context = canvas.getContext("2d");
    }

    const trackColors = [
        5,  // duck
        11, // cat
        5,  // dog
        4,  // fish
        2,  // car
        6,  // computer
        14, // burger
        2,  // cherry
        5,  // lemon
        1,  // explosion
    ]

    maxMeasures = maxMeasures || song.measures;

    const cellWidth = Math.max(Math.floor(width / (song.beatsPerMeasure * maxMeasures * 2)), 1);
    const cellsShown = Math.floor(width / cellWidth);

    const cellHeight = Math.max(Math.floor(height / 12), 1);
    const notesShown = Math.floor(height / cellHeight);

    for (const track of song.tracks) {
        for (const noteEvent of track.notes) {
            const col = Math.floor(noteEvent.startTick / (song.ticksPerBeat / 2));
            if (col > cellsShown) break;

            for (const note of noteEvent.notes) {
                const row = 12 - (note.note % 12);
                if (row > notesShown) continue;

                context.fillStyle = colors[trackColors[track.id || song.tracks.indexOf(track)]];
                context.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
            }
        }
    }

    return canvas.toDataURL();
}

export interface FieldEditorReference<U extends Blockly.Field> {
    block: Blockly.Block;
    field: string;
    ref: U;
    parsed?: pxt.sprite.TilemapData;
}

export function getAllBlocksWithTilemaps(ws: Blockly.Workspace): FieldEditorReference<FieldTilemap>[] {
    return getAllFields(ws, f => f instanceof FieldTilemap && !f.isGreyBlock);
}

export function getAllBlocksWithTilesets(ws: Blockly.Workspace): FieldEditorReference<FieldTileset>[] {
    return getAllFields(ws, f => f instanceof FieldTileset);
}

export function needsTilemapUpgrade(ws: Blockly.Workspace) {
    const allTiles = ws.getVariableMap()
        .getVariablesOfType(pxt.sprite.BLOCKLY_TILESET_TYPE)
        .map(model => pxt.sprite.legacy.blocklyVariableToTile(model.getName()));
    return !!allTiles.length;
}

export function updateTilemapXml(dom: Element, proj: pxt.TilemapProject) {
    let needsUpgrade = false;

    const upgradedTileMapping: pxt.Map<pxt.Tile> = {};

    for (const element of dom.children) {
        if (element.tagName.toLowerCase() === "variables") {
            const toRemove: Element[] = [];

            for (const variable of element.children) {
                if (variable.getAttribute("type") === pxt.sprite.BLOCKLY_TILESET_TYPE) {
                    needsUpgrade = true;
                    const varName = variable.textContent;
                    const parsed = pxt.sprite.legacy.blocklyVariableToTile(varName);
                    if (!parsed.qualifiedName) {
                        const oldId = "myTiles.tile" + parsed.projectId;
                        const newTile = proj.createNewTile(parsed.data, oldId);
                        upgradedTileMapping[oldId] = newTile
                    }
                    toRemove.push(variable);
                }
            }

            for (const variable of toRemove) {
                variable.remove();
            }
        }
    }

    if (!needsUpgrade) return;

    for (const field of dom.getElementsByTagName("field")) {
        const value = field.textContent;

        const trimmed = value.trim();
        if (upgradedTileMapping[trimmed]) {
            field.textContent = pxt.getTSReferenceForAsset(upgradedTileMapping[trimmed]);
        }
        else if (trimmed.startsWith(`tiles.createTilemap(`)) {
            const legacy = pxt.sprite.legacy.decodeTilemap(value, "typescript");

            const mapping: pxt.Tile[] = [];

            const newData = new pxt.sprite.TilemapData(
                legacy.tilemap, {
                tileWidth: legacy.tileset.tileWidth,
                tiles: legacy.tileset.tiles.map((t, index) => {
                    if (t.projectId != null) {
                        return upgradedTileMapping["myTiles.tile" + t.projectId];
                    }
                    if (!mapping[index]) {
                        mapping[index] = proj.resolveTile(t.qualifiedName)
                    }

                    return mapping[index];
                })
            },
                legacy.layers
            );

            const [id] = proj.createNewTilemapFromData(newData);
            const asset = proj.lookupAsset(pxt.AssetType.Tilemap, id);

            field.textContent = pxt.getTSReferenceForAsset(asset);
        }
    }
}

export function getAllFields<U extends Blockly.Field>(ws: Blockly.Workspace, predicate: (field: Blockly.Field) => boolean): FieldEditorReference<U>[] {
    const result: FieldEditorReference<U>[] = [];

    const top = ws.getTopBlocks(false);
    top.forEach(block => getAllFieldsRecursive(block));

    return result;

    function getAllFieldsRecursive(block: Blockly.Block) {
        for (const input of block.inputList) {
            for (const field of input.fieldRow) {
                if (predicate(field)) {
                    result.push({ block, field: field.name, ref: (field as U) });
                }
            }

            if (input.connection && input.connection.targetBlock()) {
                getAllFieldsRecursive(input.connection.targetBlock());
            }
        }

        if (block.nextConnection && block.nextConnection.targetBlock()) {
            getAllFieldsRecursive(block.nextConnection.targetBlock());
        }
    }
}

export function getAllReferencedTiles(workspace: Blockly.Workspace, excludeBlockID?: string) {
    let all: pxt.Map<pxt.Tile> = {};

    const allMaps = getAllBlocksWithTilemaps(workspace);
    const project = pxt.react.getTilemapProject();

    for (const map of allMaps) {
        if (map.block.id === excludeBlockID) continue;

        for (const tile of map.ref.getTileset()?.tiles || []) {
            all[tile.id] = project.lookupAsset(pxt.AssetType.Tile, tile.id);
        }
    }

    const projectMaps = project.getAssets(pxt.AssetType.Tilemap);

    for (const projectMap of projectMaps) {
        for (const tile of projectMap.data.tileset.tiles) {
            all[tile.id] = project.lookupAsset(pxt.AssetType.Tile, tile.id);
        }
    }

    const allTiles = getAllBlocksWithTilesets(workspace);
    for (const tilesetField of allTiles) {
        const value = tilesetField.ref.getValue();
        const match = /^\s*assets\s*\.\s*tile\s*`([^`]*)`\s*$/.exec(value);

        if (match) {
            const tile = project.lookupAssetByName(pxt.AssetType.Tile, match[1]);

            if (tile && !all[tile.id]) {
                all[tile.id] = tile;
            }
        }
        else if (!all[value]) {
            all[value] = project.resolveTile(value);
        }
    }

    return Object.keys(all).map(key => all[key]).filter(t => !!t);
}

export function getTilesReferencedByTilesets(workspace: Blockly.Workspace) {
    let all: pxt.Map<pxt.Tile> = {};

    const project = pxt.react.getTilemapProject();

    const allTiles = getAllBlocksWithTilesets(workspace);
    for (const tilesetField of allTiles) {
        const value = tilesetField.ref.getValue();
        const match = /^\s*assets\s*\.\s*tile\s*`([^`]*)`\s*$/.exec(value);

        if (match) {
            const tile = project.lookupAssetByName(pxt.AssetType.Tile, match[1]);

            if (tile && !all[tile.id]) {
                all[tile.id] = tile;
            }
        }
        else if (!all[value]) {
            all[value] = project.resolveTile(value);
        }
    }

    return Object.keys(all).map(key => all[key]).filter(t => !!t);
}

export function getTemporaryAssets(workspace: Blockly.Workspace, type: pxt.AssetType): pxt.Asset[] {
    switch (type) {
        case pxt.AssetType.Image:
            return getAllFields(workspace, field => field instanceof FieldSpriteEditor && field.isTemporaryAsset())
                .map(f => (f.ref as unknown as FieldSpriteEditor).getAsset());
        case pxt.AssetType.Animation:
            return getAllFields(workspace, field => field instanceof FieldAnimationEditor && field.isTemporaryAsset())
                .map(f => (f.ref as unknown as FieldAnimationEditor).getAsset());
        case pxt.AssetType.Song:
            return getAllFields(workspace, field => field instanceof FieldMusicEditor && field.isTemporaryAsset())
                .map(f => (f.ref as unknown as FieldMusicEditor).getAsset());

        default: return [];
    }
}

export function getAssetSaveState(asset: pxt.Asset) {
    const serialized: AssetSaveState = {
        version: 1,
        assetType: asset.type,
        assetId: asset.id,
        jres: {}
    };

    const project = pxt.react.getTilemapProject();
    if (asset.type === pxt.AssetType.Tilemap) {
        const jres = project.getProjectTilesetJRes();

        for (const key of Object.keys(jres)) {
            if (key === "*") continue;
            const entry = jres[key];
            if (entry.mimeType === pxt.TILEMAP_MIME_TYPE) {
                if (entry.id !== asset.id) {
                    delete jres[key];
                }
            }
            else {
                const id = addDotToNamespace(jres["*"].namespace) + key;

                if (!asset.data.tileset.tiles.some(tile => tile.id === id)) {
                    delete jres[key];
                }
            }
        }

        serialized.jres = jres;
    }
    else {
        const jres = asset.type === pxt.AssetType.Tile ?
            project.getProjectTilesetJRes() :
            project.getProjectAssetsJRes();

        serialized.jres["*"] = jres["*"];
        const [key, entry] = findEntryInJres(jres, asset.id);
        serialized.jres[key] = entry;
    }

    return serialized;
}


export function loadAssetFromSaveState(serialized: AssetSaveState) {
    let newId = serialized.assetId;
    serialized.jres = inflateJRes(serialized.jres);

    const globalProject = pxt.react.getTilemapProject();
    const existing = globalProject.lookupAsset(serialized.assetType, serialized.assetId);

    // if this id is already in the project, we need to check to see
    // if it's the same as what we're loading. if it isn't, we'll need
    // to create new assets
    if (existing) {
        // load the jres into a throwaway project so that we don't pollute
        // the actual one
        const tempProject = new pxt.TilemapProject();

        // if this is a tilemap, we need the gallery populated in case
        // there are gallery tiles in the tileset
        tempProject.loadGallerySnapshot(globalProject.saveGallerySnapshot());

        if (serialized.assetType === "tilemap" || serialized.assetType === "tile") {
            tempProject.loadTilemapJRes(serialized.jres);
        }
        else {
            tempProject.loadAssetsJRes(serialized.jres);
        }

        const tempAsset = tempProject.lookupAsset(serialized.assetType, serialized.assetId);

        if (pxt.assetEquals(tempAsset, existing, true)) {
            return existing;
        }
        else {
            // the asset ids collided! first try to find another asset in the
            // project that has the same value. for example, if the same code
            // is copy/pasted multiple times then we will have already created
            // a new asset for this code
            const valueMatch = globalProject.lookupAssetByValue(tempAsset.type, tempAsset);

            if (valueMatch) {
                return valueMatch;
            }

            // no existing asset, so remap the id in the jres before loading
            // it in the project. in the case of a tilemap, we only need to
            // remap the tilemap id because loadTilemapJRes automatically remaps
            // tile ids and resolves duplicates
            newId = globalProject.generateNewID(serialized.assetType);

            const [key, entry] = findEntryInJres(serialized.jres, serialized.assetId);
            delete serialized.jres[key];

            if (serialized.assetType === "tilemap") {
                // tilemap ids don't have namespaces
                entry.id = newId;
                serialized.jres[newId] = entry;
            }
            else {
                const [namespace, key] = newId.split(".");
                if (addDotToNamespace(namespace) !== addDotToNamespace(serialized.jres["*"].namespace)) {
                    entry.namespace = addDotToNamespace(namespace);
                }
                entry.id = newId;
                serialized.jres[key] = entry;
            }
        }
    }


    if (serialized.assetType === "tilemap" || serialized.assetType === "tile") {
        globalProject.loadTilemapJRes(serialized.jres, true);
    }
    else {
        globalProject.loadAssetsJRes(serialized.jres);
    }

    return globalProject.lookupAsset(serialized.assetType, newId);
}

export const FIELD_EDITOR_OPEN_EVENT_TYPE = "field_editor_open";

export class FieldEditorOpenEvent extends Blockly.Events.UiBase {
    override type = FIELD_EDITOR_OPEN_EVENT_TYPE;

    blockId: string;
    isOpen: boolean;

    constructor(block: Blockly.Block, isOpen: boolean) {
        super(block.workspace.id);
        this.blockId = block.id;
        this.isOpen = isOpen;
    }
}

export function setMelodyEditorOpen(block: Blockly.Block, isOpen: boolean) {
    Blockly.Events.fire(new FieldEditorOpenEvent(block, isOpen));
}


export function workspaceToScreenCoordinates(ws: Blockly.WorkspaceSvg, wsCoordinates: Blockly.utils.Coordinate) {
    // The position in pixels relative to the origin of the
    // main workspace.
    const scaledWS = wsCoordinates.scale(ws.scale);

    // The offset in pixels between the main workspace's origin and the upper
    // left corner of the injection div.
    const mainOffsetPixels = ws.getOriginOffsetInPixels();

    // The client coordinates offset by the injection div's upper left corner.
    const clientOffsetPixels = Blockly.utils.Coordinate.sum(
        scaledWS, mainOffsetPixels);


    const injectionDiv = ws.getInjectionDiv();

    // Bounding rect coordinates are in client coordinates, meaning that they
    // are in pixels relative to the upper left corner of the visible browser
    // window.  These coordinates change when you scroll the browser window.
    const boundingRect = injectionDiv.getBoundingClientRect();

    return new Blockly.utils.Coordinate(clientOffsetPixels.x + boundingRect.left,
        clientOffsetPixels.y + boundingRect.top)
}

export function getBlockData(block: Blockly.Block): PXTBlockData {
    if (!block.data) {
        return {
            commentRefs: [],
            fieldData: {}
        };
    }
    if (/^(?:\d+;?)+$/.test(block.data)) {
        return {
            commentRefs: block.data.split(";"),
            fieldData: {}
        }
    }
    return JSON.parse(block.data);
}

export function setBlockData(block: Blockly.Block, data: PXTBlockData) {
    block.data = JSON.stringify(data);
}

export function setBlockDataForField(block: Blockly.Block, field: string, data: string) {
    const blockData = getBlockData(block);
    blockData.fieldData[field] = data;
    setBlockData(block, blockData);
}

export function getBlockDataForField(block: Blockly.Block, field: string) {
    return getBlockData(block).fieldData[field];
}

export function deleteBlockDataForField(block: Blockly.Block, field: string) {
    const blockData = getBlockData(block);
    delete blockData.fieldData[field];
    setBlockData(block, blockData);
}

function addDotToNamespace(namespace: string) {
    if (namespace.endsWith(".")) {
        return namespace;
    }
    return namespace + ".";
}

function findEntryInJres(jres: pxt.Map<any>, assetId: string): [string, any] {
    const defaultNamespace = jres["*"].namespace;

    for (const key of Object.keys(jres)) {
        if (key === "*") continue;

        const entry = jres[key];
        let id: string;

        if (entry.id) {
            if (entry.namespace) {
                id = addDotToNamespace(entry.namespace) + entry.id;
            }
            else {
                id = entry.id;
            }
        }
        else if (entry.namespace) {
            id = addDotToNamespace(entry.namespace) + key;
        }
        else {
            id = addDotToNamespace(defaultNamespace) + key;
        }

        if (id === assetId) {
            return [key, jres[key]];
        }
    }

    // should never happen
    return undefined;
}

// simply replaces the string entries with objects; doesn't do a full inflate like pxt.inflateJRes
function inflateJRes(jres: pxt.Map<pxt.JRes | string>): pxt.Map<pxt.JRes> {
    const meta = jres["*"] as pxt.JRes;
    const result: pxt.Map<pxt.JRes> = {
        "*": meta
    };

    for (const key of Object.keys(jres)) {
        if (key === "*") continue;

        const entry = jres[key];
        if (typeof entry === "string") {
            result[key] = {
                id: undefined,
                data: entry,
                mimeType: meta.mimeType
            }
        }
        else {
            result[key] = entry;
        }
    }

    return result;
}

export function clearDropDownDiv() {
    Blockly.DropDownDiv.clearContent();
    Blockly.DropDownDiv.getContentDiv().style.height = "";
}