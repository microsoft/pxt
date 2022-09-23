

// Changes to app state are performed by dispatching actions to the reducer
type ActionBase = {
    type: string;
};

/**
 * Actions
 */

type SetMotdAction = ActionBase & {
    type: "SET_MOTD";
    motd: string;
};

type SetUserProfileAction = ActionBase & {
    type: "SET_USER_PROFILE";
    profile?: pxt.auth.UserProfile;
};

/**
 * Union of all actions
 */

 export type Action
    = SetMotdAction
    | SetUserProfileAction


 /**
 * Action creators
 */

export const setMotd = (motd: string): SetMotdAction => ({
    type: "SET_MOTD",
    motd,
});

export const setUserProfile = (profile?: pxt.auth.UserProfile): SetUserProfileAction => ({
    type: "SET_USER_PROFILE",
    profile,
});

export const clearUserProfile = (): SetUserProfileAction => ({
    type: "SET_USER_PROFILE",
    profile: undefined,
});
