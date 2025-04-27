import { ActionBase, ModalOptions, CollabInfo, Presence } from "@/types";
import { ToastWithId } from "@/components/Toaster";
import { NetState } from "./state";

/**
 * Action Types
 */

type SetUserProfile = ActionBase<"SET_USER_PROFILE", { profile?: pxt.auth.UserProfile }>;
type ShowToast = ActionBase<"SHOW_TOAST", { toast: ToastWithId }>;
type DismissToast = ActionBase<"DISMISS_TOAST", { toastId: string }>;
type DismissAllToasts = ActionBase<"DISMISS_ALL_TOASTS">;
type ShowModal = ActionBase<"SHOW_MODAL", { modalOptions: ModalOptions }>;
type DismissModal = ActionBase<"DISMISS_MODAL">;
type SetNetState = ActionBase<"SET_NET_STATE", { netState?: Partial<NetState> }>;
type SetPresence = ActionBase<"SET_PRESENCE", { presence: Presence }>;

/**
 * All Actions
 */

export type Action =
    | SetUserProfile
    | ShowToast
    | DismissToast
    | DismissAllToasts
    | ShowModal
    | DismissModal
    | SetNetState
    | SetPresence;

/**
 * Action Creators
 */

export const setUserProfile = (profile?: pxt.auth.UserProfile): SetUserProfile => ({
    type: "SET_USER_PROFILE",
    payload: { profile },
});
export const showToast = (toast: ToastWithId): ShowToast => ({
    type: "SHOW_TOAST",
    payload: { toast },
});
export const dismissToast = (toastId: string): DismissToast => ({
    type: "DISMISS_TOAST",
    payload: { toastId },
});
export const dismissAllToasts = (): DismissAllToasts => ({
    type: "DISMISS_ALL_TOASTS",
    payload: {},
});
export const showModal = (modalOptions: ModalOptions): ShowModal => ({
    type: "SHOW_MODAL",
    payload: { modalOptions },
});
export const dismissModal = (): DismissModal => ({
    type: "DISMISS_MODAL",
    payload: {},
});
export const setNetState = (netState: Partial<NetState> | undefined): SetNetState => ({
    type: "SET_NET_STATE",
    payload: { netState },
});
export const setPresence = (presence: Presence): SetPresence => ({
    type: "SET_PRESENCE",
    payload: { presence },
});
