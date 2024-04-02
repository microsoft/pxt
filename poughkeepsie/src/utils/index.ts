import { nanoid } from "nanoid";
import { ToastType, ToastWithId } from "../types";
import { classList } from "react-common/components/util";

export function makeToast(type: ToastType, text: string, timeoutMs: number = 5000): ToastWithId {
    return {
        id: nanoid(),
        type,
        text,
        timeoutMs,
    };
}

// example: embedUrl for arcade is: https://arcade.makecode.com/
export const getEditorUrl = (embedUrl: string) => {
    if (!pxt.webConfig && (window as any).pxtConfig) pxt.setupWebConfig((window as any).pxtConfig);
    // relprefix is something like: "/--"
    if (pxt.webConfig?.targetUrl && pxt.webConfig?.relprefix) {
        return pxt.webConfig.targetUrl + pxt.webConfig.relprefix.substr(0, pxt.webConfig.relprefix.length - 3);
    }
    // if  there is something at the end of the url, that is what path would be set to
    // example: https://arcade.makecode.com/abc123 and this would get returned
    const path = /\/([\da-zA-Z\.]+)(?:--)?/i.exec(window.location.pathname);
    return `${embedUrl.replace(/\/$/, "")}/${path?.[1] || ""}`;
};

export function classes(css: { [name: string]: string }, ...names: string[]) {
    return classList(...names.map(n => css[n]));
}

export function getProjectLink(inputText: string): string {
    const hasMakeCode = inputText?.indexOf("makecode") !== -1;
    return hasMakeCode ? inputText : `https://makecode.com/${inputText}`;
}

