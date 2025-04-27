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

export type NetStateBase = {
    type: string;
    presence: Presence;
    joinCode?: string;
};

export type HostNetState = NetStateBase & {
    type: "host";
    shareCode?: string;
};

export type GuestNetState = NetStateBase & {
    type: "guest";
    shareCode?: string;
};

export type ViewState = HostNetState | GuestNetState;

export const initialAppState: AppState = {
    netMode: "init",
    authStatus: "unknown",
    toasts: [],
};

export const initialHostViewState: HostNetState = {
    type: "host",
    presence: defaultPresence,
};

export const initialGuestViewState: GuestNetState = {
    type: "guest",
    presence: defaultPresence,
};
