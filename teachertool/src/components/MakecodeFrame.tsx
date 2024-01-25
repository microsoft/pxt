/// <reference path="../../../built/pxteditor.d.ts" />
import { useContext } from "react";
import { setEditorRef } from "../services/makecodeEditorService";
import { AppStateContext } from "../state/appStateContext";
import { getEditorUrl } from "../utils";

interface MakeCodeFrameProps {}
export const MakeCodeFrame: React.FC<MakeCodeFrameProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    function createIFrameUrl(shareId: string): string {
        const editorUrl: string = pxt.BrowserUtils.isLocalHost()
            ? "http://localhost:3232/index.html"
            : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl);

        let url = editorUrl;
        if (
            editorUrl.charAt(editorUrl.length - 1) === "/" &&
            !pxt.BrowserUtils.isLocalHost()
        ) {
            url = editorUrl.substr(0, editorUrl.length - 1);
        }
        url += `?controller=1&teachertool=1&readonly=1&ws=mem&nocookiebanner=1#pub:${shareId}`;
        return url;
    }

    const handleIFrameRef = (el: HTMLIFrameElement | null) => {
        setEditorRef(el ?? undefined);
    };

    /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    return (
        <div className="makecode-frame-outer" style={{ display: "block" }}>
            {teacherTool.projectMetadata && (
                <iframe
                    className="makecode-frame"
                    src={createIFrameUrl(teacherTool.projectMetadata.id)}
                    title={"title"}
                    ref={handleIFrameRef}
                />
            )}
        </div>
    );
    /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
};
