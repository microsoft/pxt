import { ErrorCode } from "../types/errorCode";

const timestamp = () => {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}]`;
};

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
