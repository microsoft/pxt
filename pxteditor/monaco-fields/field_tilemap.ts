import { MonacoReactFieldEditor } from "./field_react";
import { registerMonacoFieldEditor } from "./monacoFieldEditor";

const fieldEditorId = "tilemap-editor";

export class MonacoTilemapEditor extends MonacoReactFieldEditor<pxt.ProjectTilemap> {
    protected isTilemapLiteral: boolean;
    protected tilemapLiteral: string;

    protected textToValue(text: string): pxt.ProjectTilemap {
        const tm = this.readTilemap(text);

        const project = pxt.react.getTilemapProject();
        pxt.sprite.addMissingTilemapTilesAndReferences(project, tm);

        return tm;
    }

    protected readTilemap(text: string): pxt.ProjectTilemap {
        const project = pxt.react.getTilemapProject();

        if (/^\s*tiles\s*\./.test(text)) {
            this.isTilemapLiteral = false;

            if (text) {
                try {
                    const data = pxt.sprite.decodeTilemap(text, "typescript", project);
                    return createFakeAsset(data);
                }
                catch (e) {
                    // If the user is still typing, they might try to open the editor on an incomplete tilemap
                }
                return null;
                }
        }

        this.isTilemapLiteral = true;

        // This matches the regex for the field editor, so it should always match
        const match = /^\s*(tilemap(?:4|8|16|32)?)\s*(?:`([^`]*)`)|(?:\(\s*"""([^"]*)"""\s*\))\s*$/.exec(text);
        const name = (match[2] || match[3] || "").trim();
        this.tilemapLiteral = match[1];

        let proj: pxt.ProjectTilemap;
        let id: string;

        if (name) {
            id = ts.pxtc.escapeIdentifier(name)
            proj = project.getTilemap(id) || project.lookupAssetByName(pxt.AssetType.Tilemap, name);
        }

        if (!proj) {
            let tileWidth = 16;
            if (this.tilemapLiteral === "tilemap8") {
                tileWidth = 8;
            }
            else if (this.tilemapLiteral === "tilemap32") {
                tileWidth = 32;
            }
            else if (this.tilemapLiteral === "tilemap4") {
                tileWidth = 4;
            }
            const [ name ] = project.createNewTilemap(id, tileWidth, 16, 16);
            proj = project.getTilemap(name);
            id = name;
        }

        return proj;
    }

    protected resultToText(asset: pxt.ProjectTilemap): string {
        const project = pxt.react.getTilemapProject();
        project.pushUndo();

        pxt.sprite.updateTilemapReferencesFromResult(project, asset);

        if (this.isTilemapLiteral) {
            project.updateAsset(asset);
            return pxt.getTSReferenceForAsset(asset, this.fileType === "python");
        }
        else {
            return pxt.sprite.encodeTilemap(asset.data, this.fileType === "typescript" ? "typescript" : "python");
        }
    }

    protected getFieldEditorId() {
        return "tilemap-editor";
    }
    protected getOptions(): any {
        return {
            initWidth: 16,
            initHeight: 16,
            blocksInfo: this.host.blocksInfo()
        };
    }

    protected getCreateTilemapRange() {
        const start = this.editrange.getStartPosition();
        let current = this.editrange.getEndPosition();
        let range: monaco.Range;

        let openParen = 1;

        while (true) {
            range = new monaco.Range(current.lineNumber, current.column, current.lineNumber + 1, 0);
            const line = this.host.getText(range);

            for (let i = 0; i < line.length; i++) {
                if (line.charAt(i) === "(") {
                    openParen++;
                }
                else if (line.charAt(i) === ")") {
                    openParen--;

                    if (openParen === 0) {
                        const end = new monaco.Position(current.lineNumber, current.column + i + 2);

                        return monaco.Range.fromPositions(start, end);
                    }
                }
            }

            current = range.getEndPosition();

            if (current.lineNumber > start.lineNumber + 20) {
                return null;
            }
        }
    }
}

function createFakeAsset(data: pxt.sprite.TilemapData): pxt.ProjectTilemap {
    return {
        type: pxt.AssetType.Tilemap,
        id: "",
        internalID: 0,
        meta: {},
        data
    }
}

export const tilemapEditorDefinition: pxt.editor.MonacoFieldEditorDefinition = {
    id: fieldEditorId,
    foldMatches: true,
    alwaysBuildOnClose: true,
    glyphCssClass: "sprite-focus-hover ms-Icon ms-Icon--Nav2DMapView",
    heightInPixels: 510,
    weight: 5,
    matcher: {
        // match both JS and python
        searchString: "(?:tilemap(?:8|16|32)?\\s*(?:`|\\(\"\"\")(?:[ a-zA-Z0-9_]|\\n)*\\s*(?:`|\"\"\"\\)))|(?:tiles\\s*\\.\\s*createTilemap\\s*\\([^\\)]+\\))",
        isRegex: true,
        matchCase: true,
        matchWholeWord: false
    },
    proto: MonacoTilemapEditor
};

registerMonacoFieldEditor(fieldEditorId, tilemapEditorDefinition);