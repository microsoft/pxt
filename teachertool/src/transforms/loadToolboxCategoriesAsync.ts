import { getToolboxCategories } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export async function loadToolboxCategoriesAsync() {
    const { dispatch } = stateAndDispatch();

    const [regularCategories, advancedCategories] = await Promise.all([
        getToolboxCategories(false),
        getToolboxCategories(true)
    ]);
    const categories = (regularCategories ?? []).concat(advancedCategories ?? []);
    if (categories.length === 0) {
        return;
    }

    function shouldIncludeCategory(category: pxt.editor.ToolboxCategoryDefinition) {
        return category.name && category.blocks?.length != 0;
    }

    // Create a map so categories can be looked up by their name.
    const mappedCategories: pxt.Map<pxt.editor.ToolboxCategoryDefinition> = categories.reduce((map, category) => {
        if (shouldIncludeCategory(category)) {
            // Remove blocks with duplicate ids
            const filteredBlocks = category.blocks?.filter((block, index, self) => {
                return self.findIndex(b => b.blockId === block.blockId) === index;
            });

            // category.name cannot be null, per shouldIncludeCategory checks.
            map[category.name!] = { ...category, blocks: filteredBlocks };
        }
        return map;
    }, {} as pxt.Map<pxt.editor.ToolboxCategoryDefinition>);

    dispatch(Actions.setToolboxCategories(mappedCategories));
}
