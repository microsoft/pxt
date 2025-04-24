import { ActionBase, ClientRole, ModalOptions, NetMode, CollabInfo, Presence } from "@/types";
import { ToastWithId } from "@/components/Toaster";

/**
 * Action Types
 */

type SetUserProfile = ActionBase<"SET_USER_PROFILE", { profile?: pxt.auth.UserProfile }>;
type SetClientRole = ActionBase<"SET_CLIENT_ROLE", { clientRole?: ClientRole }>;
type SetNetMode = ActionBase<"SET_NET_MODE", { mode: NetMode }>;
type SetCollabInfo = ActionBase<"SET_COLLAB_INFO", { collabInfo: CollabInfo }>;
type ShowToast = ActionBase<"SHOW_TOAST", { toast: ToastWithId }>;
type DismissToast = ActionBase<"DISMISS_TOAST", { toastId: string }>;
type ShowModal = ActionBase<"SHOW_MODAL", { modalOptions: ModalOptions }>;
type DismissModal = ActionBase<"DISMISS_MODAL">;
type SetPresence = ActionBase<"SET_PRESENCE", { presence: Presence }>;

/**
 * All Actions
 */

export type Action =
    | SetUserProfile
    | SetClientRole
    | SetNetMode
    | SetCollabInfo
    | ShowToast
    | DismissToast
    | ShowModal
    | DismissModal
    | SetPresence;

/**
 * Action Creators
 */

export const setUserProfile = (profile?: pxt.auth.UserProfile): SetUserProfile => ({
    type: "SET_USER_PROFILE",
    payload: { profile },
});
export const setClientRole = (clientRole?: ClientRole): SetClientRole => ({
    type: "SET_CLIENT_ROLE",
    payload: { clientRole },
});
export const setNetMode = (mode: NetMode): SetNetMode => ({
    type: "SET_NET_MODE",
    payload: { mode },
});
export const setCollabInfo = (collabInfo: CollabInfo): SetCollabInfo => ({
    type: "SET_COLLAB_INFO",
    payload: { collabInfo },
});
export const showToast = (toast: ToastWithId): ShowToast => ({
    type: "SHOW_TOAST",
    payload: { toast },
});
export const dismissToast = (toastId: string): DismissToast => ({
    type: "DISMISS_TOAST",
    payload: { toastId },
});
export const showModal = (modalOptions: ModalOptions): ShowModal => ({
    type: "SHOW_MODAL",
    payload: { modalOptions },
});
export const dismissModal = (): DismissModal => ({
    type: "DISMISS_MODAL",
    payload: {},
});
export const setPresence = (presence: Presence): SetPresence => ({
    type: "SET_PRESENCE",
    payload: { presence },
});
