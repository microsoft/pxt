

export type GameMode = "none" | "host" | "join";

export type GameStatus = "init" | "joining" | "playing" | "finished";

export type UserInfo = {
    id: string;
    name: string;
    pic: string;
}

export type GameInfo = {
    joinCode: string;
    affinityCookie: string;
}
