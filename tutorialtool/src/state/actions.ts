import { ModalOptions } from "../types/modalOptions";

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

type SetTutorialMarkdown = ActionBase & {
    type: "SET_TUTORIAL_MARKDOWN";
    markdown: string;
};

type SetUserProfile = ActionBase & {
    type: "SET_USER_PROFILE";
    profile: pxt.auth.UserProfile;
};

type ClearUserProfile = ActionBase & {
    type: "CLEAR_USER_PROFILE";
};

type HideModal = ActionBase & {
    type: "HIDE_MODAL";
};

type ShowModal = ActionBase & {
    type: "SHOW_MODAL";
    modalOptions: ModalOptions;
};

/**
 * Union of all actions
 */

export type Action =
    | SetTargetConfig
    | SetTutorialMarkdown
    | SetUserProfile
    | ClearUserProfile
    | HideModal
    | ShowModal


/**
 * Action creators
 */

const setTargetConfig = (config: pxt.TargetConfig): SetTargetConfig => ({
    type: "SET_TARGET_CONFIG",
    config,
});

const setTutoralMarkdown = (tutorialMarkdown: string): SetTutorialMarkdown => ({
    type: "SET_TUTORIAL_MARKDOWN",
    markdown: tutorialMarkdown,
})

const setUserProfile = (profile: pxt.auth.UserProfile): SetUserProfile => ({
    type: "SET_USER_PROFILE",
    profile
});

const clearUserProfile = (): ClearUserProfile => ({
    type: "CLEAR_USER_PROFILE"
});

const hideModal = (): HideModal => ({
    type: "HIDE_MODAL"
});

const showModal = (modalOptions: ModalOptions): ShowModal => ({
    type: "SHOW_MODAL",
    modalOptions,
});

export {
    setTargetConfig,
    setTutoralMarkdown,
    setUserProfile,
    clearUserProfile,
    hideModal,
    showModal
};
