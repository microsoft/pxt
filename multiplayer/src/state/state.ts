import {
    AppMode,
    defaultAppMode,
    GameState,
    ToastWithId,
    Presence,
    defaultPresence,
} from "../types";

export type AppState = {
    appMode: AppMode;
    signedIn: boolean;
    profile: pxt.auth.UserProfile | undefined;
    gameId: string | undefined;
    joinCode: string | undefined;
    gameState: GameState | undefined;
    toasts: ToastWithId[];
    presence: Presence;
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
    signedIn: false,
    profile: undefined,
    gameId: undefined,
    joinCode: undefined,
    gameState: undefined,
    toasts: [],
    presence: { ...defaultPresence },
    reactions: {},
};
