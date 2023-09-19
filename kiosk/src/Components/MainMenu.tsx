import { useEffect, useContext, useState } from "react";
import AddGameButton from "./AddGameButton";
import GameList from "./GameList";
import configData from "../config.json";
import DeletionModal from "./DeletionModal";
import { playSoundEffect } from "../Services/SoundEffectService";
import { AppStateContext, AppStateReady } from "../State/AppStateContext";
import { gamepadManager } from "../Services/GamepadManager";
import { launchAddGame } from "../Transforms/launchAddGame";
import { usePromise } from "../Hooks/usePromise";

interface IProps {}

const MainMenu: React.FC<IProps> = ({}) => {
    const { state: kiosk } = useContext(AppStateContext);

    const selectedGame = kiosk.allGames.find(
        g => g.id === kiosk.selectedGameId
    );

    const [addButtonSelected, setAddButtonState] = useState(false);
    const [deleteButtonSelected, setDeleteButtonState] = useState(false);
    const [deleteTriggered, setDeleteTriggered] = useState(false);
    const lockedClassName = kiosk.locked ? " locked" : "";

    const ready = usePromise(AppStateReady, false);

    const updateLoop = () => {
        if (!addButtonSelected && gamepadManager.isUpPressed()) {
            setAddButtonState(true);
            setDeleteButtonState(false);
            playSoundEffect("switch");
        }
        if (addButtonSelected && gamepadManager.isDownPressed()) {
            setAddButtonState(false);
            playSoundEffect("switch");
        }
        if (
            !addButtonSelected &&
            !deleteButtonSelected &&
            selectedGame?.userAdded &&
            gamepadManager.isDownPressed()
        ) {
            setDeleteButtonState(true);
            playSoundEffect("switch");
        }
        if (deleteButtonSelected && gamepadManager.isUpPressed()) {
            setAddButtonState(false);
            setDeleteButtonState(false);
            playSoundEffect("switch");
        }
        if (
            addButtonSelected &&
            (gamepadManager.isAButtonPressed() ||
                gamepadManager.isBButtonPressed())
        ) {
            pxt.tickEvent("kiosk.addGamePageLoaded");
            launchAddGame();
            playSoundEffect("select");
        }
        if (
            deleteButtonSelected &&
            (gamepadManager.isAButtonPressed() ||
                gamepadManager.isBButtonPressed())
        ) {
            gamepadManager.blockAPressUntilRelease();
            setDeleteTriggered(true);
            playSoundEffect("select");
        }
    };

    useEffect(() => {
        if (!kiosk.locked) {
            let intervalId: any = null;
            intervalId = setInterval(() => {
                if (!deleteTriggered) {
                    updateLoop();
                }
            }, configData.GamepadPollLoopMilli);

            return () => {
                if (intervalId) {
                    clearInterval(intervalId);
                }
            };
        } else {
            pxt.tickEvent("kiosk.locked");
        }
    });

    useEffect(() => {
        // When returning from another screen, block the A button until it is released to avoid launching the selected game.
        gamepadManager.clear();
        gamepadManager.blockAPressUntilRelease();
    }, []);

    return (
        <>
            {!ready && (
                <div className="mainMenu">
                    <nav className="mainMenuTopBar">
                        <h1 className={`mainMenuHeader${lockedClassName}`}>
                            Initializing...
                        </h1>
                    </nav>
                </div>
            )}
            {ready && (
                <div className="mainMenu">
                    <nav className="mainMenuTopBar">
                        <h1 className={`mainMenuHeader${lockedClassName}`}>
                            Select a Game
                        </h1>
                        {!kiosk.locked && (
                            <div className="mainMenuButton">
                                <AddGameButton
                                    selected={addButtonSelected}
                                    content="Add your game"
                                />
                            </div>
                        )}
                    </nav>
                    <GameList
                        addButtonSelected={addButtonSelected}
                        deleteButtonSelected={deleteButtonSelected}
                    />
                    {deleteTriggered && (
                        <DeletionModal
                            active={setDeleteTriggered}
                            changeFocus={setDeleteButtonState}
                        />
                    )}
                </div>
            )}
        </>
    );
};

export default MainMenu;
