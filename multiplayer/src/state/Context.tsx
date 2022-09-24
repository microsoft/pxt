import React, { createContext, useCallback, useEffect, useReducer, useState } from "react";
import { AppState, initialAppState } from "./state";
import { Action } from "./actions";
import reducer from "./reducer";
import { GameClient } from "../services/gameClient";

export let dispatch: React.Dispatch<Action>;

export type AppStateContextProps = {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    game: GameClient | undefined;
    hostGameAsync: (shareLink: string) => Promise<void>;
    joinGameAsync: (joinCode: string) => Promise<void>;
};

const initialAppStateContextProps: AppStateContextProps = {
    state: undefined!,
    dispatch: undefined!,
    game: undefined,
    hostGameAsync: undefined!,
    joinGameAsync: undefined!,
};

export const AppStateContext = createContext<AppStateContextProps>(initialAppStateContextProps);

export type AppStateProviderProps = {
    // This is where the app would inject any initial state at startup
};

export function AppStateProvider(props: React.PropsWithChildren<AppStateProviderProps>): React.ReactElement {
    // Create the application state and state change mechanism (dispatch)
    const [state, _dispatch] = useReducer(reducer, initialAppState);
    const [game, setGame] = useState(undefined);

    useEffect(() => {
        // Make dispatch available outside the React context
        dispatch = _dispatch;
    }, [_dispatch]);

    const hostGameAsync = async (shareLink: string) => {
    };

    const joinGameAsync = async (joinCode: string) => {
    };

    return (
        // Provide current state and dispatch mechanism to all child components
        <AppStateContext.Provider
            value={{
                state,
                dispatch: _dispatch,
                game,
                hostGameAsync,
                joinGameAsync,
            }}
        >
            {props.children}
        </AppStateContext.Provider>
    );
}
