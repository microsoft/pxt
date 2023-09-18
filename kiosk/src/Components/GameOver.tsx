import { useEffect, useState } from "react";
import { Kiosk } from "../Models/Kiosk";
import AddGameButton from "./AddGameButton";
import configData from "../config.json";
import { KioskState } from "../Models/KioskState";
import { playSoundEffect } from "../Services/SoundEffectService";

interface IProps {
    kiosk: Kiosk;
}

const GameOver: React.FC<IProps> = ({ kiosk }) => {
    const [homeButtonSelected, setHomeButtonState] = useState(false);
    const [retryButtonSelected, setRetryButtonState] = useState(false);
    const gameId = kiosk.launchedGame;

    const updateLoop = () => {
        if (!retryButtonSelected && kiosk.gamepadManager.isLeftPressed()) {
            setRetryButtonState(true);
            setHomeButtonState(false);
            playSoundEffect("switch");
        }
        if (!homeButtonSelected && kiosk.gamepadManager.isRightPressed()) {
            setHomeButtonState(true);
            setRetryButtonState(false);
            playSoundEffect("switch");
        }
        if (homeButtonSelected && kiosk.gamepadManager.isAButtonPressed()) {
            pxt.tickEvent("kiosk.gameOver.mainMenu");
            playSoundEffect("select");
            kiosk.navigate(KioskState.MainMenu);
        }

        if (retryButtonSelected && kiosk.gamepadManager.isAButtonPressed()) {
            pxt.tickEvent("kiosk.gameOver.retry");
            playSoundEffect("select");
            kiosk.launchGame(gameId);
        }
    };

    useEffect(() => {
        let intervalId: any = null;

        intervalId = setInterval(() => {
            updateLoop();
        }, configData.GamepadPollLoopMilli);

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    });

    useEffect(() => {
        // When returning from another screen, block the A button until it is released to avoid launching the selected game.
        kiosk.gamepadManager.clear();
        kiosk.gamepadManager.blockAPressUntilRelease();
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
