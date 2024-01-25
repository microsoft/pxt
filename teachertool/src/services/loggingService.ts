const timestamp = () => {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}]`;
};

const formatName = (name: string) => {
    return name.toLowerCase().replace(/ /g, "_");
};

export const logError = (
    errorCode: string,
    message?: any,
    data: pxt.Map<string | number> = {}
) => {
    errorCode = formatName(errorCode);
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
    pxt.tickEvent("teachertool.error", {
        ...dataObj,
        errorCode,
    });
    console.error(timestamp(), errorCode, dataObj);
};

export const logInfo = (message: any) => {
    console.log(timestamp(), message);
};

export const logDebug = (message: any) => {
    if (pxt.BrowserUtils.isLocalHost() || pxt.options.debug) {
        console.log(timestamp(), message);
    }
};
