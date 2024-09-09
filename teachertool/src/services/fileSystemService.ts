import { logError } from "../services/loggingService";
import { ErrorCode } from "../types/errorCode";
import { Checklist } from "../types/checklist";

// Serializes the active checklist and writes it to a file.
// Returns true if the file was written successfully, false otherwise.
export function writeChecklistToFile(checklist: Checklist): boolean {
    const sanitizedName = checklist.name ? pxt.Util.sanitizeFileName(checklist.name) : "";
    const fileName = `${sanitizedName ? sanitizedName : lf("unnamed-checklist")}.json`;

    // Write content to the given path on disk.
    const checklistJson = JSON.stringify(checklist, null, 4);

    try {
        pxt.BrowserUtils.browserDownloadText(checklistJson, fileName);
        return true;
    } catch (error) {
        logError(ErrorCode.unableToExportChecklist, error);
        return false;
    }
}

export async function loadChecklistFromFileAsync(file: File): Promise<Checklist | undefined> {
    let checklist: Checklist | undefined = undefined;

    try {
        const checklistJson = await pxt.Util.fileReadAsTextAsync(file);
        checklist = JSON.parse(checklistJson) as Checklist;
    } catch (error) {
        logError(ErrorCode.unableToReadChecklistFile, error);
    }
    return checklist;
}
