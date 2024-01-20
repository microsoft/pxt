const formatMessageForConsole = (message: string) => {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] ${message}`;
}

const formatName = (name: string) => {
    return name.toLowerCase().replace(/ /g, "_");
}

export const logError = (name: string, details: string, props: pxt.Map<string | number> = {}) => {
    pxt.tickEvent("teachertool.error", { ...props, name: formatName(name), message: details });
    console.error(formatMessageForConsole(`${name}: '${details}' Props: ${JSON.stringify(props)}`));
}

export const logInfo = (message: string) => {
    console.log(formatMessageForConsole(message));
}

export const logDebug = (message: string) => {
    if (pxt.BrowserUtils.isLocalHost() || pxt.options.debug) {
        console.log(formatMessageForConsole(message));
    }
}