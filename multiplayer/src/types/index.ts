export const HTTP_OK = 200;
export const HTTP_SESSION_FULL = 507; // Insuffient storage. Using this HTTP status code to indicate the game is full.
export const HTTP_SESSION_NOT_FOUND = 404; // Not found. Using this HTTP status code to indicate the game was not found.
export const HTTP_IM_A_TEAPOT = 418; // I'm a teapot. Using this HTTP status code to indicate look elsewhere for the reason.
export const HTTP_INTERNAL_SERVER_ERROR = 500;

export type ActionBase = {
    type: string;
};

export type NetMode = "init" | "connecting" | "connected";
export type ModalType =
    | "sign-in"
    | "report-abuse"
    | "kick-player"
    | "leave-game";

export type ClientRole = "host" | "guest" | "none";
export type GameMode = "lobby" | "playing";
export type SessionOverReason =
    | "kicked"
    | "ended"
    | "left"
    | "full"
    | "rejected"
    | "not-found";
export type GameOverReason = SessionOverReason | "compile-failed";

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

export type CollabJoinResult = Partial<CollabInfo> & NetResult;

export type GameInfo = {
    joinCode?: string;
    joinTicket?: string;
    gameId?: string;
    slot?: number;
};

export type GameJoinResult = Partial<GameInfo> & NetResult;

export type GameMetadata = {
    title: string;
    description: string;
    thumbnail: string;
};

export type GameState = GameInfo & {
    gameMode?: GameMode;
    // png data uris
    presenceIconOverrides?: (string | undefined)[];
    reactionIconOverrides?: (string | undefined)[];
};

export enum ButtonState {
    Pressed = 1,
    Released = 2,
    Held = 3,
}

export enum IconType {
    Player = 0,
    Reaction = 1,
}

export type IconMessage = {
    iconType: IconType;
    iconSlot: number;
    iconBuffer?: Buffer;
};

export enum SimKey {
    None = 0,

    // Player 1
    Left = 1,
    Up = 2,
    Right = 3,
    Down = 4,
    A = 5,
    B = 6,

    Menu = 7,

    // Player 2 = Player 1 + 7
    // Player 3 = Player 2 + 7
    // Player 4 = Player 3 + 7

    // system keys
    Screenshot = -1,
    Gif = -2,
    Reset = -3,
    TogglePause = -4,
}

// https://lospec.com/palette-list/gems-in-the-forrest
export const BRUSH_COLORS = [
    "#ff3282",
    "#5b1284",
    "#3171ee",
    "#4ff5fc",
    "#aefdd5",
];

export type BrushSizeType = "sm" | "md" | "lg";

export type BrushSize = {
    sz: BrushSizeType;
    px: number;
};

export const BRUSH_SIZES: BrushSize[] = [
    { sz: "sm", px: 22 },
    { sz: "md", px: 32 },
    { sz: "lg", px: 42 },
];

export type BrushModeType = "draw" | "move";

export type BrushMode = {
    mode: BrushModeType;
    icon: string;
};

export const BRUSH_MODES: BrushMode[] = [
    { mode: "draw", icon: "🖌️" },
    { mode: "move", icon: "🤚" },
];

export type Vec2Like = {
    x: number;
    y: number;
};

export function buttonStateToString(state: ButtonState): string | undefined {
    switch (state) {
        case ButtonState.Pressed:
            return "Pressed";
        case ButtonState.Released:
            return "Released";
        case ButtonState.Held:
            return "Held";
    }
}

export function stringToButtonState(state: string): ButtonState | undefined {
    switch (state) {
        case "Pressed":
            return ButtonState.Pressed;
        case "Released":
            return ButtonState.Released;
        case "Held":
            return ButtonState.Held;
    }
}

export enum AudioInstruction {
    MuteAllChannels = 0,
    PlayInstruction = 1,
}

export function audioInstructionToString(
    state: AudioInstruction
): string | undefined {
    switch (state) {
        case AudioInstruction.MuteAllChannels:
            return "muteallchannels";
        case AudioInstruction.PlayInstruction:
            return "playinstructions";
    }
}

export function stringToAudioInstruction(
    state: string
): AudioInstruction | undefined {
    switch (state) {
        case "muteallchannels":
            return AudioInstruction.MuteAllChannels;
        case "playinstructions":
            return AudioInstruction.PlayInstruction;
    }
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
    icon?: string; // if provided, will override the type-specific icon
};

export type ToastWithId = Toast & {
    id: string;
};

export type UserInfo = {
    id: string;
    slot: number;
    role: ClientRole;
    kv?: Map<string, string>;
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

export namespace SimMultiplayer {
    type MessageBase = {
        type: "multiplayer";
        origin?: "server" | "client";
        broadcast?: boolean;
    };
    export type ImageMessage = MessageBase & {
        content: "Image";
        image: any; // pxsim.RefBuffer
        palette: Uint8Array;
    };

    export type InputMessage = MessageBase & {
        content: "Button";
        button: number;
        clientNumber: number;
        state: "Pressed" | "Released" | "Held";
    };

    export type AudioMessage = MessageBase & {
        content: "Audio";
        instruction: "playinstructions" | "muteallchannels";
        soundbuf?: Uint8Array;
    };

    export type MultiplayerIconMessage = MessageBase & {
        content: "Icon";
        icon: any; // pxsim.RefBuffer
        slot: number;
        iconType: IconType;
        // 48bytes, [r0,g0,b0,r1,g1,b1,...]
        palette: Uint8Array;
    };

    export type MultiplayerConnectionMessage = MessageBase & {
        content: "Connection";
        slot: number;
        connected: boolean;
    };

    export type Message =
        | ImageMessage
        | AudioMessage
        | InputMessage
        | MultiplayerIconMessage;
}
