import React, { createContext, useEffect, useReducer } from "react";
import { AppState, initialAppState } from "./state";
import { Action } from "./actions";
import reducer from "./reducer";

// Never cache these values. They can and will be updated frequently.
export let state: AppState;
export let dispatch: React.Dispatch<Action>;

export type AppStateContextProps = {
    state: AppState;
    dispatch: React.Dispatch<Action>;
};

const initialAppStateContextProps: AppStateContextProps = {
    state: undefined!,
    dispatch: undefined!,
};

export const AppStateContext = createContext<AppStateContextProps>(initialAppStateContextProps);

export type AppStateProviderProps = {
    // This is where the app would inject any initial state at startup
};

export function AppStateProvider(props: React.PropsWithChildren<AppStateProviderProps>): React.ReactElement {
    // Create the application state and state change mechanism (dispatch)
    const [state_, dispatch_] = useReducer(reducer, initialAppState);

    useEffect(() => {
        // Make state and dispatch available outside the React context
        state = state_;
        dispatch = dispatch_;
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
