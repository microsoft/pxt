import { logError } from "../services/loggingService";
import { AppState } from "../state/state";
import { ErrorCode } from "../types/errorCode";

export function getSystemParameter(keyword: string, state: AppState): string | undefined {
    switch (keyword) {
        case "SHAREID":
            return state.projectMetadata?.id;
        case "TARGET":
            return state.projectMetadata?.target;
        default:
            logError(ErrorCode.unrecognizedSystemParameter, "Unrecognized system parameter", { keyword });
            return undefined;
    }
};
