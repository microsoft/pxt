import { useContext, useMemo } from "react";
import { AppStateContext } from "../State/AppStateContext";
import configData from "../config.json";
import "../Kiosk.css";

export default function PlayingGame() {
    const { state: kiosk, dispatch } = useContext(AppStateContext);
    const { launchedGameId: gameId } = kiosk;

    const playUrl = useMemo(() => {
        if (gameId) {
            const playUrlBase = `${configData.PlayUrlRoot}?id=${gameId}&hideSimButtons=1&noFooter=1&single=1&fullscreen=1&autofocus=1`;
            const playQueryParam = kiosk.builtGamesCache[gameId]
                ? "&server=1"
                : "&sendBuilt=1";
            return playUrlBase + playQueryParam;
        }
    }, [gameId]);
    return (
        <iframe
            className="sim-embed"
            sandbox="allow-popups allow-forms allow-scripts allow-same-origin"
            src={playUrl}
        ></iframe>
    );
}
