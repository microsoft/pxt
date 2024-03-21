import { getBlockImageUriFromBlockIdAsync, getBlockImageUriFromXmlAsync } from "../services/makecodeEditorService";
import * as Actions from "../state/actions";
import { stateAndDispatch } from "../state";

async function loadBlockImageAsync(block: pxt.editor.ToolboxBlockDefinition) {
    const { state } = stateAndDispatch();

    if (!block.blockId) {
        return;
    }

    const image = state.blockImageCache[block.blockId];
    if (image) {
        return;
    }

    const imageUri = block.blockXml ? await getBlockImageUriFromXmlAsync(block.blockXml) : await getBlockImageUriFromBlockIdAsync(block.blockId);
    if (imageUri) {
        const { dispatch } = stateAndDispatch();
        dispatch(Actions.setBlockImageUri(block.blockId, imageUri));
    }
}

export async function loadBlockImagesAsync(category: pxt.editor.ToolboxCategoryDefinition) {
    return category.blocks
        ? pxt.Util.promisePoolAsync(
              4,
              category.blocks,
              async (block: pxt.editor.ToolboxBlockDefinition) => await loadBlockImageAsync(block)
          )
        : Promise.resolve();
}
