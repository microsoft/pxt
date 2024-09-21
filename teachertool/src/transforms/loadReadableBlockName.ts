import { getBlockTextParts } from "../services/makecodeEditorService";
import { cacheBlockTextParts, getCachedBlockTextParts } from "../services/storageService";

export async function loadBlockTextParts(blockId: string): Promise<pxt.editor.BlockTextParts | undefined> {
    // Check for cached version.
    let readableBlockName = getCachedBlockTextParts(blockId);
    if (readableBlockName) {
        // TODO thsparks : Uncomment after testing and verify this works.
        // return Promise.resolve(readableBlockName);
    }

    // Call into editor service & cache result
    readableBlockName = await getBlockTextParts(blockId);
    if (readableBlockName) {
        // TODO thsparks : Uncomment after testing and verify this works.
        // cacheBlockTextParts(blockId, readableBlockName);
    }

    return readableBlockName;
}
