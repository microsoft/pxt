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
import { useLocationHash, usePromise } from "./Hooks";
import { launchGame } from "./Transforms/launchGame";
import { navigate } from "./Transforms/navigate";
import { AppStateContext, AppStateReady } from "./State/AppStateContext";
import { downloadGameListAsync } from "./Transforms/downloadGameListAsync";
import * as Actions from "./State/Actions";
import * as SimHost from "./Services/SimHostService";

function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const { kioskState } = state;

    const [hash] = useLocationHash();
    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        if (ready) {
            // Set sound system volume.
            dispatch(Actions.setVolume(state.volume!));
            // Load high scores from local storage.
            dispatch(Actions.loadHighScores());
            // Download the game list from the server and set it in the app state.
            downloadGameListAsync().then(gameList => {
                dispatch(Actions.setGameList(gameList));
                // Load user-added games from local storage.
                dispatch(Actions.loadUserAddedGames());
                // Select the first game in the list.
                dispatch(Actions.setSelectedGameId(gameList[0].id));
            });
            // Init subsystems.
            SimHost.initialize();
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
            window.location.hash = "";
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
                </>
            ) : (
                <></>
            )}
        </>
    );
}

export default App;
