import { ErrorCode } from "../types/errorCode";
import { Ticks } from "../constants";

const MAX_DEBUG_LOGS = 100;
enum LogType {
    error = 0,
    info = 1,
    debug = 2
}
type TypedLog = { type: LogType };
const logHistory: TypedLog[] = [];
const addLogToHistory = (type: LogType, log: any) => {
    const typedLog = { ...log, type };
    logHistory.push(typedLog);

    if (logHistory.length > MAX_DEBUG_LOGS) {
        logHistory.shift();
    }
}

const timestamp = () => {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}]`;
};

export function initLoggingService() {
    // This creates a function you can call inside the browser console to view the saved logs.
    (window as any).codeEvalLogHistory = function(level: LogType) {
        for (const log of logHistory) {
            if (log.type <= level) {
                console.log(log);
            }
        }
    }
}

export const logError = (errorCode: ErrorCode, message?: any, data: pxt.Map<string | number> = {}) => {
    let dataObj = { ...data };
    if (message) {
        if (typeof message === "object") {
            dataObj = { ...dataObj, ...message };
            // Look for non-enumerable properties found on Error objects
            ["message", "stack", "name"].forEach(key => {
                if (message[key]) {
                    dataObj[key] = message[key];
                }
            });
        } else {
            dataObj.message = message;
        }
    }
    pxt.tickEvent(Ticks.Error, {
        ...dataObj,
        errorCode,
    });
    const time = timestamp();
    console.error(time, errorCode, dataObj);
    addLogToHistory(LogType.error, {time, errorCode, dataObj});
};

export const logInfo = (message: any) => {
    const time = timestamp();
    console.log(time, message);
    addLogToHistory(LogType.info, {time, message});
};

export const logDebug = (message: any, data?: any) => {
    const time = timestamp();
    if (pxt.BrowserUtils.isLocalHost() || pxt.options.debug) {
        console.log(timestamp(), message, data);
    }
    addLogToHistory(LogType.debug, {time, message, data});
};
