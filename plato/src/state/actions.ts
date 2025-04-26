import { ActionBase, ClientRole, ModalOptions, NetMode, CollabInfo, Presence } from "@/types";
import { ToastWithId } from "@/components/Toaster";
import { ViewState } from "./state";

/**
 * Action Types
 */

type SetUserProfile = ActionBase<"SET_USER_PROFILE", { profile?: pxt.auth.UserProfile }>;
type SetNetMode = ActionBase<"SET_NET_MODE", { mode: NetMode }>;
type SetCollabInfo = ActionBase<"SET_COLLAB_INFO", { collabInfo: CollabInfo }>;
type ShowToast = ActionBase<"SHOW_TOAST", { toast: ToastWithId }>;
type DismissToast = ActionBase<"DISMISS_TOAST", { toastId: string }>;
type ShowModal = ActionBase<"SHOW_MODAL", { modalOptions: ModalOptions }>;
type DismissModal = ActionBase<"DISMISS_MODAL">;
type SetViewState = ActionBase<"SET_VIEW_STATE", { viewState?: ViewState }>;
type SetPresence = ActionBase<"SET_PRESENCE", { presence: Presence }>;

/**
 * All Actions
 */

export type Action =
    | SetUserProfile
    | SetNetMode
    | SetCollabInfo
    | ShowToast
    | DismissToast
    | ShowModal
    | DismissModal
    | SetViewState
    | SetPresence;

/**
 * Action Creators
 */

export const setUserProfile = (profile?: pxt.auth.UserProfile): SetUserProfile => ({
    type: "SET_USER_PROFILE",
    payload: { profile },
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
export const setViewState = (viewState: ViewState | undefined): SetViewState => ({
    type: "SET_VIEW_STATE",
    payload: { viewState },
});
export const setPresence = (presence: Presence): SetPresence => ({
    type: "SET_PRESENCE",
    payload: { presence },
});
