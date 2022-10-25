import { nanoid } from "nanoid";
import {
    GameInfo,
    GameMode,
    Toast,
    ToastWithId,
    UiMode,
    NetMode,
    Presence,
    ModalType,
    GameMetadata,
} from "../types";

// Changes to app state are performed by dispatching actions to the reducer
type ActionBase = {
    type: string;
};

/**
 * Actions
 */

type SetUserProfileAction = ActionBase & {
    type: "SET_USER_PROFILE";
    profile?: pxt.auth.UserProfile;
};

type SetUiMode = ActionBase & {
    type: "SET_UI_MODE";
    mode: UiMode;
};

type SetNetMode = ActionBase & {
    type: "SET_NET_MODE";
    mode: NetMode;
};

type SetGameInfo = ActionBase & {
    type: "SET_GAME_INFO";
    gameInfo: GameInfo | undefined;
};

type SetGameMetadata = ActionBase & {
    type: "SET_GAME_METADATA";
    gameMetadata: GameMetadata | undefined;
};

type SetGameId = ActionBase & {
    type: "SET_GAME_ID";
    gameId: string | undefined;
};

type SetPlayerSlot = ActionBase & {
    type: "SET_PLAYER_SLOT";
    playerSlot: number | undefined;
};

type ClearGameInfo = ActionBase & {
    type: "CLEAR_GAME_INFO";
};

type SetGameMode = ActionBase & {
    type: "SET_GAME_MODE";
    gameMode: GameMode;
};

type ShowToast = ActionBase & {
    type: "SHOW_TOAST";
    toast: ToastWithId;
};

type DismissToast = ActionBase & {
    type: "DISMISS_TOAST";
    id: string;
};

type SetPresence = ActionBase & {
    type: "SET_PRESENCE";
    presence: Presence;
};

type SetReaction = ActionBase & {
    type: "SET_REACTION";
    clientId: string;
    reactionId: string;
    index: number;
};

type ClearReaction = ActionBase & {
    type: "CLEAR_REACTION";
    clientId: string;
};

type ShowModal = ActionBase & {
    type: "SHOW_MODAL";
    modalType: ModalType;
    modalOpts: any;
};

type ClearModal = ActionBase & {
    type: "CLEAR_MODAL";
};

type SetDeepLinks = ActionBase & {
    type: "SET_DEEP_LINKS";
    shareCode: string | undefined;
    joinCode: string | undefined;
};

/**
 * Union of all actions
 */

export type Action =
    | SetUserProfileAction
    | SetUiMode
    | SetNetMode
    | SetGameInfo
    | SetGameMetadata
    | SetGameId
    | SetPlayerSlot
    | ClearGameInfo
    | SetGameMode
    | ShowToast
    | DismissToast
    | SetPresence
    | SetReaction
    | ClearReaction
    | ShowModal
    | ClearModal
    | SetDeepLinks;

/**
 * Action creators
 */

export const setUserProfile = (
    profile?: pxt.auth.UserProfile
): SetUserProfileAction => ({
    type: "SET_USER_PROFILE",
    profile,
});

export const clearUserProfile = (): SetUserProfileAction => ({
    type: "SET_USER_PROFILE",
    profile: undefined,
});

export const setUiMode = (mode: UiMode): SetUiMode => ({
    type: "SET_UI_MODE",
    mode,
});

export const setNetMode = (mode: NetMode): SetNetMode => ({
    type: "SET_NET_MODE",
    mode,
});

export const setGameInfo = (gameInfo: GameInfo): SetGameInfo => ({
    type: "SET_GAME_INFO",
    gameInfo,
});

export const setGameMetadata = (
    gameMetadata: GameMetadata
): SetGameMetadata => ({
    type: "SET_GAME_METADATA",
    gameMetadata,
});

export const clearGameMetadata = (): SetGameMetadata => ({
    type: "SET_GAME_METADATA",
    gameMetadata: undefined,
});

export const setGameId = (gameId: string): SetGameId => ({
    type: "SET_GAME_ID",
    gameId,
});

export const setPlayerSlot = (slot: number): SetPlayerSlot => ({
    type: "SET_PLAYER_SLOT",
    playerSlot: slot,
});

export const clearGameInfo = (): ClearGameInfo => ({
    type: "CLEAR_GAME_INFO",
});

export const setGameMode = (gameMode: GameMode): SetGameMode => ({
    type: "SET_GAME_MODE",
    gameMode,
});

export const showToast = (toast: Toast): ShowToast => ({
    type: "SHOW_TOAST",
    toast: {
        id: nanoid(8),
        ...toast,
    },
});

export const dismissToast = (id: string): DismissToast => ({
    type: "DISMISS_TOAST",
    id,
});

export const setPresence = (presence: Presence): SetPresence => ({
    type: "SET_PRESENCE",
    presence,
});

export const setReaction = (
    clientId: string,
    reactionId: string,
    index: number
): SetReaction => ({
    type: "SET_REACTION",
    clientId,
    reactionId,
    index,
});

export const clearReaction = (clientId: string): ClearReaction => ({
    type: "CLEAR_REACTION",
    clientId,
});

export const showModal = (
    modalType: ModalType,
    modalOpts?: any
): ShowModal => ({
    type: "SHOW_MODAL",
    modalType,
    modalOpts,
});

export const clearModal = (): ClearModal => ({
    type: "CLEAR_MODAL",
});

export const setDeepLinks = (
    shareCode: string | undefined,
    joinCode: string | undefined
): SetDeepLinks => ({
    type: "SET_DEEP_LINKS",
    shareCode,
    joinCode,
});
