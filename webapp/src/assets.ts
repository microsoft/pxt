import * as pkg from "./package";
import * as compiler from "./compiler";

export function validateAssetName(name: string) {
    if (!name) return false;

    let nameIsValid = false;
    if (pxtc.isIdentifierStart(name.charCodeAt(0), 2)) {
        nameIsValid = true;
        for (let i = 1; i < name.length; i++) {
            if (!pxtc.isIdentifierPart(name.charCodeAt(i), 2)) {
                nameIsValid = false;
            }
        }
    }

    return nameIsValid;
}

export function isNameTaken(name: string) {
    return pkg.mainEditorPkg().tilemapProject.isNameTaken(name);
}