export const HTTP_OK = 200;
export const HTTP_SESSION_FULL = 507; // Insuffient storage. Using this HTTP status code to indicate the game is full.
export const HTTP_SESSION_NOT_FOUND = 404; // Not found. Using this HTTP status code to indicate the game was not found.
export const HTTP_IM_A_TEAPOT = 418; // I'm a teapot. Using this HTTP status code to indicate look elsewhere for the reason.
export const HTTP_INTERNAL_SERVER_ERROR = 500;

export type ActionBase<Type extends string, Payload = unknown> = {
    type: Type;
    payload: Payload;
};

export type NetMode = "init" | "connecting" | "connected";
export type ClientRole = "host" | "guest" | "none";
export type GameMode = "lobby" | "playing";
export type SessionOverReason = "kicked" | "ended" | "left" | "full" | "rejected" | "not-found";
export type GameOverReason = SessionOverReason | "compile-failed";
export type AuthStatus = "signed-in" | "signed-out" | "unknown";

export type NetResult = {
    success: boolean;
    statusCode: number;
};

export type CollabInfo = {
    joinCode?: string;
    joinTicket?: string;
    slot?: number;
    initialState?: string;
};

export type CollabJoinResult = CollabInfo & NetResult;

export type UserInfo = {
    id: string;
    slot: number;
    role: ClientRole;
    kv?: Map<string, string>;
};

export function getUserValue(user: UserInfo, key: string, def?: string): string | undefined {
    if (user.kv) {
        return user.kv.get(key) ?? def;
    }
    return def;
}

export type Presence = {
    users: UserInfo[];
};

export const defaultPresence: Presence = {
    users: [],
};

export type ModalType = "sign-in" | "join-game";

export type ShowModalBase = {
    type: ModalType;
};

export type ShowSignInModalOptions = ShowModalBase & {
    type: "sign-in";
};

export type JoinGameModalOptions = ShowModalBase & {
    type: "join-game";
};

export type ModalOptions = ShowSignInModalOptions | JoinGameModalOptions;

export namespace SimMessages {
    type MessageBase = {
        type: "arcade-plato";
        origin?: "server" | "client";
        broadcast?: boolean;
    };
    //export type Message = ImageMessage | AudioMessage | InputMessage | MultiplayerIconMessage;
}
