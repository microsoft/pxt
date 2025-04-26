import {
    NetMode,
    ClientRole,
    AuthStatus,
    CollabInfo,
    ModalType,
    ModalOptions,
    Presence,
    defaultPresence,
} from "@/types";
import { ToastWithId } from "@/components/Toaster";

export type AppState = {
    netMode: NetMode;
    authStatus: AuthStatus;
    userProfile?: pxt.auth.UserProfile;
    viewState?: ViewState;
    collabInfo?: CollabInfo;
    modalType?: ModalType;
    modalOptions?: ModalOptions;
    toasts: ToastWithId[];
};

export type ViewStateBase = {
    type: string;
    presence: Presence;
};

export type HostViewState = ViewStateBase & {
    type: "host";
    shareCode?: string;
    gameCode?: string;
    gameCodeExpiresAt?: number;
};

export type GuestViewState = ViewStateBase & {
    type: "guest";
    shareCode?: string;
};

export type ViewState = HostViewState | GuestViewState;

export const initialAppState: AppState = {
    netMode: "init",
    authStatus: "unknown",
    toasts: [],
};

export const initialHostViewState: HostViewState = {
    type: "host",
    presence: defaultPresence,
};

export const initialGuestViewState: GuestViewState = {
    type: "guest",
    presence: defaultPresence,
};
