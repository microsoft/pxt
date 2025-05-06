import { AuthStatus, CollabInfo, ModalType, ModalOptions, Presence, defaultPresence } from "@/types";
import { ToastWithId } from "@/components/Toaster";

export type AppState = {
    authStatus: AuthStatus;
    userProfile?: pxt.auth.UserProfile;
    netState?: Partial<NetState>;
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

export type NetState = HostNetState | GuestNetState;

export const initialAppState: AppState = {
    //netMode: "init",
    authStatus: "unknown",
    toasts: [],
};

export const initialHostNetState: HostNetState = {
    type: "host",
    presence: defaultPresence,
};

export const initialGuestNetState: GuestNetState = {
    type: "guest",
    presence: defaultPresence,
};
