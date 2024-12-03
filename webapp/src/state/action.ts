import { ActionBase } from "./dataStore";

type SetEditorToolsCollapsed = ActionBase & {
    type: "SET_EDITOR_TOOLS_COLLAPSED";
    collapsed:  boolean;
}

type SetGreenScreenEnabled = ActionBase & {
    type: "SET_GREEN_SCREEN_ENABLED";
    enabled:  boolean;
}

type SetTabActive = ActionBase & {
    type: "SET_TAB_ACTIVE";
    active: boolean;
}

export type Action =
    | SetEditorToolsCollapsed
    | SetGreenScreenEnabled
    | SetTabActive

const setEditorToolsCollapsed = (collapsed: boolean): SetEditorToolsCollapsed => ({
    type: "SET_EDITOR_TOOLS_COLLAPSED",
    collapsed
});

const setGreenScreenEnabled = (enabled: boolean): SetGreenScreenEnabled => ({
    type: "SET_GREEN_SCREEN_ENABLED",
    enabled
});

const setTabActive = (active: boolean): SetTabActive => ({
    type: "SET_TAB_ACTIVE",
    active
});

export {
    setEditorToolsCollapsed,
    setGreenScreenEnabled,
    setTabActive
}