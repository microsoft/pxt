import { stateAndDispatch } from "@/state";
import { setNetState } from "@/state/actions";

export function setPlatoExtInfo(version: number) {
    const { state, dispatch } = stateAndDispatch();
    const { netState } = state;
    dispatch(setNetState({ ...netState, platoExtVersion: version }));
}
