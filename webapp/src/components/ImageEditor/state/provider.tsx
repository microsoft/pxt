import { useReducer } from "react";
import { ImageEditorContext, _useStateAndDispatch } from "./context";
import reducer from "./reducer";
import { initialStore } from "./state";

export function ImageEditorStateProvider(props: React.PropsWithChildren<unknown>): React.ReactElement {
    // Create the application state and state change mechanism (dispatch)
    const [state_, dispatch_] = useReducer(reducer, {
        ...initialStore
    });

    // Make state and dispatch available outside the React context
    _useStateAndDispatch(state_, dispatch_);

    return (
        // Provide current state and dispatch mechanism to all child components
        <ImageEditorContext.Provider
            value={{
                state: state_,
                dispatch: dispatch_,
            }}
        >
            {props.children}
        </ImageEditorContext.Provider>
    );
}


export function TileEditorStateProvider(props: React.PropsWithChildren<unknown>): React.ReactElement {
    // Create the application state and state change mechanism (dispatch)
    const [state_, dispatch_] = useReducer(reducer, {
        ...initialStore
    });

    return (
        // Provide current state and dispatch mechanism to all child components
        <ImageEditorContext.Provider
            value={{
                state: state_,
                dispatch: dispatch_,
            }}
        >
            {props.children}
        </ImageEditorContext.Provider>
    );
}
