import { getBlocksInfo } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import { CategoryData } from "../types";
import * as Actions from "../state/actions";

export async function loadAllBlocksAsync() {
    const { dispatch } = stateAndDispatch();

    const blocksInfo = await getBlocksInfo();
    if (!blocksInfo) {
        // TODO thsparks : try again?
        // TODO thsparks : Probably just return but have an event to load blocks that triggers when the iframe is ready.
        return;
    }

    function shouldIncludeCategory(category: string) {
        return category && !category.startsWith("_");
    }

    const allCategories: pxt.Map<CategoryData> = {};
    for (const blockId of Object.keys(blocksInfo.blocksById)) {
        const block = blocksInfo.blocksById[blockId];
        if (!shouldIncludeCategory(block.namespace)) {
            continue;
        }

        let category = allCategories[block.namespace];
        if (!category) {
            category = {
                name: block.namespace,
                color: block.attributes.color,
                blocks: []
            };
            allCategories[block.namespace] = category;
        }

        if (block.attributes.color && !category.color) {
            category.color = block.attributes.color;
        }

        category.blocks.push({
            category: block.namespace,
            id: blockId,
            imageUri: undefined
        });
    }

    dispatch(Actions.setToolboxCategories(allCategories));
}
