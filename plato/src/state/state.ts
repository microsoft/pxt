import { AuthStatus, CollabInfo, ModalType, ModalOptions } from "@/types";
import { ToastWithId } from "@/components/Toaster";

export type AppState = {
    authStatus: AuthStatus;
    userProfile?: pxt.auth.UserProfile;
    netState: Partial<NetState>;
    collabInfo?: CollabInfo;
    modalType?: ModalType;
    modalOptions?: ModalOptions;
    toasts: ToastWithId[];
    opts: Map<string, string>;
};

export type NetStateBase = {
    clientRole: string;
    joinCode?: string;
};

export type NoneNetState = NetStateBase & {
    clientRole: "none";
    shareCode?: string;
};

export type HostNetState = NetStateBase & {
    clientRole: "host";
    shareCode?: string;
};

export type GuestNetState = NetStateBase & {
    clientRole: "guest";
    shareCode?: string;
};

export type NetState = HostNetState | GuestNetState | NoneNetState;

export const initialNoneNetState = (): NoneNetState => ({
    clientRole: "none",
});

export const initialHostNetState = (): HostNetState => ({
    clientRole: "host",
});

export const initialGuestNetState = (): GuestNetState => ({
    clientRole: "guest",
});

export const initialAppState: AppState = {
    authStatus: "unknown",
    netState: initialNoneNetState(),
    toasts: [],
    opts: new Map<string, string>(),
};
