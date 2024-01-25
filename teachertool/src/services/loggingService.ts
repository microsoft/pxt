const timestamp = () => {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}]`;
};

const formatName = (name: string) => {
    return name.toLowerCase().replace(/ /g, "_");
};

export const logError = (
    name: string,
    message?: any,
    data: pxt.Map<string | number> = {}
) => {
    name = formatName(name);
    pxt.tickEvent("teachertool.error", {
        ...data,
        name,
        message: JSON.stringify(message ?? ""),
    });
    console.error(timestamp(), name, message, data);
};

export const logInfo = (message: any) => {
    console.log(timestamp(), message);
};

export const logDebug = (message: any) => {
    if (pxt.BrowserUtils.isLocalHost() || pxt.options.debug) {
        console.log(timestamp(), message);
    }
};
