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
    clientRole: ClientRole;
    collabInfo?: CollabInfo;
    modalType?: ModalType;
    modalOptions?: ModalOptions;
    toasts: ToastWithId[];
    presence: Presence;
};

export const initialAppState: AppState = {
    netMode: "init",
    authStatus: "unknown",
    clientRole: "none",
    toasts: [],
    presence: defaultPresence,
};
