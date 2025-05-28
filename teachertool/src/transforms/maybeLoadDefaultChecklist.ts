import { stateAndDispatch } from "../state";
import { loadChecklistAsync } from "./loadChecklistAsync";

/**
 * Check if a default checklist is specified in targetconfig and load it only if it exists and there is not
 * already an active checklist.
 */
export async function maybeLoadDefaultChecklistAsync(config: pxt.TargetConfig | undefined = undefined): Promise<void> {
    const { state } = stateAndDispatch();

    // Caller may optionally pass in target config (in case it has not been loaded into state yet).
    if (!config) {
        config = state.targetConfig;
    }

    if (state.checklist && state.checklist.criteria?.length > 0) return; // Already an active checklist

    const checklistUrl = config?.teachertool?.defaultChecklistUrl;
    if (!checklistUrl) return; // No default checklist specified in targetconfig

    await loadChecklistAsync(checklistUrl);
}
