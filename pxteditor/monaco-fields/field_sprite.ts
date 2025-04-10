import { MonacoReactFieldEditor } from "./field_react";
import { registerMonacoFieldEditor } from "./monacoFieldEditor";

const fieldEditorId = "image-editor";

export class MonacoSpriteEditor extends MonacoReactFieldEditor<pxt.ProjectImage> {
    protected isPython: boolean;
    protected isAsset: boolean;
    protected template: string;

    protected textToValue(text: string): pxt.ProjectImage {
        this.isPython = text.indexOf("`") === -1
        this.template = text.startsWith("bmp") ? "bmp" : "img"

        const match = pxt.parseAssetTSReference(text);
        if (match) {
            const { type, name: matchedName } = match;
            const name = matchedName.trim();
            const project = pxt.react.getTilemapProject();
            this.isAsset = true;
            const asset = project.lookupAssetByName(pxt.AssetType.Image, name);
            if (asset) {
                return asset;
            }
            else {
                const newAsset = project.createNewImage();

                if (name && !project.isNameTaken(pxt.AssetType.Image, name) && pxt.validateAssetName(name)) {
                    newAsset.meta.displayName = name;
                }

                return newAsset;
            }
        }

        return createFakeAsset(pxt.sprite.imageLiteralToBitmap(text, this.template));
    }

    protected resultToText(result: pxt.ProjectImage): string {
        if (result.meta?.displayName) {
            const project = pxt.react.getTilemapProject();
            if (this.isAsset || project.lookupAsset(result.type, result.id)) {
                result = project.updateAsset(result)
            } else {
                result = project.createNewProjectImage(result.bitmap, result.meta.displayName);
            }
            this.isAsset = true;
            return pxt.getTSReferenceForAsset(result, this.isPython);
        }
        return pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(result.bitmap),
            this.isPython ? "python" : "typescript",
            this.template
        )
    }

    protected getFieldEditorId() {
        return "image-editor";
    }
    protected getOptions(): any {
        return {
            initWidth: 16,
            initHeight: 16,
            blocksInfo: this.host.blocksInfo()
        };
    }
}

function createFakeAsset(bitmap: pxt.sprite.Bitmap): pxt.ProjectImage {
    return {
        type: pxt.AssetType.Image,
        id: "",
        internalID: 0,
        bitmap: bitmap.data(),
        meta: {},
        jresData: ""
    }
}

export const spriteEditorDefinition: pxt.editor.MonacoFieldEditorDefinition = {
    id: fieldEditorId,
    foldMatches: true,
    glyphCssClass: "sprite-editor-glyph sprite-focus-hover",
    heightInPixels: 510,
    matcher: {
        // match both JS and python
        searchString: "(?:img|bmp|assets\\s*\\.\\s*image)\\s*(?:`|\\(\\s*\"\"\")(?:(?:[^(){}:\\[\\]\"';?/,+\\-=*&|^%!`~]|\\n)*)\\s*(?:`|\"\"\"\\s*\\))",
        isRegex: true,
        matchCase: true,
        matchWholeWord: false
    },
    proto: MonacoSpriteEditor
};

registerMonacoFieldEditor(fieldEditorId, spriteEditorDefinition);