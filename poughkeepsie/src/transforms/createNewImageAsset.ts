import { stateAndDispatch } from "../state";
import { setActiveImageAsset, updateProject } from "../state/actions";
import { createNewAsset } from "../utils/project";

export function createNewImageAsset() {
    const { state, dispatch } = stateAndDispatch();

    const project = createNewAsset(state.project, state.activeImageTab);

    dispatch(updateProject(project));
    dispatch(setActiveImageAsset(project.assets[project.assets.length - 1].id));
}