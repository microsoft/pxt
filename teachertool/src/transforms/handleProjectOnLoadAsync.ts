import { Ticks } from "../constants";
import { stateAndDispatch } from "../state";
import { loadChecklistAsync } from "./loadChecklistAsync";
import { loadProjectMetadataAsync } from "./loadProjectMetadataAsync";
import { setActiveTab } from "./setActiveTab";

/**
 * The user may use optional URL parameters to specify a default project to load when opening the eval tool.
 * This function handles loading that project and the additional on-load behavior that occurs as a result.
 */
export async function handleProjectOnLoadAsync(defaultChecklistUrl?: string | undefined): Promise<void> {
    const { state } = stateAndDispatch();

    const projectParam = window.location.href.match(/project=([^&]+)/)?.[1];
    if (!!projectParam) {
        const decoded = decodeURIComponent(projectParam);
        const shareId = pxt.Cloud.parseScriptId(decoded);
        if (!!shareId) {
            pxt.tickEvent(Ticks.LoadProjectFromUrl);
            await loadProjectMetadataAsync(decoded, shareId);

            // If the user does not already have a checklist loaded, load a default.
            const hasExistingChecklist = state.checklist && state.checklist.criteria?.length > 0;
            if (defaultChecklistUrl && !hasExistingChecklist) {
                await loadChecklistAsync(defaultChecklistUrl);
            }

            // Switch to the results tab.
            setActiveTab("results");
        }
    }
}
