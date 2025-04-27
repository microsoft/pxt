import { stateAndDispatch } from "@/state";
import { setNetState } from "@/state/actions";

export function connected(clientId: string) {
    const { dispatch } = stateAndDispatch();
    dispatch(setNetState({ clientId }));
}
