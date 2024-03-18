import { getBlocksInfo } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import { BlockMetadata } from "../types";
import * as Actions from "../state/actions";

export async function loadAllBlocksAsync() {
    const { dispatch } = stateAndDispatch();

    const blocksInfo = await getBlocksInfo();
    if (!blocksInfo) {
        // TODO thsparks : try again?
        // TODO thsparks : Probably just return but have an event to load blocks that triggers when the iframe is ready.
        return;
    }

    const allBlocks: pxt.Map<BlockMetadata[]> = {};
    for (const blockId of Object.keys(blocksInfo.blocksById)) {
        const block = blocksInfo.blocksById[blockId];

        // TODO thsparks : Filter out internal and empty categories?

        if (!allBlocks[block.namespace]) {
            allBlocks[block.namespace] = [];
        }

        allBlocks[block.namespace].push({
            category: block.namespace,
            id: blockId,
            imageUri: undefined
        });
    }

    dispatch(Actions.setAllBlocks(allBlocks));
}
