export type UiMode = "init" | "home" | "host" | "join";
export type NetMode = "init" | "connecting" | "connected";
export type ModalType =
    | "sign-in"
    | "report-abuse"
    | "host-lobby"
    | "join-lobby";

export type AppMode = {
    uiMode: UiMode;
    netMode: NetMode;
};

export const defaultAppMode: AppMode = {
    uiMode: "init",
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

export type GameMetadata = {
    title: string;
    description: string;
    thumbnail: string;
};

export type GameState = GameInfo & {
    gameMode?: GameMode;
};

export enum ButtonState {
    Pressed = 1,
    Released = 2,
    Held = 3,
}

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

    export type Message = ImageMessage | InputMessage;
}
