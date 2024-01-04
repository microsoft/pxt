import { isLocal } from "../utils";

export enum LogSeverity {
    Error,
    Info,
    Debug
}

const formatMessageForConsole = (message: string) => {
    return `[${new Date().toISOString()}] ${message}`;
}

const formatName = (name: string) => {
    return name.toLowerCase().replace(/ /g, "_");
}

const logError = (name: string, message: string) => {
    if (!isLocal()) {
        pxt.tickEvent("teachertool.error", { name: name, message: message });
    }
    console.error(formatMessageForConsole(message));
}

const logInfo = (name: string, message: string) => {
    pxt.tickEvent(`teachertool.${formatName(name)}`, { message: message });
    console.log(formatMessageForConsole(message));
}

const logDebug = (name: string, message: string) => {
    if (isLocal()) {
        console.log(`${formatMessageForConsole(`${name}: ${message}`)}`);
    }
}

export const log = (name: string, message: string, severity: LogSeverity) => {
    switch (severity) {
        case LogSeverity.Error:
            logError(name, message);
            break;
        case LogSeverity.Info:
            logInfo(name, message);
            break;
        case LogSeverity.Debug:
            logDebug(name, message);
            break;
    }
}