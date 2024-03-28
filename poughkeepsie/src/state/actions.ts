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



/**
 * Union of all actions
 */

export type Action =
    | SetTargetConfig

/**
 * Action creators
 */

const setTargetConfig = (config: pxt.TargetConfig): SetTargetConfig => ({
    type: "SET_TARGET_CONFIG",
    config,
});


export {
    setTargetConfig,
};
