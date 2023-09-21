import { useEffect, useState, useContext } from "react";
import AddGameButton from "./AddGameButton";
import configData from "../config.json";
import { KioskState } from "../Types";
import { playSoundEffect } from "../Services/SoundEffectService";
import { AppStateContext } from "../State/AppStateContext";
import { gamepadManager } from "../Services/GamepadManager";
import { navigate } from "../Transforms/navigate";
import { launchGame } from "../Transforms/launchGame";

interface IProps {}

const GameOver: React.FC<IProps> = ({}) => {
    const { state: kiosk } = useContext(AppStateContext);
    const [homeButtonSelected, setHomeButtonState] = useState(false);
    const [retryButtonSelected, setRetryButtonState] = useState(false);
    const gameId = kiosk.launchedGameId;

    useEffect(() => {
        const updateLoop = () => {
            if (!retryButtonSelected && gamepadManager.isLeftPressed()) {
                setRetryButtonState(true);
                setHomeButtonState(false);
                playSoundEffect("switch");
            }
            if (!homeButtonSelected && gamepadManager.isRightPressed()) {
                setHomeButtonState(true);
                setRetryButtonState(false);
                playSoundEffect("switch");
            }
            if (homeButtonSelected && gamepadManager.isAButtonPressed()) {
                pxt.tickEvent("kiosk.gameOver.mainMenu");
                playSoundEffect("select");
                navigate(KioskState.MainMenu);
            }
            if (retryButtonSelected && gamepadManager.isAButtonPressed()) {
                pxt.tickEvent("kiosk.gameOver.retry");
                playSoundEffect("select");
                launchGame(gameId!);
            }
        };

        const intervalId = setInterval(() => {
            updateLoop();
        }, configData.GamepadPollLoopMilli);

        return () => {
            clearInterval(intervalId);
        };
    }, [gameId, homeButtonSelected, retryButtonSelected]);

    useEffect(() => {
        // When returning from another screen, block the A button until it is released to avoid launching the selected game.
        gamepadManager.clear();
        gamepadManager.blockAPressUntilRelease();
    }, []);

    return (
        <div className="gameOverPage">
            <h1>GAME OVER</h1>
            <h2>Would you like to retry?</h2>
            <div className="gameOverButtons">
                <AddGameButton selected={retryButtonSelected} content="Retry" />
                <AddGameButton
                    selected={homeButtonSelected}
                    content="Main Menu"
                />
            </div>
        </div>
    );
};

export default GameOver;
