import { ErrorCode } from "../types/errorCode";
import { logError } from "./loggingService";

const KEY_PREFIX = "teachertool";
const AUTORUN_KEY = [KEY_PREFIX, "autorun"].join("/");

function getValue(key: string, defaultValue?: string): string | undefined {
    return localStorage.getItem(key) || defaultValue;
}

function setValue(key: string, val: string) {
    localStorage.setItem(key, val);
}

function delValue(key: string) {
    localStorage.removeItem(key);
}

function getJsonValue<T>(key: string, defaultValue?: T): T | undefined {
    var value = getValue(key);
    if (value) {
        return JSON.parse(value);
    }
    return defaultValue;
}

function setJsonValue(key: string, val: any) {
    setValue(key, JSON.stringify(val));
}

function getAutorun(): boolean {
    try {
        return getValue(AUTORUN_KEY, "false") === "true";
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return false;
    }
}

function setAutorun(autorun: boolean) {
    try {
        setValue(AUTORUN_KEY, autorun.toString());
    } catch (e) {
        logError(ErrorCode.localStorageWriteError, e);
    }
}

export { getJsonValue, setJsonValue, getAutorun, setAutorun };
