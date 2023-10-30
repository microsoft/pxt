import { useEffect, useContext } from "react";
import "./Kiosk.css";
import "./Fonts.css";
import MainMenu from "./Components/MainMenu";
import { KioskState } from "./Types";
import EnterHighScore from "./Components/EnterHighScore";
import AddingGame from "./Components/AddingGame";
import ScanQR from "./Components/ScanQR";
import QrSuccess from "./Components/QrSuccess";
import GameOver from "./Components/GameOver";
import PlayingGame from "./Components/PlayingGame";
import Footer from "./Components/Footer";
import Notifications from "./Components/Notifications";
import AppModal from "./Components/AppModal";
import { useLocationHash, usePromise } from "./Hooks";
import { launchGame } from "./Transforms/launchGame";
import { navigate } from "./Transforms/navigate";
import { AppStateContext, AppStateReady } from "./State/AppStateContext";
import { downloadTargetConfigAsync } from "./Transforms/downloadTargetConfigAsync";
import * as Actions from "./State/Actions";
import * as SimHost from "./Services/SimHostService";
import * as NotificationService from "./Services/NotificationService";
import * as AddingGames from "./Services/AddingGamesService";
import * as GamepadManager from "./Services/GamepadManager";
import * as NavGrid from "./Services/NavGrid";
import * as RectCache from "./Services/RectCache";
import * as GameRefreshService from "./Services/GameRefreshService";
import Background from "./Components/Background";

function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const { kioskState } = state;

    const [hash] = useLocationHash();
    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        if (ready) {
            // Set sound system volume.
            dispatch(Actions.setVolume(state.volume!));
            // Load persistent state from local storage.
            dispatch(Actions.loadHighScores());
            dispatch(Actions.loadKioskCode());
            // Download targetconfig.json, then initialize game list.
            downloadTargetConfigAsync().then(cfg => {
                if (cfg) {
                    dispatch(Actions.setTargetConfig(cfg));
                    if (cfg.kiosk) {
                        if (!state.clean) {
                            dispatch(Actions.setGameList(cfg.kiosk.games));
                        }
                        // Load user-added games from local storage.
                        dispatch(Actions.loadUserAddedGames());
                    }
                } else {
                    // TODO: Handle this better
                    dispatch(Actions.setTargetConfig({}));
                }
            });
            // Init subsystems.
            SimHost.initialize();
            NotificationService.initialize();
            AddingGames.initialize();
            GamepadManager.initialize();
            NavGrid.initialize();
            RectCache.initialize();
            GameRefreshService.initialize();
        }
    }, [ready]);

    useEffect(() => {
        if (ready) {
            const match =
                /pub:((?:\d{5}-\d{5}-\d{5}-\d{5})|(?:_[a-zA-Z0-9]+))/.exec(
                    hash
                );
            const addGame = /add-game:((?:[a-zA-Z0-9]{6}))/.exec(hash);
            if (match) {
                launchGame(match[1], true);
            } else if (addGame) {
                navigate(KioskState.ScanQR);
            }
        }
    }, [hash, ready]);

    return (
        <>
            {kioskState === KioskState.MainMenu && <MainMenu />}
            {ready ? (
                <>
                    {kioskState === KioskState.EnterHighScore && (
                        <EnterHighScore />
                    )}
                    {kioskState === KioskState.AddingGame && <AddingGame />}
                    {kioskState === KioskState.ScanQR && <ScanQR />}
                    {kioskState === KioskState.QrSuccess && <QrSuccess />}
                    {kioskState === KioskState.GameOver && <GameOver />}
                    {kioskState === KioskState.PlayingGame && <PlayingGame />}
                    <Notifications />
                    <AppModal />
                    <Background />
                </>
            ) : (
                <></>
            )}
            {kioskState !== KioskState.PlayingGame && <Footer />}
        </>
    );
}

export default App;
