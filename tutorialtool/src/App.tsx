import { useEffect, useContext, useState } from "react";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks/usePromise";
import { downloadTargetConfigAsync } from "pxtservices/backendRequests";
import { logDebug } from "pxtservices/loggingService";
import { HeaderBar } from "./components/HeaderBar";
import { setTargetConfig } from "./state/actions";
import { EditorPanel } from "./components/EditorPanel";

export const App = () => {
    const { state, dispatch } = useContext(AppStateContext);
    const [inited, setInited] = useState(false);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        if (ready && !inited) {
            (async () => {
                logDebug("App is ready, initializing...");

                const cfg = await downloadTargetConfigAsync();
                dispatch(setTargetConfig(cfg || {}));
                pxt.BrowserUtils.initTheme();

                setInited(true);
                logDebug("App initialized");
            })();
        }
    }, [ready, inited]);

    return !inited ? (
        <div className="ui active dimmer">
            <div className="ui large main loader msft"></div>
        </div>
    ) : (
        <>
            <HeaderBar />
            <EditorPanel />
        </>
    );
};
