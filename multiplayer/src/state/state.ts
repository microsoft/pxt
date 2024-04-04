import {
    NetMode,
    GameState,
    ToastWithId,
    Presence,
    defaultPresence,
    ModalType,
    GameMetadata,
    ClientRole,
    CollabInfo,
} from "../types";

export type AppState = {
    netMode: NetMode;
    authStatus: "signed-in" | "signed-out" | "unknown";
    profile: pxt.auth.UserProfile | undefined;
    clientRole: ClientRole | undefined;
    playerSlot: number | undefined;
    joinCode: string | undefined;
    gameState: GameState | undefined;
    gameMetadata: GameMetadata | undefined;
    gamePaused: boolean | undefined;
    collabInfo: CollabInfo | undefined;
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
    targetConfig: pxt.TargetConfig | undefined;
    collabMode: boolean; // ?collab=1 in URL
};

export const initialAppState: AppState = {
    netMode: "init",
    authStatus: "unknown",
    profile: undefined,
    clientRole: undefined,
    playerSlot: undefined,
    joinCode: undefined,
    gameState: undefined,
    gameMetadata: undefined,
    gamePaused: undefined,
    collabInfo: undefined,
    toasts: [],
    presence: { ...defaultPresence },
    modal: undefined,
    modalOpts: undefined,
    muted: pxt.BrowserUtils.isSafari(),
    deepLinks: {},
    reactions: {},
    targetConfig: undefined,
    collabMode: /[?|&]collab=1/i.test(window.location.href),
};
