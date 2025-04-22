import { loadTutorialAsync } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";

export function previewCurrentTutorialAsync() {
    const { state, dispatch } = stateAndDispatch();

    if (state.tutorialMarkdown) {
        loadTutorialAsync(state.tutorialMarkdown);
    }
}