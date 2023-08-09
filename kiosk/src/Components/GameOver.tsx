import { useEffect, useState } from "react";
import { Kiosk } from "../Models/Kiosk";
import AddGameButton from "./AddGameButton";
import configData from "../config.json"
import { KioskState } from "../Models/KioskState";
import { tickEvent } from "../browserUtils";


interface IProps {
    kiosk: Kiosk
  }

const GameOver: React.FC<IProps> = ({ kiosk }) => {
    const [homeButtonSelected, setHomeButtonState] = useState(false);
    const [retryButtonSelected, setRetryButtonState] = useState(false);
    const gameId = kiosk.launchedGame;


    const updateLoop = () => {
        if (kiosk.gamepadManager.isLeftPressed()) {
            setRetryButtonState(true);
            setHomeButtonState(false);

        }
        if (kiosk.gamepadManager.isRightPressed()) {
            setHomeButtonState(true);
            setRetryButtonState(false);

        }
        if (homeButtonSelected && kiosk.gamepadManager.isAButtonPressed()) {
            tickEvent("kiosk.gameOver.mainMenu");
            kiosk.navigate(KioskState.MainMenu);
        }

        if (retryButtonSelected && kiosk.gamepadManager.isAButtonPressed()) {
            tickEvent("kiosk.gameOver.retry");
            kiosk.launchGame(gameId);
        }
    }

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


    return (
        <div className="gameOverPage">
            <h1>GAME OVER</h1>
            <h2>Would you like to retry?</h2>
            <div className="gameOverButtons">
                <AddGameButton selected={retryButtonSelected} content="Retry" />
                <AddGameButton selected={homeButtonSelected} content="Main Menu" />
            </div>
        </div>
    )
}

export default GameOver;