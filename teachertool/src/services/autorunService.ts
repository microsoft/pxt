import { stateAndDispatch } from "../state";
import { isProjectLoaded } from "../state/helpers";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";

let autorunTimer: NodeJS.Timeout | null = null;

function runEvaluation(inBackground: boolean) {
    autorunTimer = null;
    const { state } = stateAndDispatch();
    if (state.autorun && isProjectLoaded(state)) {
        runEvaluateAsync(inBackground ? "autorun-background" : "autorun-visible");
    }
}

export function poke(immediate?: boolean) {
    if (autorunTimer) {
        clearTimeout(autorunTimer);
    }

    if (immediate) {
        runEvaluation(false);
    } else {
        autorunTimer = setTimeout(() => runEvaluation(true), 1000);
    }
}
