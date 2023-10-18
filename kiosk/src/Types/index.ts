export type GameData = {
    id: string;
    name: string;
    description: string;
    highScoreMode: string;
    uniqueIdentifier?: string;
    date?: string;
    userAdded?: boolean;
    deleted?: boolean;
};

export type HighScore = {
    initials: string;
    score: number;
};

export type HighScoreWithId = HighScore & {
    id: string;
};

export enum KioskState {
    MainMenu = "MainMenu",
    PlayingGame = "PlayingGame",
    EnterHighScore = "EnterHighScore",
    AddingGame = "AddingGame",
    ScanQR = "ScanQR",
    QrSuccess = "QrSuccess",
    GameOver = "GameOver",
}

export type Notification = {
    message: string;
    duration: number; // ms
};

export type NotificationWithId = Notification & {
    id: string;
    expiration: number; // Date.now() + duration
};

export type ShareId = {
    id: string;
};

export type GamesById = { [index: string]: GameData };

export type HighScores = HighScoreWithId[];

export type AllHighScores = { [index: string]: HighScores };

export type Notifications = NotificationWithId[];

export type ShareIds = { [index: string]: ShareId };

export type GameInfo = {
    name: string;
    description: string;
};

export type ModalId = "delete-game-confirmation";

export type DeleteGameModal = {
    id: "delete-game-confirmation";
    gameId: string;
};

export const makeDeleteGameModal = (gameId: string): DeleteGameModal => ({
    id: "delete-game-confirmation",
    gameId,
});

export type ModalConfig = DeleteGameModal;

export type NavRect = {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    center: { x: number; y: number };
};
