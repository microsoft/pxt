import { useContext } from "react";
import GenericButton from "./GenericButton";
import { playSoundEffect } from "../Services/SoundEffectService";
import { AppStateContext } from "../State/AppStateContext";
import { launchGame } from "../Transforms/launchGame";
import { showMainMenu } from "../Transforms/showMainMenu";
import { useOnControlPress } from "../Hooks";
import * as GamepadManager from "../Services/GamepadManager";

interface IProps {}

const GameOver: React.FC<IProps> = ({}) => {
    const { state: kiosk } = useContext(AppStateContext);
    const gameId = kiosk.launchedGameId;

    const handleRetryButtonClick = () => {
        pxt.tickEvent("kiosk.gameOver.retry");
        playSoundEffect("select");
        launchGame(gameId!);
    };

    const gotoMainMenu = () => {
        pxt.tickEvent("kiosk.gameOver.mainMenu");
        playSoundEffect("select");
        showMainMenu();
    };

    // Handle Back button press
    useOnControlPress(
        [],
        gotoMainMenu,
        GamepadManager.GamepadControl.BackButton
    );

    return (
        <div className="gameOverPage">
            <h1>{lf("GAME OVER")}</h1>
            <h2>{lf("Would you like to retry?")}</h2>
            <div className="gameOverButtons">
                <GenericButton
                    title={lf("Retry")}
                    label={lf("Retry")}
                    onClick={handleRetryButtonClick}
                    autofocus={true}
                />
                <GenericButton
                    title={lf("Main Menu")}
                    label={lf("Main Menu")}
                    onClick={gotoMainMenu}
                />
            </div>
        </div>
    );
};

export default GameOver;
