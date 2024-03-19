import { getBlockImageUriAsync } from "../services/makecodeEditorService";
import { BlockData, CategoryData } from "../types";
import * as Actions from "../state/actions";
import { stateAndDispatch } from "../state";


async function loadBlockImageAsync(categoryName: string, block: BlockData) {
    if (block.imageUri) {
        return;
    }

    const imageUri = await getBlockImageUriAsync(block.id);

    if (imageUri) {
        const { dispatch } = stateAndDispatch();
        dispatch(Actions.setBlockImageUri(categoryName, block.id, imageUri));
    }
}

export async function loadBlockImagesAsync(category: CategoryData) {
    return pxt.Util.promisePoolAsync(4, category.blocks, async (block: BlockData) => await loadBlockImageAsync(category.name, block));
}
