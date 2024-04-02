import { Asset, Project } from "../types/project";
import { createNewProject } from "../utils/project";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    project: Project;

    currentTilemapId: number;
    currentImageId: number;

    activeImageTab: Asset["kind"];
};

const initProject = createNewProject();

export const initialAppState: AppState = {
    project: initProject,
    currentTilemapId: initProject.assets.find(a => a.kind === "tilemap")?.id || 0,
    currentImageId: initProject.assets.find(a => a.kind === "avatar")?.id || 0,
    activeImageTab: "avatar",
};
