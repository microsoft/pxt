import { MakeCodeFrame } from "./MakecodeFrame";
import { isLocal, getEditorUrl } from "../utils";

const createIFrameUrl = (): string => {
    const editorUrl: string = isLocal() ? "http://localhost:3232/index.html#editor" : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl);

    let url = editorUrl
    if (editorUrl.charAt(editorUrl.length - 1) === "/" && !isLocal()) {
        url = editorUrl.substr(0, editorUrl.length - 1);
    }
    url += `?controller=1&ws=browser&nocookiebanner=1`;
    return url;
}

export const EditorContainer: React.FC<{}> = () => {
    const onIframeLoaded = () => {
        console.log("iframe loaded");
    }

    const onIframeClosed = () => {
        console.log("iframe closed");
    }

    return (
        <MakeCodeFrame pageSourceUrl={createIFrameUrl()}
            onFrameOpen={onIframeLoaded}
            onFrameClose={onIframeClosed}
        />
    )

}

