import { createContext, Dispatch } from "react";
import { ImageEditorStore } from "./state";
import { Action } from "./actions";

let state: ImageEditorStore;
let dispatch: Dispatch<Action>;

let initializationComplete: () => void;

// This promise will resolve when the app state is initialized and available outside the React context.
export const AppStateReady: Promise<boolean> = new Promise(resolve => {
    initializationComplete = () => resolve(true);
});

// Never cache `state` and `dispatch`. They can and will be updated frequently.
export const stateAndDispatch = () => {
    return { state, dispatch };
};

type ImageEditorContextProps = {
    state: ImageEditorStore;
    dispatch: Dispatch<Action>;
};

const initialAppStateContextProps: ImageEditorContextProps = {
    state: undefined!,
    dispatch: undefined!,
};

export const _useStateAndDispatch = (state_: ImageEditorStore, dispatch_: Dispatch<Action>) => {
    state = state_;
    dispatch = dispatch_;
    initializationComplete();
}

export const ImageEditorContext = createContext<ImageEditorContextProps>(initialAppStateContextProps);
