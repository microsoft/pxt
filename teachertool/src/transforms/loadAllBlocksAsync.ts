import { getToolboxCategories } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export async function loadAllBlocksAsync() {
    const { dispatch } = stateAndDispatch();

    const categories = await getToolboxCategories();
    if (!categories) {
        // TODO thsparks : try again?
        // TODO thsparks : Probably just return but have an event to load blocks that triggers when the iframe is ready.
        return;
    }

    function shouldIncludeCategory(category: pxt.editor.ToolboxCategoryDefinition) {
        return category && category.name && category.blocks?.length != 0;
    }

    // Create a map so categories can be looked up by their name.
    const mappedCategories: pxt.Map<pxt.editor.ToolboxCategoryDefinition> = categories.reduce((map, category) => {
        if (shouldIncludeCategory(category)) {
            map[category.name!] = category;
        }
        return map;
    }, {} as pxt.Map<pxt.editor.ToolboxCategoryDefinition>);

    dispatch(Actions.setToolboxCategories(mappedCategories));
}
