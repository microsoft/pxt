import { Asset, Project, TilemapAsset } from "../types/project";

// Changes to app state are performed by dispatching actions to the reducer
type ActionBase = {
    type: string;
};

/**
 * Actions
 */

type SetTargetConfig = ActionBase & {
    type: "SET_TARGET_CONFIG";
    config: pxt.TargetConfig;
};

type UpdateImageAsset = ActionBase & {
    type: "UPDATE_IMAGE_ASSET";
    newValue: Asset;
}

type UpdateTilemapAsset = ActionBase & {
    type: "UPDATE_TILEMAP_ASSET";
    newValue: TilemapAsset
}

type UpdateProject = ActionBase & {
    type: "UPDATE_PROJECT";
    project: Project;
}

type SetActiveImageAsset = ActionBase & {
    type: "SET_ACTIVE_IMAGE_ASSET";
    assetId: number;
}

type SetActiveImageTab = ActionBase & {
    type: "SET_ACTIVE_IMAGE_TAB";
    tab: Asset["kind"];
}

/**
 * Union of all actions
 */

export type Action =
    | SetTargetConfig
    | UpdateImageAsset
    | UpdateProject
    | SetActiveImageAsset
    | SetActiveImageTab
    | UpdateTilemapAsset

/**
 * Action creators
 */

const setTargetConfig = (config: pxt.TargetConfig): SetTargetConfig => ({
    type: "SET_TARGET_CONFIG",
    config,
});

const updateImageAsset = (newValue: Asset): UpdateImageAsset => ({
    type: "UPDATE_IMAGE_ASSET",
    newValue
});

const updateProject = (project: Project): UpdateProject => ({
    type: "UPDATE_PROJECT",
    project
});

const setActiveImageAsset = (assetId: number): SetActiveImageAsset => ({
    type: "SET_ACTIVE_IMAGE_ASSET",
    assetId
});

const setActiveImageTab = (tab: Asset["kind"]): SetActiveImageTab => ({
    type: "SET_ACTIVE_IMAGE_TAB",
    tab
});

const updateTilemapAsset = (newValue: TilemapAsset): UpdateTilemapAsset => ({
    type: "UPDATE_TILEMAP_ASSET",
    newValue
});


export {
    setTargetConfig,
    updateImageAsset,
    updateProject,
    setActiveImageAsset,
    setActiveImageTab,
    updateTilemapAsset
};
