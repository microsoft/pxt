import { useEffect, useContext, useState } from "react";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks/usePromise";
import * as Actions from "./state/actions";
import { downloadTargetConfigAsync } from "./services/backendRequests";
import { logDebug } from "./services/loggingService";
import { HeaderBar } from "./components/HeaderBar";

export const App = () => {
    const { state, dispatch } = useContext(AppStateContext);
    const [inited, setInited] = useState(false);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        if (ready && !inited) {
            Promise.resolve().then(async () => {
                const cfg = await downloadTargetConfigAsync();
                dispatch(Actions.setTargetConfig(cfg || {}));
                pxt.BrowserUtils.initTheme();

                setInited(true);
                logDebug("App initialized");
            });
        }
    }, [ready, inited]);

    return !inited ? (
        <div className="ui active dimmer">
            <div className="ui large main loader msft"></div>
        </div>
    ) : (
        <>
            <HeaderBar />
        </>
    );
};
