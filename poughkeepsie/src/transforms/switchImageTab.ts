import { stateAndDispatch } from "../state";
import { setActiveImageTab } from "../state/actions";
import { Asset } from "../types/project";
import { setActiveImage } from "./setActiveImage";

export function switchImageTab(type: string) {
    const { state, dispatch } = stateAndDispatch();

    if (state.activeImageTab === type) return;

    dispatch(setActiveImageTab(type as Asset["kind"]));
    setActiveImage(state.project.assets.find(a => a.kind === type)?.id || 0);
}