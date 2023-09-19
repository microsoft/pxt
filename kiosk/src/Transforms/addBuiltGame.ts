import { stateAndDispatch } from "../State";
import { BuiltSimJSInfo } from "../Types";
import * as Actions from "../State/Actions";

export function addBuiltGame(gameId: string, builtSimJs: BuiltSimJSInfo) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.addBuiltGame(gameId, builtSimJs));
}
