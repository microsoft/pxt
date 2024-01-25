import { ErrorName } from "../types/errorName";

const formatMessageForConsole = (message: string) => {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] ${message}`;
}

export const logError = (name: ErrorName, details: string, data: pxt.Map<string | number> = {}) => {
    let callstack = "";
    try {
        throw new Error();
    } catch (e) {
        callstack = (e as Error).stack ?? "";
    }

    pxt.tickEvent("teachertool.error", { ...data, name: name, message: details, callstack: callstack });
    console.error(formatMessageForConsole(`${name}: '${details}'\nData: ${JSON.stringify(data)}\nCallstack: ${callstack}`));
}

export const logInfo = (message: string) => {
    console.log(formatMessageForConsole(message));
}

export const logDebug = (message: string) => {
    if (pxt.BrowserUtils.isLocalHost() || pxt.options.debug) {
        console.log(formatMessageForConsole(message));
    }
}