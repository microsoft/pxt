import { nanoid } from "nanoid";
import { NotificationWithId } from "../types";

export function makeNotification(
    message: string,
    duration: number
): NotificationWithId {
    return {
        id: nanoid(),
        message,
        duration,
        expiration: Date.now() + duration,
    };
}

export const isLocal = () => {
    return window.location.hostname === "localhost";
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
}

export const createIFrameUrl = (shareId: string): string => {
    const editorUrl: string = isLocal() ? "http://localhost:3232/index.html#editor" : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl);

    let url = editorUrl;
    if (editorUrl.charAt(editorUrl.length - 1) === "/" && !isLocal()) {
        url = editorUrl.substr(0, editorUrl.length - 1);
    }
    url += `?controller=1&ws=browser&nocookiebanner=1#pub:${shareId}`;
    return url;
}
