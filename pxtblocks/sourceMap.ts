export function findBlockIdByPosition(sourceMap: pxt.blocks.BlockSourceInterval[], loc: { start: number; length: number; }): string {
    if (!loc) return undefined;
    let bestChunk: pxt.blocks.BlockSourceInterval;
    let bestChunkLength: number;
    // look for smallest chunk containing the block
    for (let i = 0; i < sourceMap.length; ++i) {
        let chunk = sourceMap[i];
        if (chunk.startPos <= loc.start
                && chunk.endPos >= loc.start + loc.length
                && (!bestChunk || bestChunkLength > chunk.endPos - chunk.startPos)) {
            bestChunk = chunk;
            bestChunkLength = chunk.endPos - chunk.startPos;
        }
    }
    if (bestChunk) {
        return bestChunk.id;
    }
    return undefined;
}

export function findBlockIdByLine(sourceMap: pxt.blocks.BlockSourceInterval[], loc: { start: number; length: number; }): string {
    if (!loc) return undefined;
    let bestChunk: pxt.blocks.BlockSourceInterval;
    let bestChunkLength: number;
    // look for smallest chunk containing the block
    for (let i = 0; i < sourceMap.length; ++i) {
        let chunk = sourceMap[i];
        if (chunk.startLine <= loc.start
                && chunk.endLine > loc.start + loc.length
                && (!bestChunk || bestChunkLength > chunk.endLine - chunk.startLine)) {
            bestChunk = chunk;
            bestChunkLength = chunk.endLine - chunk.startLine;
        }
    }
    if (bestChunk) {
        return bestChunk.id;
    }
    return undefined;
}