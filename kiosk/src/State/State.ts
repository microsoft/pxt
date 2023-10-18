import {
    GameData,
    KioskState,
    AllHighScores,
    Notifications,
    ModalConfig,
} from "../Types";

export type AppState = {
    kioskState: KioskState;
    allGames: GameData[];
    mostRecentScores: number[];
    selectedGameId?: string;
    launchedGameId?: string;
    lockedGameId?: string;
    allHighScores: AllHighScores;
    kioskCode?: string;
    kioskCodeExpiration?: number;
    notifications: Notifications;
    modal?: ModalConfig;
    clean: boolean;
    locked: boolean;
    time?: string;
    volume?: number;
    targetConfig?: pxt.TargetConfig;
};

export const initialAppState: AppState = {
    kioskState: KioskState.MainMenu,
    allGames: [],
    mostRecentScores: [],
    allHighScores: {},
    notifications: [],
    clean: false,
    locked: false,
    time: "",
    volume: 0,
};
