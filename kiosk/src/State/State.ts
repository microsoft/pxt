import {
    GameData,
    BuiltSimJSInfo,
    KioskState,
    HighScore,
    NotificationWithId,
} from "../Types";

export type AppState = {
    kioskState: KioskState;
    allGames: GameData[];
    mostRecentScores: number[];
    selectedGameId?: string;
    launchedGameId?: string;
    lockedGameId?: string;
    builtGamesCache: { [gameId: string]: BuiltSimJSInfo };
    allHighScores: { [index: string]: HighScore[] };
    kioskCode?: string;
    kioskCodeExpiration?: number;
    notifications: NotificationWithId[];
    clean: boolean;
    locked: boolean;
    time?: string;
    volume?: number;
};

export const initialAppState: AppState = {
    kioskState: KioskState.MainMenu,
    allGames: [],
    mostRecentScores: [],
    builtGamesCache: {},
    allHighScores: {},
    notifications: [],
    clean: false,
    locked: false,
    time: "",
    volume: 0,
};
