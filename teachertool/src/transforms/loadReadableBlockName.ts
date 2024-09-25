import { getBlockAsText } from "../services/makecodeEditorService";
import { cacheBlockAsText, getCachedBlockAsText } from "../services/storageService";

export async function loadBlockAsText(blockId: string): Promise<pxt.editor.BlockAsText | undefined> {
    // Check for cached version.
    let readableBlockName = getCachedBlockAsText(blockId);
    if (readableBlockName) {
        return readableBlockName;
    }

    // Call into editor service & cache result
    readableBlockName = await getBlockAsText(blockId);
    if (readableBlockName) {
        cacheBlockAsText(blockId, readableBlockName);
    }

    return readableBlockName;
}
