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

/**
 * Union of all actions
 */

export type Action =
    | SetTargetConfig
    | SetTutorialMarkdown


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


export {
    setTargetConfig,
    setTutoralMarkdown
};
