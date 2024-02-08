import { ErrorCode } from "../types/errorCode";
import { logError } from "./loggingService";

const KEY_PREFIX = "teachertool";
const AUTORUN_KEY = [KEY_PREFIX, "autorun"].join("/");
const LAST_ACTIVE_RUBRIC_KEY = [KEY_PREFIX, "lastActiveRubric"].join("/");

function getValue(key: string, defaultValue?: string): string | undefined {
    return localStorage.getItem(key) || defaultValue;
}

function setValue(key: string, val: string) {
    localStorage.setItem(key, val);
}

function delValue(key: string) {
    localStorage.removeItem(key);
}

export function getAutorun(): boolean {
    try {
        return getValue(AUTORUN_KEY, "false") === "true";
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return false;
    }
}

export function setAutorun(autorun: boolean) {
    try {
        setValue(AUTORUN_KEY, autorun.toString());
    } catch (e) {
        logError(ErrorCode.localStorageWriteError, e);
    }
}

export function getLastActiveRubricName(): string {
    try {
        return getValue(LAST_ACTIVE_RUBRIC_KEY) ?? "";
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return "";
    }
}

export function setLastActiveRubricName(name: string) {
    try {
        setValue(LAST_ACTIVE_RUBRIC_KEY, name);
    } catch (e) {
        logError(ErrorCode.localStorageWriteError, e);
    }
}
