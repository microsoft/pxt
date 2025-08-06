import { AppState } from "./state";
import { Action } from "./actions";

export function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_FOO":
            return {
                ...state,
                foo: action.payload.foo,
            };
        case "SET_BAR":
            return {
                ...state,
                bar: action.payload.bar,
            };
    }
}
