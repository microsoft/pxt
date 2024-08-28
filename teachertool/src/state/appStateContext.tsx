import React, { createContext, useEffect, useReducer } from "react";
import { AppState, initialAppState } from "./state";
import { Action } from "./actions";
import reducer from "./reducer";
import assert from "assert";
import { getRunOnLoad } from "../services/storageService";

const DEV_BACKEND_LOCALHOST = "http://localhost:8080";

// Read the URL parameters and set the initial state accordingly
const url = window.location.href;
const testCatalog = !!/testcatalog(?:[:=])1/.test(url) || !!/tc(?:[:=])1/.test(url);

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

export const AppStateContext = createContext<AppStateContextProps>(initialAppStateContextProps);

export function AppStateProvider(props: React.PropsWithChildren<{}>): React.ReactElement {
    // Create the application state and state change mechanism (dispatch)
    const [state_, dispatch_] = useReducer(reducer, {
        ...initialAppState,
        runOnLoad: getRunOnLoad(),
        flags: {
            ...initialAppState.flags,
            testCatalog: testCatalog,
        },
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
