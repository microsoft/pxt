import { nanoid } from "nanoid";
import {
    ActionBase,
    GameInfo,
    GameMode,
    Toast,
    ToastWithId,
    NetMode,
    Presence,
    ModalType,
    GameMetadata,
    ClientRole,
    CollabInfo,
} from "../types";

/**
 * Actions
 */

type SetUserProfile = ActionBase & {
    type: "SET_USER_PROFILE";
    profile?: pxt.auth.UserProfile;
};

type SetClientRole = ActionBase & {
    type: "SET_CLIENT_ROLE";
    clientRole: ClientRole | undefined;
};

type SetNetMode = ActionBase & {
    type: "SET_NET_MODE";
    mode: NetMode;
};

type SetCollabInfo = ActionBase & {
    type: "SET_COLLAB_INFO";
    collabInfo: CollabInfo | undefined;
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

type SetMute = ActionBase & {
    type: "SET_MUTE";
    value: boolean;
};

type SetGamePaused = ActionBase & {
    type: "SET_GAME_PAUSED";
    gamePaused: boolean;
};

type SetTargetConfig = ActionBase & {
    type: "SET_TARGET_CONFIG";
    targetConfig: pxt.TargetConfig;
};

type SetPresenceIconOverride = ActionBase & {
    type: "SET_PRESENCE_ICON_OVERRIDE";
    slot: number;
    icon: string | undefined;
};

type SetReactionIconOverride = ActionBase & {
    type: "SET_REACTION_ICON_OVERRIDE";
    slot: number;
    icon: string | undefined;
};

/**
 * Union of all actions
 */

export type Action =
    | SetUserProfile
    | SetClientRole
    | SetNetMode
    | SetGameInfo
    | SetCollabInfo
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
    | SetDeepLinks
    | SetMute
    | SetGamePaused
    | SetTargetConfig
    | SetPresenceIconOverride
    | SetReactionIconOverride;

/**
 * Action creators
 */

export const setUserProfile = (profile?: pxt.auth.UserProfile): SetUserProfile => ({
    type: "SET_USER_PROFILE",
    profile,
});

export const clearUserProfile = (): SetUserProfile => ({
    type: "SET_USER_PROFILE",
    profile: undefined,
});

export const setClientRole = (clientRole: ClientRole | undefined): SetClientRole => ({
    type: "SET_CLIENT_ROLE",
    clientRole,
});

export const setNetMode = (mode: NetMode): SetNetMode => ({
    type: "SET_NET_MODE",
    mode,
});

export const setGameInfo = (gameInfo: GameInfo): SetGameInfo => ({
    type: "SET_GAME_INFO",
    gameInfo,
});

export const setCollabInfo = (collabInfo: CollabInfo): SetCollabInfo => ({
    type: "SET_COLLAB_INFO",
    collabInfo,
});

export const setGameMetadata = (gameMetadata: GameMetadata): SetGameMetadata => ({
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

export const setReaction = (clientId: string, reactionId: string, index: number): SetReaction => ({
    type: "SET_REACTION",
    clientId,
    reactionId,
    index,
});

export const clearReaction = (clientId: string): ClearReaction => ({
    type: "CLEAR_REACTION",
    clientId,
});

export const showModal = (modalType: ModalType, modalOpts?: any): ShowModal => ({
    type: "SHOW_MODAL",
    modalType,
    modalOpts,
});

export const clearModal = (): ClearModal => ({
    type: "CLEAR_MODAL",
});

export const setDeepLinks = (shareCode: string | undefined, joinCode: string | undefined): SetDeepLinks => ({
    type: "SET_DEEP_LINKS",
    shareCode,
    joinCode,
});

export const setMute = (value: boolean): SetMute => ({
    type: "SET_MUTE",
    value,
});

export const setGamePaused = (gamePaused: boolean): SetGamePaused => ({
    type: "SET_GAME_PAUSED",
    gamePaused,
});

export const setTargetConfig = (trgCfg: pxt.TargetConfig): SetTargetConfig => ({
    type: "SET_TARGET_CONFIG",
    targetConfig: JSON.parse(JSON.stringify(trgCfg)),
});

export const setPresenceIconOverride = (slot: number, icon?: string): SetPresenceIconOverride => ({
    type: "SET_PRESENCE_ICON_OVERRIDE",
    slot,
    icon,
});

export const setReactionIconOverride = (slot: number, icon?: string): SetReactionIconOverride => ({
    type: "SET_REACTION_ICON_OVERRIDE",
    slot,
    icon,
});
