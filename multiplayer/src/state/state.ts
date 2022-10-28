import {
    NetMode,
    GameState,
    ToastWithId,
    Presence,
    defaultPresence,
    ModalType,
    GameMetadata,
    ClientRole,
} from "../types";

export type AppState = {
    netMode: NetMode;
    authStatus: "signed-in" | "signed-out" | "unknown";
    profile: pxt.auth.UserProfile | undefined;
    clientRole: ClientRole | undefined;
    gameId: string | undefined;
    playerSlot: number | undefined;
    joinCode: string | undefined;
    gameState: GameState | undefined;
    gameMetadata: GameMetadata | undefined;
    toasts: ToastWithId[];
    presence: Presence;
    modal: ModalType | undefined;
    modalOpts: any;
    muted: boolean;
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
    netMode: "init",
    authStatus: "unknown",
    profile: undefined,
    clientRole: undefined,
    gameId: undefined,
    playerSlot: undefined,
    joinCode: undefined,
    gameState: undefined,
    gameMetadata: undefined,
    toasts: [],
    presence: { ...defaultPresence },
    modal: undefined,
    modalOpts: undefined,
    muted: false,
    deepLinks: {},
    reactions: {},
};
