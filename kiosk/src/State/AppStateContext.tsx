import React, { createContext, useEffect, useReducer } from "react";
import { AppState, initialAppState } from "./State";
import { Action } from "./Actions";
import reducer from "./Reducer";
import configData from "../config.json";
import assert from "assert";

let state: AppState;
let dispatch: React.Dispatch<Action>;

let initializationComplete: () => void;

// This promise will resolve when the app state is initialized and available outside the React context.
export const AppStateReady: Promise<boolean> = new Promise(resolve => {
    initializationComplete = () => resolve(true);
});

// Never cache `state` and `dispatch`. They can and will be updated frequently.
export const stateAndDispatch = () => {
    assert(state && dispatch, "AppStateContext not ready");
    return { state, dispatch };
};

type AppStateContextProps = {
    state: AppState;
    dispatch: React.Dispatch<Action>;
};

const initialAppStateContextProps: AppStateContextProps = {
    state: undefined!,
    dispatch: undefined!,
};

export const AppStateContext = createContext<AppStateContextProps>(
    initialAppStateContextProps
);

export function AppStateProvider(
    props: React.PropsWithChildren<{}>
): React.ReactElement {
    // Read the URL parameters and set the initial state accordingly
    const url = window.location.href;
    const clean = !!/clean(?:[:=])1/.test(url);
    const locked = !!/locke?d?(?:[:=])1/i.test(url);
    const time = /time=((?:[0-9]{1,3}))/i.exec(url)?.[1];
    const volumeStr = /volume=(1\.?0?|0?\.\d{1,2}|\.\d{1,2})/i.exec(url)?.[1];
    const volume = volumeStr
        ? parseFloat(volumeStr)
        : configData.SoundEffectsVolume;

    // Create the application state and state change mechanism (dispatch)
    const [state_, dispatch_] = useReducer(reducer, {
        ...initialAppState,
        clean,
        locked,
        time,
        volume,
    });

    // Make state and dispatch available outside the React context
    useEffect(() => {
        state = state_;
        dispatch = dispatch_;
        initializationComplete();
    }, [state_, dispatch_]);

    return (
        // Provide current state and dispatch mechanism to all child components
        <AppStateContext.Provider
            value={{
                state: state_,
                dispatch: dispatch_,
            }}
        >
            {props.children}
        </AppStateContext.Provider>
    );
}
