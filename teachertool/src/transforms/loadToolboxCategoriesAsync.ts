import { getToolboxCategories } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export async function loadToolboxCategoriesAsync() {
    const { dispatch } = stateAndDispatch();

    const regularCategories = await getToolboxCategories(false);
    const advancedCategories = await getToolboxCategories(true);
    const categories = (regularCategories ?? []).concat(advancedCategories ?? []);
    if (categories.length === 0) {
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
