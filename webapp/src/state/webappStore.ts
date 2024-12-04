import * as data from "../data";
import * as auth from "../auth";
import { Action } from "./action";
import { ChangeListener, createStore, getSubscribePath, subscribeToStore } from "./dataStore";
import { reducer } from "./reducer";
import { IAppState } from "./state";
import { getHeader } from "../workspace";

export const [getStore, dispatch] = createStore<IAppState, Action>({
    // showFiles: false,
    // home: shouldShowHomeScreen,
    // active: document.visibilityState == 'visible' || pxt.BrowserUtils.isElectron() || pxt.appTarget.appTheme.dontSuspendOnVisibility,
    // don't start collapsed in mobile since we can go fullscreen now
    // collapseEditorTools: pxt.appTarget.simulator.headless,
    // simState: pxt.editor.SimState.Stopped,
    // autoRun: this.autoRunOnStart(),
    // isMultiplayerGame: false,
    // onboarding: undefined,
    mute: pxt.editor.MuteState.Unmuted,
}, reducer);

export function onWebappStoreChange(onChange: ChangeListener<IAppState, keyof IAppState>, field?: keyof IAppState): () => void {
    return subscribeToStore(getStore(), onChange as any, field);
}

export class WebappDataComponent<TProps, TState> extends data.Component<TProps, TState> {
    getWebappState<U extends keyof IAppState>(field: U): IAppState[U] {
        const state = data.getCached(this, getSubscribePath(getStore(), field));

        return state.data;
    }

    getHeader() {
        const headerId = this.getWebappState("headerId");
        return headerId && getHeader(headerId);
    }
}

export class WebappAuthComponent<TProps, TState> extends auth.Component<TProps, TState> {
    getWebappState<U extends keyof IAppState>(field: U): IAppState[U] {
        const state = data.getCached(this, getSubscribePath(getStore(), field));

        return state.data;
    }

    getHeader() {
        const headerId = this.getWebappState("headerId");
        return headerId && getHeader(headerId);
    }
}