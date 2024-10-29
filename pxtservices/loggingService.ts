let tickEvent = "pxt.error";

const timestamp = () => {
    const time = new Date();
    const hours = padTime(time.getHours());
    const minutes = padTime(time.getMinutes());
    const seconds = padTime(time.getSeconds());

    return `[${hours}:${minutes}:${seconds}]`;
};

const padTime = (time: number) => ("0" + time).slice(-2);

export const logError = (errorCode: string, message?: any, data: pxt.Map<string | number> = {}) => {
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
    pxt.tickEvent(tickEvent, {
        ...dataObj,
        errorCode,
    });
    pxt.error(timestamp(), errorCode, dataObj);
};

export const logInfo = (message: any) => {
    pxt.log(timestamp(), message);
};

export const logDebug = (message: any, data?: any) => {
    if (pxt.BrowserUtils.isLocalHost() || pxt.options.debug) {
        pxt.log(timestamp(), message, data);
    }
};


export const setTickEvent = (event: string) => {
    tickEvent = event;
}