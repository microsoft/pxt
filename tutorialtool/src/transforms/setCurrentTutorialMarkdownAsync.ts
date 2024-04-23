import { stateAndDispatch } from "../state";
import { setTutoralMarkdown } from "../state/actions";

export async function setCurrentTutorialMarkdownAsync(markdown: string): Promise<void> {
    const { state, dispatch } = stateAndDispatch();

    dispatch(setTutoralMarkdown(markdown));
}