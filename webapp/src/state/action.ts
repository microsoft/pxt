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

type SetMuteState = ActionBase & {
    type: "SET_MUTE_STATE";
    state: pxt.editor.MuteState;
}

type SetFullScreen = ActionBase & {
    type: "SET_FULL_SCREEN";
    fullscreen: boolean;
}

type SetTracing = ActionBase & {
    type: "SET_TRACING";
    tracing: boolean;
}

type SetDebugging = ActionBase & {
    type: "SET_DEBUGGING";
    debugging: boolean;
}

export type Action =
    | SetEditorToolsCollapsed
    | SetGreenScreenEnabled
    | SetTabActive
    | SetMuteState
    | SetFullScreen
    | SetTracing
    | SetDebugging

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

const setMuteState = (state: pxt.editor.MuteState): SetMuteState => ({
    type: "SET_MUTE_STATE",
    state
});

const setFullScreen = (fullscreen: boolean): SetFullScreen => ({
    type: "SET_FULL_SCREEN",
    fullscreen
});

const setTracing = (tracing: boolean): SetTracing => ({
    type: "SET_TRACING",
    tracing
});

const setDebugging = (debugging: boolean): SetDebugging => ({
    type: "SET_DEBUGGING",
    debugging
});

export {
    setEditorToolsCollapsed,
    setGreenScreenEnabled,
    setTabActive,
    setMuteState,
    setFullScreen,
    setTracing,
    setDebugging
}