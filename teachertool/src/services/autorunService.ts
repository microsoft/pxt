import { stateAndDispatch } from "../state";
import { isProjectLoaded } from "../state/helpers";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";

let autorunTimer: NodeJS.Timeout | null = null;

export function poke() {
    if (autorunTimer) {
        clearTimeout(autorunTimer);
    }
    autorunTimer = setTimeout(() => {
        autorunTimer = null;
        const { state } = stateAndDispatch();
        if (state.autorun && isProjectLoaded(state)) {
            runEvaluateAsync(false);
        }
    }, 1000);
}
