import { useEffect, useContext, useState } from "react";
// eslint-disable-next-line import/no-unassigned-import
import "./teacherTool.css";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks";
import HeaderBar from "./components/HeaderBar";
import Notifications from "./components/Notifications";
import * as NotificationService from "./services/notificationService";
import { postNotification } from "./transforms/postNotification";
import { makeNotification } from "./utils";
import { MakeCodeFrame } from "./components/makecodeFrame";
import { isLocal, getEditorUrl } from "./utils/browserUtils";
import DebugInput from "./components/DebugInput";


function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const [didNotify, setDidNotify] = useState(false);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        // Init subsystems.
        NotificationService.initialize();
    }, [ready]);

    // Test notification
    useEffect(() => {
        if (ready && !didNotify) {
            postNotification(makeNotification("🎓", 2000));
            setDidNotify(true);
        }
    }, [ready]);

    const onIframeLoaded = () => {
        console.log("iframe loaded");
    }

    const onIframeClosed = () => {
        console.log("iframe closed");
    }

    const createIFrameUrl = (): string => {
        const editorUrl: string = isLocal() ? "http://localhost:3232/index.html#editor" : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl);

        let url = editorUrl
        if (editorUrl.charAt(editorUrl.length - 1) === "/" && !isLocal()) {
            url = editorUrl.substr(0, editorUrl.length - 1);
        }
        url += `?controller=1&ws=browser&nocookiebanner=1`;
        return url;
    }

    return (
        <>
            <HeaderBar />
            <div className="appContainer">
                <DebugInput />
            </div>
            <Notifications />
            <MakeCodeFrame pageSourceUrl={createIFrameUrl()}
                onFrameOpen={onIframeLoaded}
                onFrameClose={onIframeClosed}
            />
        </>
    );
}

export default App;
