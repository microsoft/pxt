import { useEffect, useState } from "react";
import { Kiosk } from "../Models/Kiosk";
import AddGameButton from "./AddGameButton";
import GameList from "./GameList";
import configData from "../config.json";
import HighScoresList from "./HighScoresList";
import { DeleteButton } from "./DeleteButton";
import DeletionModal from "./DeletionModal";
import { playSoundEffect } from "../Services/SoundEffectService";

interface IProps {
    kiosk: Kiosk;
}

const MainMenu: React.FC<IProps> = ({ kiosk }) => {
    const [addButtonSelected, setAddButtonState] = useState(false);
    const [deleteButtonSelected, setDeleteButtonState] = useState(false);
    const [deleteTriggered, setDeleteTriggered] = useState(false);
    const lockedClassName = kiosk.locked ? " locked" : "";

    const updateLoop = () => {
        if (!addButtonSelected && kiosk.gamepadManager.isUpPressed()) {
            setAddButtonState(true);
            setDeleteButtonState(false);
            playSoundEffect("switch");
        }
        if (addButtonSelected && kiosk.gamepadManager.isDownPressed()) {
            setAddButtonState(false);
            playSoundEffect("switch");
        }
        if (
            !addButtonSelected &&
            !deleteButtonSelected &&
            kiosk.selectedGame?.userAdded &&
            kiosk.gamepadManager.isDownPressed()
        ) {
            setDeleteButtonState(true);
            playSoundEffect("switch");
        }
        if (deleteButtonSelected && kiosk.gamepadManager.isUpPressed()) {
            setAddButtonState(false);
            setDeleteButtonState(false);
            playSoundEffect("switch");
        }
        if (
            addButtonSelected &&
            (kiosk.gamepadManager.isAButtonPressed() ||
                kiosk.gamepadManager.isBButtonPressed())
        ) {
            pxt.tickEvent("kiosk.addGamePageLoaded");
            kiosk.launchAddGame();
            playSoundEffect("select");
        }
        if (
            deleteButtonSelected &&
            (kiosk.gamepadManager.isAButtonPressed() ||
                kiosk.gamepadManager.isBButtonPressed())
        ) {
            kiosk.gamepadManager.blockAPressUntilRelease();
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
        kiosk.gamepadManager.clear();
        kiosk.gamepadManager.blockAPressUntilRelease();
    }, []);

    return (
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
                kiosk={kiosk}
                addButtonSelected={addButtonSelected}
                deleteButtonSelected={deleteButtonSelected}
            />
            {deleteTriggered && (
                <DeletionModal
                    kiosk={kiosk}
                    active={setDeleteTriggered}
                    changeFocus={setDeleteButtonState}
                />
            )}
        </div>
    );
};

export default MainMenu;
