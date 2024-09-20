import { getReadableBlockName } from "../services/makecodeEditorService";
import { cacheReadableBlockName, getCachedReadableBlockName } from "../services/storageService";

export async function loadReadableBlockName(blockId: string): Promise<pxt.editor.ReadableBlockName | undefined> {
    // Check for cached version.
    let readableBlockName = getCachedReadableBlockName(blockId);
    if (readableBlockName) {
        return Promise.resolve(readableBlockName);
    }

    // Call into editor service
    readableBlockName = await getReadableBlockName(blockId);
    if (readableBlockName) {
        // Cache the result
        cacheReadableBlockName(blockId, readableBlockName);
    }

    return readableBlockName;
}
