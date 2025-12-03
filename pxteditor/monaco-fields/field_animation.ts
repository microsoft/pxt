import { MonacoReactFieldEditor } from "./field_react";
import { registerMonacoFieldEditor } from "./monacoFieldEditor";

const fieldEditorId = "animation-editor";

export class MonacoAnimationEditor extends MonacoReactFieldEditor<pxt.Animation> {
    protected isPython: boolean;
    protected editing: pxt.Asset;

    protected textToValue(text: string): pxt.Animation {
        this.isPython = text.indexOf("`") === -1

        const match = pxt.parseAssetTSReference(text);
        if (match) {
            const { name: matchedName } = match;
            const name = matchedName.trim();
            const project = pxt.react.getTilemapProject();
            const asset = project.lookupAssetByName(pxt.AssetType.Animation, name);
            if (asset) {
                this.editing = asset;
                return asset;
            }
            else {
                const newAsset = project.createNewAnimation();

                if (name && !project.isNameTaken(pxt.AssetType.Animation, name) && pxt.validateAssetName(name)) {
                    newAsset.meta.displayName = name;
                }
                else {
                    newAsset.meta.displayName = project.generateNewName(pxt.AssetType.Animation);
                }

                this.editing = newAsset;

                return newAsset;
            }
        }

        return undefined;
    }

    protected resultToText(result: pxt.Animation): string {
        const project = pxt.react.getTilemapProject();
        project.pushUndo();
        result = pxt.patchTemporaryAsset(this.editing, result, project) as pxt.Animation;
        result = project.updateAsset(result)
        return pxt.getTSReferenceForAsset(result, this.isPython);
    }

    protected getFieldEditorId() {
        return fieldEditorId;
    }
    protected getOptions(): any {
        return {
            initWidth: 16,
            initHeight: 16,
            blocksInfo: this.host.blocksInfo()
        };
    }
}


const regexes = [
    // typescript
    "assets\\s*\\.\\s*animation\\s*`[a-zA-Z_\\s\\n]*`",

    // python
    'assets\\s*\\.\\s*animation\\s*\\(\\s*"""[a-zA-Z_\\s\\n]*"""\\s*\\)'
];

const searchString = regexes.map(r => `(?:${r})`).join("|");

export const animationEditorDefinition: pxt.editor.MonacoFieldEditorDefinition = {
    id: fieldEditorId,
    foldMatches: true,
    glyphCssClass: "sprite-editor-glyph sprite-focus-hover",
    heightInPixels: 510,
    matcher: {
        searchString: searchString,
        isRegex: true,
        matchCase: true,
        matchWholeWord: false
    },
    proto: MonacoAnimationEditor
};

registerMonacoFieldEditor(fieldEditorId, animationEditorDefinition);