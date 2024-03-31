import { createContext, useEffect, useReducer } from "react";
import { CollabState, initialState } from "./state";
import { reducer } from "./reducer";
import { CollabAction } from "./actions";

let state: CollabState;
let dispatch: React.Dispatch<CollabAction>;

export function collabStateAndDispatch() {
    return { state, dispatch };
}

type CollabContextProps = {
    state: CollabState;
    dispatch: React.Dispatch<CollabAction>;
};

const initialCollabContextProps: CollabContextProps = {
    state: undefined!,
    dispatch: undefined!,
};

export const CollabContext = createContext<CollabContextProps>(initialCollabContextProps);

export function CollabStateProvider(props: React.PropsWithChildren<{}>): React.ReactElement {
    // Create the application state and state change mechanism (dispatch)
    const [state_, dispatch_] = useReducer(reducer, initialState);

    useEffect(() => {
        // Make state and dispatch available outside the React context
        state = state_;
        dispatch = dispatch_;
    }, [state_, dispatch_]);

    return (
        // Provide current state and dispatch mechanism to all child components
        <CollabContext.Provider
            value={{
                state: state_,
                dispatch: dispatch_,
            }}
        >
            {props.children}
        </CollabContext.Provider>
    );
}
