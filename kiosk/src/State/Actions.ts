import {
    GameData,
    BuiltSimJSInfo,
    KioskState,
    HighScore,
    HighScores,
} from "../Types";

// Changes to app state are performed by dispatching actions to the reducer
type ActionBase = {
    type: string;
};

/**
 * Actions
 */

type SetGameList = ActionBase & {
    type: "SET_GAME_LIST";
    games: GameData[];
};

type SetSelectedGameId = ActionBase & {
    type: "SET_SELECTED_GAME_ID";
    gameId: string | undefined;
};

type SetKioskState = ActionBase & {
    type: "SET_KIOSK_STATE";
    state: KioskState;
};

type AddBuiltGame = ActionBase & {
    type: "ADD_BUILT_GAME";
    gameId: string;
    info: BuiltSimJSInfo;
};

type SetLaunchedGame = ActionBase & {
    type: "SET_LAUNCHED_GAME";
    gameId: string;
};

type SetLockedGame = ActionBase & {
    type: "SET_LOCKED_GAME";
    gameId: string;
};

type SetAllHighScores = ActionBase & {
    type: "SET_ALL_HIGH_SCORES";
    allHighScores: HighScores;
};

type SetVolume = ActionBase & {
    type: "SET_VOLUME";
    volume: number;
};

type AddGame = ActionBase & {
    type: "ADD_GAME";
    game: GameData;
};

type RemoveGame = ActionBase & {
    type: "REMOVE_GAME";
    gameId: string;
};

type SaveHighScore = ActionBase & {
    type: "SAVE_HIGH_SCORE";
    gameId: string;
    initials: string;
    score: number;
};

type LoadHighScores = ActionBase & {
    type: "LOAD_HIGH_SCORES";
};

type SetMostRecentScores = ActionBase & {
    type: "SET_MOST_RECENT_SCORES";
    scores: number[];
};

type LoadUserAddedGames = ActionBase & {
    type: "LOAD_USER_ADDED_GAMES";
};

type ResetHighScores = ActionBase & {
    type: "RESET_HIGH_SCORES";
};

/**
 * Union of all actions
 */

export type Action =
    | SetGameList
    | SetSelectedGameId
    | SetKioskState
    | AddBuiltGame
    | SetLaunchedGame
    | SetLockedGame
    | SetAllHighScores
    | SetVolume
    | AddGame
    | RemoveGame
    | SaveHighScore
    | LoadHighScores
    | SetMostRecentScores
    | LoadUserAddedGames
    | ResetHighScores;

/**
 * Action creators
 */

const setGameList = (games: GameData[]): SetGameList => ({
    type: "SET_GAME_LIST",
    games,
});

const setSelectedGameId = (gameId: string | undefined): SetSelectedGameId => ({
    type: "SET_SELECTED_GAME_ID",
    gameId,
});

const setKioskState = (state: KioskState): SetKioskState => ({
    type: "SET_KIOSK_STATE",
    state,
});

const addBuiltGame = (gameId: string, info: BuiltSimJSInfo): AddBuiltGame => ({
    type: "ADD_BUILT_GAME",
    gameId,
    info,
});

const setLaunchedGame = (gameId: string): SetLaunchedGame => ({
    type: "SET_LAUNCHED_GAME",
    gameId,
});

const setLockedGame = (gameId: string): SetLockedGame => ({
    type: "SET_LOCKED_GAME",
    gameId,
});

const setAllHighScores = (allHighScores: {
    [index: string]: HighScore[];
}): SetAllHighScores => ({
    type: "SET_ALL_HIGH_SCORES",
    allHighScores,
});

const setVolume = (volume: number): SetVolume => ({
    type: "SET_VOLUME",
    volume,
});

const addGame = (game: GameData): AddGame => ({
    type: "ADD_GAME",
    game,
});

const removeGame = (gameId: string): RemoveGame => ({
    type: "REMOVE_GAME",
    gameId,
});

const saveHighScore = (
    gameId: string,
    initials: string,
    score: number
): SaveHighScore => ({
    type: "SAVE_HIGH_SCORE",
    gameId,
    initials,
    score,
});

const loadHighScores = (): LoadHighScores => ({
    type: "LOAD_HIGH_SCORES",
});

const setMostRecentScores = (scores: number[]): SetMostRecentScores => ({
    type: "SET_MOST_RECENT_SCORES",
    scores,
});

const loadUserAddedGames = (): LoadUserAddedGames => ({
    type: "LOAD_USER_ADDED_GAMES",
});

const resetHighScores = (): ResetHighScores => ({
    type: "RESET_HIGH_SCORES",
});

export {
    setGameList,
    setSelectedGameId,
    setKioskState,
    addBuiltGame,
    setLaunchedGame,
    setLockedGame,
    setAllHighScores,
    setVolume,
    addGame,
    removeGame,
    saveHighScore,
    loadHighScores,
    setMostRecentScores,
    loadUserAddedGames,
    resetHighScores,
};
