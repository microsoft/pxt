import * as fs from 'fs';
import { stateAndDispatch } from "../state";
import { logError } from '../services/loggingService';
import { ErrorCode } from '../types/errorCode';
import { CriteriaInstance } from '../types/criteria';

// Serializes the active rubric and writes it to the given file path.
// Returns true if the file was written successfully, false otherwise.
export async function writeActiveRubricToFileAsync(path: string): Promise<boolean> {
    const { state: teacherTool } = stateAndDispatch();

    if (!teacherTool.selectedCriteria || teacherTool.selectedCriteria.length === 0) {
        return false;
    }

    // Write content to the given path on disk.
    const rubricJson = JSON.stringify(teacherTool.selectedCriteria);

    try {
        await fs.promises.writeFile(path, rubricJson, 'utf8');
        return true;
    } catch (error) {
        logError(ErrorCode.unableToSaveRubric, error);
        return false;
    }
}

export async function loadRubricFromFileAsync(path: string): Promise<CriteriaInstance[] | undefined> {
    let rubric: CriteriaInstance[] | undefined = undefined;
    try {
        const rubricJson = await fs.promises.readFile(path, 'utf8');
        rubric = JSON.parse(rubricJson) as CriteriaInstance[];
    } catch (error) {
        logError(ErrorCode.unableToLoadRubric, error);
    }
    return rubric;
}