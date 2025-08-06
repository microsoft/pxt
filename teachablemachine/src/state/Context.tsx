import React, { createContext, useEffect, useReducer } from "react";
import { AppState, initialAppState } from "./state";
import { Action } from "./actions";
import { reducer } from "./reducer";

let state: AppState;
let dispatch: React.Dispatch<Action>;

let initializationComplete: () => void;

// This promise will resolve when the app state is initialized and available outside the React context.
export const AppStateReady: Promise<boolean> = new Promise(resolve => {
    initializationComplete = () => resolve(true);
});

// Never cache `state` and `dispatch`. They can and will be updated frequently.
export function stateAndDispatch(context?: AppStateContextProps): AppStateContextProps {
    if (!(state && dispatch)) throw new Error("AppStateContext not ready");
    if (context) return context;
    return { state, dispatch };
}

export type AppStateContextProps = {
    state: AppState;
    dispatch: React.Dispatch<Action>;
};

const initialAppStateContextProps: AppStateContextProps = {
    state: undefined!,
    dispatch: undefined!,
};

export const AppStateContext = createContext<AppStateContextProps>(initialAppStateContextProps);

const _initialAppState: AppState = {
    ...initialAppState,
    opts: (() => {
        const params = new URLSearchParams(window.location.search);
        const opts = new Map<string, string>();
        for (const [key, value] of params.entries()) {
            opts.set(key, value);
        }
        return opts;
    })(),
};

export function AppStateProvider(props: React.PropsWithChildren<{}>): React.ReactElement {
    // Read the URL parameters and set the initial state accordingly

    // Create the application state and state change mechanism (dispatch)
    const [state_, dispatch_] = useReducer(reducer, _initialAppState);

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