import { AuthStatus, CollabInfo, ModalType, ModalOptions, ClientRole } from "@/types";
import { ToastWithId } from "@/components/Toaster";

export type AppState = {
    authStatus: AuthStatus;
    userProfile?: pxt.auth.UserProfile;
    netState: NetState;
    collabInfo?: CollabInfo;
    modalType?: ModalType;
    modalOptions?: ModalOptions;
    toasts: ToastWithId[];
    opts: Map<string, string>;
};

export type NetState = {
    clientRole: ClientRole;
    clientId?: string;
    joinCode?: string;
    shareCode?: string;
    platoExtVersion?: number;
};

export const initialNetState = (clientRole: ClientRole): NetState => ({
    clientRole,
});

export const initialAppState: AppState = {
    authStatus: "unknown",
    netState: initialNetState("none"),
    toasts: [],
    opts: new Map<string, string>(),
};
