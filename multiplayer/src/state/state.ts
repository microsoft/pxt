import {
    AppMode,
    defaultAppMode,
    GameState,
    ToastWithId,
    Presence,
    defaultPresence,
    ModalType,
    GameMetadata,
} from "../types";

export type AppState = {
    appMode: AppMode;
    authStatus: "signed-in" | "signed-out" | "unknown";
    profile: pxt.auth.UserProfile | undefined;
    gameId: string | undefined;
    playerSlot: number | undefined;
    joinCode: string | undefined;
    gameState: GameState | undefined;
    gameMetadata: GameMetadata | undefined;
    toasts: ToastWithId[];
    presence: Presence;
    modal: ModalType | undefined;
    modalOpts: any;
    deepLinks: {
        shareCode?: string;
        joinCode?: string;
    };
    reactions: {
        [clientId: string]:
            | {
                  id: string;
                  index: number;
              }
            | undefined;
    };
};

export const initialAppState: AppState = {
    appMode: { ...defaultAppMode },
    authStatus: "unknown",
    profile: undefined,
    gameId: undefined,
    playerSlot: undefined,
    joinCode: undefined,
    gameState: undefined,
    gameMetadata: undefined,
    toasts: [],
    presence: { ...defaultPresence },
    modal: undefined,
    modalOpts: undefined,
    deepLinks: {},
    reactions: {},
};
