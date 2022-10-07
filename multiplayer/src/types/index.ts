export type UiMode = "home" | "host" | "join";
export type NetMode = "init" | "connecting" | "connected";

export type AppMode = {
    uiMode: UiMode;
    netMode: NetMode;
};

export const defaultAppMode: AppMode = {
    uiMode: "home",
    netMode: "init",
};

export type ClientRole = "host" | "guest";
export type GameMode = "lobby" | "playing";

export type GameInfo = {
    joinCode?: string;
    joinTicket?: string;
    affinityCookie?: string;
    gameId?: string;
    slot?: number;
};

export type GameState = GameInfo & {
    gameMode?: GameMode;
};

export namespace Cli2Srv {
    type MessageBase = {
        type: string;
    };

    export type HelloMessage = MessageBase & {
        type: "hello";
    };

    export type HeartbeatMessage = MessageBase & {
        type: "heartbeat";
    };

    export type ConnectMessage = MessageBase & {
        type: "connect";
        ticket: string;
    };

    export type StartGameMessage = MessageBase & {
        type: "start-game";
    };

    export type ChatMessage = MessageBase & {
        type: "chat";
        text: string;
    };

    export type ReactionMessage = MessageBase & {
        type: "reaction";
        index: number;
    };

    export type Message =
        | HelloMessage
        | HeartbeatMessage
        | ConnectMessage
        | StartGameMessage
        | ChatMessage
        | ReactionMessage;
}

export namespace Srv2Cli {
    type MessageBase = {
        type: string;
    };

    export type HelloMessage = MessageBase & {
        type: "hello";
    };

    export type JoinedMessage = MessageBase & {
        type: "joined";
        role: ClientRole;
        slot: number;
        gameMode: GameMode;
    };

    export type StartGameMessage = MessageBase & {
        type: "start-game";
    };

    export type ChatMessage = MessageBase & {
        type: "chat";
        text: string;
    };

    export type PresenceMessage = MessageBase & {
        type: "presence";
        presence: Presence;
    };

    export type ReactionMessage = MessageBase & {
        type: "reaction";
        index: number;
        userId: string;
    };

    export type PlayerJoinedMessage = MessageBase & {
        type: "player-joined";
        userId: string;
    };

    export type PlayerLeftMessage = MessageBase & {
        type: "player-left";
        userId: string;
    };

    export type Message =
        | HelloMessage
        | JoinedMessage
        | StartGameMessage
        | ChatMessage
        | PresenceMessage
        | ReactionMessage
        | PlayerJoinedMessage
        | PlayerLeftMessage;
}

export type ToastType = "success" | "info" | "warning" | "error";

export type Toast = {
    type: ToastType;
    text?: string; // primary message
    detail?: string; // secondary message
    jsx?: React.ReactNode; // React content
    timeoutMs?: number; // if provided, will auto-dismiss after a time
    weight?: number; // heavier toasts sort downward
    textColorClass?: string; // if provided, override default text color
    backgroundColorClass?: string; // if provided, override default background color
    sliderColorClass?: string; // if provided, override default timeout slider color
    hideDismissBtn?: boolean; // if true, will hide the dismiss button
    showSpinner?: boolean; // if true, will show a spinner icon
    hideIcon?: boolean; // if true, will hide the type-specific icon
};

export type ToastWithId = Toast & {
    id: string;
};

export type UserInfo = {
    id: string;
    slot: number;
    role: ClientRole;
    name: string;
};

export type Presence = {
    users: UserInfo[];
};

export const defaultPresence: Presence = {
    users: [],
};

export type Dimension = {
    width: number;
    height: number;
};
