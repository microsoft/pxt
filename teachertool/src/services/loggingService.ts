import { isLocal } from "../utils";

const formatMessageForConsole = (message: string) => {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] ${message}`;
}

const formatName = (name: string) => {
    return name.toLowerCase().replace(/ /g, "_");
}

export const logError = (name: string, details: string) => {
    pxt.tickEvent("teachertool.error", { name: formatName(name), message: details });
    console.error(formatMessageForConsole(`${name}: ${details}`));
}

export const logInfo = (name: string, message: string) => {
    pxt.tickEvent(`teachertool.${formatName(name)}`, { message: message });
    console.log(formatMessageForConsole(message));
}

export const logDebug = (message: string) => {
    if (isLocal()) {
        console.log(formatMessageForConsole(message));
    }
}