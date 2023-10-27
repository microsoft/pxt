import {
    GameData,
    KioskState,
    AllHighScores,
    NotificationWithId,
    HighScoreWithId,
    ModalConfig,
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
    allHighScores: AllHighScores;
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

type UpdateGame = ActionBase & {
    type: "UPDATE_GAME";
    gameId: string;
    gameData: Partial<GameData>;
};

type SaveHighScore = ActionBase & {
    type: "SAVE_HIGH_SCORE";
    gameId: string;
    highScore: HighScoreWithId;
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

type SetKioskCode = ActionBase & {
    type: "SET_KIOSK_CODE";
    kioskCode: string;
    kioskCodeExpiration: number;
};

type ClearKioskCode = ActionBase & {
    type: "CLEAR_KIOSK_CODE";
};

type PostNotification = ActionBase & {
    type: "POST_NOTIFICATION";
    notification: NotificationWithId;
};

type RemoveNotification = ActionBase & {
    type: "REMOVE_NOTIFICATION";
    notificationId: string;
};

type LoadKioskCode = ActionBase & {
    type: "LOAD_KIOSK_CODE";
};

type ShowModal = ActionBase & {
    type: "SHOW_MODAL";
    modal: ModalConfig;
};

type HideModal = ActionBase & {
    type: "HIDE_MODAL";
};

type SetTargetConfig = ActionBase & {
    type: "SET_TARGET_CONFIG";
    targetConfig: pxt.TargetConfig;
};


/**
 * Union of all actions
 */

export type Action =
    | SetGameList
    | SetSelectedGameId
    | SetKioskState
    | SetLaunchedGame
    | SetLockedGame
    | SetAllHighScores
    | SetVolume
    | AddGame
    | RemoveGame
    | UpdateGame
    | SaveHighScore
    | LoadHighScores
    | SetMostRecentScores
    | LoadUserAddedGames
    | ResetHighScores
    | SetKioskCode
    | ClearKioskCode
    | PostNotification
    | RemoveNotification
    | LoadKioskCode
    | ShowModal
    | HideModal
    | SetTargetConfig;

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

const setLaunchedGame = (gameId: string): SetLaunchedGame => ({
    type: "SET_LAUNCHED_GAME",
    gameId,
});

const setLockedGame = (gameId: string): SetLockedGame => ({
    type: "SET_LOCKED_GAME",
    gameId,
});

const setAllHighScores = (allHighScores: AllHighScores): SetAllHighScores => ({
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

const updateGame = (gameId: string, gameData: Partial<GameData>): UpdateGame => ({
    type: "UPDATE_GAME",
    gameId,
    gameData
});

const saveHighScore = (
    gameId: string,
    highScore: HighScoreWithId
): SaveHighScore => ({
    type: "SAVE_HIGH_SCORE",
    gameId,
    highScore,
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

const setKioskCode = (
    kioskCode: string,
    kioskCodeExpiration: number
): SetKioskCode => ({
    type: "SET_KIOSK_CODE",
    kioskCode,
    kioskCodeExpiration,
});

const clearKioskCode = (): ClearKioskCode => ({
    type: "CLEAR_KIOSK_CODE",
});

const postNotification = (
    notification: NotificationWithId
): PostNotification => ({
    type: "POST_NOTIFICATION",
    notification,
});

const removeNotification = (notificationId: string): RemoveNotification => ({
    type: "REMOVE_NOTIFICATION",
    notificationId,
});

const loadKioskCode = (): LoadKioskCode => ({
    type: "LOAD_KIOSK_CODE",
});

const showModal = (modal: ModalConfig): ShowModal => ({
    type: "SHOW_MODAL",
    modal,
});

const hideModal = (): HideModal => ({
    type: "HIDE_MODAL",
});

const setTargetConfig = (targetConfig: pxt.TargetConfig): SetTargetConfig => ({
    type: "SET_TARGET_CONFIG",
    targetConfig,
});

export {
    setGameList,
    setSelectedGameId,
    setKioskState,
    setLaunchedGame,
    setLockedGame,
    setAllHighScores,
    setVolume,
    addGame,
    removeGame,
    updateGame,
    saveHighScore,
    loadHighScores,
    setMostRecentScores,
    loadUserAddedGames,
    resetHighScores,
    setKioskCode,
    clearKioskCode,
    postNotification,
    removeNotification,
    loadKioskCode,
    showModal,
    hideModal,
    setTargetConfig,
};
