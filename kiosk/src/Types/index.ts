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

export type BuiltSimJSInfo = {
    js: string;
    targetVersion?: string;
    funArgs?: string[];
    parts?: string[];
    usedBuiltinParts?: string[];
};

export enum KioskState {
    MainMenu,
    PlayingGame,
    EnterHighScore,
    AddingGame,
    ScanQR,
    QrSuccess,
    GameOver,
}

export type ShareId = {
    id: string;
};

export type GameList = { [index: string]: GameData };

export type HighScores = { [index: string]: HighScore[] };

export type ShareIds = { [index: string]: ShareId };
